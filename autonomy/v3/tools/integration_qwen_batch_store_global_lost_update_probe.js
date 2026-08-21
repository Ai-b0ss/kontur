#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeAtomic(file, state, tag) {
  const tmp = `${file}.tmp-${process.pid}-${tag}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readState(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function waitFor(file, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${file}`);
    sleepSync(5);
  }
}

function worker() {
  const [, , , stateFile, readyFile, releaseFile, batchId, taskId, tag, lockDir] = process.argv;
  const run = () => {
    const state = readState(stateFile);
    fs.writeFileSync(readyFile, 'ready');
    waitFor(releaseFile);
    state.batches[batchId].tasks[taskId] = { status: 'running', writer: tag };
    writeAtomic(stateFile, state, tag);
  };

  if (!lockDir) {
    run();
    return;
  }

  // Candidate semantics only. Production needs a crash-safe, bounded,
  // cross-process lock/CAS around the complete read-modify-write transaction.
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      sleepSync(5);
    }
  }
  try { run(); } finally { fs.rmdirSync(lockDir); }
}

async function spawnWorker(args) {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, ['--worker', ...args], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`worker exit ${code}: ${stderr}`)));
  });
}

function baseState() {
  return {
    version: 1,
    batches: {
      'batch-a': { tasks: { 'task-a': { status: 'pending' } } },
      'batch-b': { tasks: { 'task-b': { status: 'pending' } } },
    },
  };
}

async function reproduceUnlocked(root) {
  const stateFile = path.join(root, 'unlocked.json');
  writeAtomic(stateFile, baseState(), 'seed');
  const aReady = path.join(root, 'a.ready');
  const bReady = path.join(root, 'b.ready');
  const aRelease = path.join(root, 'a.release');
  const bRelease = path.join(root, 'b.release');

  const a = spawnWorker([stateFile, aReady, aRelease, 'batch-a', 'task-a', 'A', '']);
  const b = spawnWorker([stateFile, bReady, bRelease, 'batch-b', 'task-b', 'B', '']);
  waitFor(aReady);
  waitFor(bReady);

  fs.writeFileSync(aRelease, 'go');
  await a;
  fs.writeFileSync(bRelease, 'go');
  await b;

  const final = readState(stateFile);
  return {
    a: final.batches['batch-a'].tasks['task-a'],
    b: final.batches['batch-b'].tasks['task-b'],
  };
}

async function verifySerialized(root) {
  const stateFile = path.join(root, 'serialized.json');
  writeAtomic(stateFile, baseState(), 'seed');
  const lockDir = path.join(root, 'store.lock');
  const aReady = path.join(root, 'sa.ready');
  const bReady = path.join(root, 'sb.ready');
  const aRelease = path.join(root, 'sa.release');
  const bRelease = path.join(root, 'sb.release');

  const a = spawnWorker([stateFile, aReady, aRelease, 'batch-a', 'task-a', 'A', lockDir]);
  waitFor(aReady);
  const b = spawnWorker([stateFile, bReady, bRelease, 'batch-b', 'task-b', 'B', lockDir]);
  fs.writeFileSync(aRelease, 'go');
  await a;
  waitFor(bReady);
  fs.writeFileSync(bRelease, 'go');
  await b;

  const final = readState(stateFile);
  return {
    a: final.batches['batch-a'].tasks['task-a'],
    b: final.batches['batch-b'].tasks['task-b'],
  };
}

async function main() {
  if (process.argv[2] === '--worker') {
    worker();
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-batch-store-race-'));
  try {
    const unlocked = await reproduceUnlocked(root);
    const serialized = await verifySerialized(root);

    const lostUpdate = unlocked.a.status === 'pending' && unlocked.b.status === 'running';
    const safe = serialized.a.status === 'running' && serialized.b.status === 'running';
    if (!lostUpdate || !safe) {
      throw new Error(`unexpected result: ${JSON.stringify({ unlocked, serialized })}`);
    }

    process.stdout.write(`${JSON.stringify({
      verdict: 'QWEN_BATCH_STORE_GLOBAL_LOST_UPDATE_REPRODUCED',
      current_semantics: {
        two_independent_transactions_both_read_before_first_commit: true,
        final_task_a_status: unlocked.a.status,
        final_task_b_status: unlocked.b.status,
        lost_update: true,
      },
      candidate_contract: {
        serialize_entire_read_modify_write_across_processes: true,
        final_task_a_status: serialized.a.status,
        final_task_b_status: serialized.b.status,
        lost_update: false,
      },
    }, null, 2)}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
