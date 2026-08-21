'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseState(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid batch store');
  if (!parsed.batches || typeof parsed.batches !== 'object' || Array.isArray(parsed.batches)) throw new Error('invalid batch store');
  return parsed;
}

function readNewestBackup(file) {
  const dir = path.dirname(file);
  const prefix = `${path.basename(file)}.bak-`;
  let candidates = [];
  try {
    candidates = fs.readdirSync(dir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => {
        const full = path.join(dir, name);
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (_) {
    return null;
  }
  for (const candidate of candidates) {
    try { return parseState(fs.readFileSync(candidate.full, 'utf8')); }
    catch (_) {}
  }
  return null;
}

function currentReadState(file) {
  try {
    return parseState(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    const recovered = readNewestBackup(file);
    if (recovered) return recovered;
    if (error && error.code === 'ENOENT') return { version: 1, batches: {} };
    throw error;
  }
}

function failClosedRecoveredBackup(state) {
  const safe = JSON.parse(JSON.stringify(state));
  for (const batch of Object.values(safe.batches || {})) {
    for (const task of Object.values(batch.tasks || {})) {
      // A backup is a predecessor snapshot. If the newer canonical record is
      // unreadable, we cannot prove that a later running/uncertain/done write was
      // not durably installed before corruption. Only an already-done predecessor
      // is replay-safe; all other recovered tasks must block automatic execution.
      if (task.status !== 'done') {
        task.status = 'uncertain';
        task.recoveredFromBackup = true;
      }
    }
  }
  return safe;
}

function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-batch-backup-probe-'));
  const file = path.join(dir, 'subagent-batches.json');

  // Model a predecessor backup from before markRunning. The canonical file later
  // held `running`, local tools may have executed, and then the canonical bytes
  // became unreadable. Current readState() silently falls back to the old pending
  // backup and makes the task runnable again.
  fs.writeFileSync(`${file}.bak-1-1`, JSON.stringify({
    version: 1,
    batches: { batch: { tasks: { task: { status: 'pending' } } } },
  }));
  fs.writeFileSync(file, '{not-json');

  const recovered = currentReadState(file);
  const currentStatus = recovered.batches.batch.tasks.task.status;
  if (currentStatus !== 'pending') throw new Error(`expected pending fallback, got ${currentStatus}`);

  const safe = failClosedRecoveredBackup(recovered);
  const safeStatus = safe.batches.batch.tasks.task.status;
  if (safeStatus !== 'uncertain') throw new Error('fail-closed candidate did not block replay');

  process.stdout.write(`${JSON.stringify({
    verdict: 'REPRODUCED_BACKUP_PENDING_REPLAY_GAP_AND_FAIL_CLOSED_CANDIDATE_PASS',
    current_recovered_status: currentStatus,
    candidate_status: safeStatus,
    automatic_replay_after_backup_recovery: false,
  }, null, 2)}\n`);
}

main();
