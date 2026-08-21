#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function sleepMs(ms) { Atomics.wait(sleepBuf, 0, 0, ms); }

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return Boolean(error && error.code === 'EPERM'); }
}

function readLockOwner(lockDir) {
  try { return JSON.parse(fs.readFileSync(path.join(lockDir, 'owner.json'), 'utf8')); }
  catch (_) { return null; }
}

function tryRetireDeadLock(lockDir) {
  const owner = readLockOwner(lockDir);
  if (!owner || pidAlive(Number(owner.pid))) return false;
  const tombstone = `${lockDir}.stale-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.renameSync(lockDir, tombstone); // atomic winner for stale-lock recovery
  } catch (error) {
    if (error && ['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) return false;
    throw error;
  }
  fs.rmSync(tombstone, { recursive: true, force: true });
  return true;
}

function acquireStoreLock(target, options = {}) {
  const lockDir = `${target}.lock`;
  const timeoutMs = Math.max(50, Number(options.timeoutMs || 5000));
  const pollMs = Math.max(5, Number(options.pollMs || 20));
  const deadline = Date.now() + timeoutMs;
  const token = crypto.randomUUID();

  while (true) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      const owner = { pid: process.pid, token, acquiredAt: new Date().toISOString() };
      fs.writeFileSync(path.join(lockDir, 'owner.json'), `${JSON.stringify(owner)}\n`, { mode: 0o600 });
      return { lockDir, token };
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
      tryRetireDeadLock(lockDir);
      if (Date.now() >= deadline) {
        const err = new Error('Timed out waiting for subagent batch store lock');
        err.code = 'QWEN_SUBAGENT_BATCH_STORE_LOCK_TIMEOUT';
        throw err;
      }
      sleepMs(pollMs);
    }
  }
}

function releaseStoreLock(lock) {
  const owner = readLockOwner(lock.lockDir);
  if (!owner || owner.token !== lock.token || Number(owner.pid) !== process.pid) {
    const err = new Error('Subagent batch store lock ownership changed before release');
    err.code = 'QWEN_SUBAGENT_BATCH_STORE_LOCK_OWNERSHIP_LOST';
    throw err;
  }
  fs.rmSync(lock.lockDir, { recursive: true, force: false });
}

function withStoreLock(target, fn, options) {
  const lock = acquireStoreLock(target, options);
  try { return fn(); }
  finally { releaseStoreLock(lock); }
}

function readState(target) {
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch (error) {
    if (error && error.code === 'ENOENT') return { version: 1, batches: {} };
    throw error;
  }
}

function writeAtomic(target, state) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, target);
}

function transaction(target, mutator, delayMs = 0) {
  return withStoreLock(target, () => {
    const state = readState(target);
    const next = JSON.parse(JSON.stringify(state));
    const result = mutator(next);
    if (delayMs > 0) sleepMs(delayMs); // widen the old lost-update window deliberately
    writeAtomic(target, next);
    return result;
  });
}

function update(target, batchId, taskId, status, delayMs = 0) {
  transaction(target, (state) => {
    state.batches[batchId] ||= { tasks: {} };
    state.batches[batchId].tasks[taskId] ||= {};
    state.batches[batchId].tasks[taskId].status = status;
  }, delayMs);
}

function childMain() {
  const target = process.argv[3];
  const batch = process.argv[4];
  const task = process.argv[5];
  const status = process.argv[6];
  const delay = Number(process.argv[7] || 0);
  update(target, batch, task, status, delay);
}

function runChild(target, batch, task, status, delay) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, 'child', target, batch, task, status, String(delay)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`child exit ${code}: ${stderr}`)));
    child.on('error', reject);
  });
}

async function main() {
  if (process.argv[2] === 'child') { childMain(); return; }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-batch-lock-probe-'));
  const target = path.join(dir, 'subagent-batches.json');
  writeAtomic(target, {
    version: 1,
    batches: {
      'batch-a': { tasks: { 'task-a': { status: 'pending' } } },
      'batch-b': { tasks: { 'task-b': { status: 'pending' } } },
    },
  });

  // Two real processes overlap. Without a store-wide lock this is the exact
  // read->mutate->replace lost-update window previously reproduced.
  await Promise.all([
    runChild(target, 'batch-a', 'task-a', 'running', 180),
    runChild(target, 'batch-b', 'task-b', 'running', 20),
  ]);
  const concurrent = readState(target);
  if (concurrent.batches['batch-a'].tasks['task-a'].status !== 'running') throw new Error('batch-a lost');
  if (concurrent.batches['batch-b'].tasks['task-b'].status !== 'running') throw new Error('batch-b lost');

  // A dead owner must be recoverable without two waiters deleting a live successor.
  const lockDir = `${target}.lock`;
  fs.mkdirSync(lockDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify({ pid: 99999999, token: 'dead' }));
  update(target, 'batch-c', 'task-c', 'running', 0);
  const recovered = readState(target);
  if (recovered.batches['batch-c'].tasks['task-c'].status !== 'running') throw new Error('dead lock recovery failed');
  if (fs.existsSync(lockDir)) throw new Error('lock leaked after recovery');

  // Ownership token prevents a stale releaser from deleting somebody else's lock.
  const first = acquireStoreLock(target);
  const ownerPath = path.join(first.lockDir, 'owner.json');
  const fake = { pid: process.pid, token: 'replacement-token', acquiredAt: new Date().toISOString() };
  fs.writeFileSync(ownerPath, `${JSON.stringify(fake)}\n`);
  let ownershipBlocked = false;
  try { releaseStoreLock(first); }
  catch (error) { ownershipBlocked = error && error.code === 'QWEN_SUBAGENT_BATCH_STORE_LOCK_OWNERSHIP_LOST'; }
  if (!ownershipBlocked) throw new Error('stale releaser was not blocked');
  fs.rmSync(first.lockDir, { recursive: true, force: true });

  console.log(JSON.stringify({
    verdict: 'QWEN_BATCH_STORE_INTERPROCESS_LOCK_CANDIDATE_PASS',
    real_processes: 2,
    independent_updates_preserved: true,
    dead_owner_recovered: true,
    stale_releaser_blocked: true,
    lock_scope: 'entire read-mutate-atomic-replace transaction',
    note: 'candidate support logic only; product file not modified',
  }));
}

main().catch((error) => {
  console.error(error && error.stack || String(error));
  process.exit(1);
});
