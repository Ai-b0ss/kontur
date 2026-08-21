'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentUpdate(task, patch) {
  return { ...task, ...clone(patch) };
}

function guardedUpdate(task, expectedStatuses, patch) {
  if (!expectedStatuses.includes(task.status)) {
    const error = new Error(`stale transition ${task.status} -> ${patch.status}`);
    error.code = 'QWEN_SUBAGENT_BATCH_STALE_TRANSITION';
    throw error;
  }
  return { ...task, ...clone(patch) };
}

function main() {
  const pending = { status: 'pending' };
  const running = currentUpdate(pending, { status: 'running' });
  const done = currentUpdate(running, { status: 'done', result: { ok: true, text: 'finished' } });

  // Exact current store semantics use blind object merge. A stale worker can
  // therefore overwrite a durable terminal success after it was already committed.
  const downgraded = currentUpdate(done, {
    status: 'uncertain',
    result: { ok: false, uncertain: true, code: 'LATE_STALE_WORKER' },
  });
  const reopened = currentUpdate(done, { status: 'running', startedAt: 'later' });

  if (downgraded.status !== 'uncertain' || downgraded.result.ok !== false) {
    throw new Error('failed to reproduce done -> uncertain overwrite');
  }
  if (reopened.status !== 'running') {
    throw new Error('failed to reproduce done -> running reopen');
  }

  let blockedUncertain = false;
  let blockedRunning = false;
  try {
    guardedUpdate(done, ['running'], { status: 'uncertain' });
  } catch (error) {
    blockedUncertain = error.code === 'QWEN_SUBAGENT_BATCH_STALE_TRANSITION';
  }
  try {
    guardedUpdate(done, ['pending', 'failed', 'uncertain'], { status: 'running' });
  } catch (error) {
    blockedRunning = error.code === 'QWEN_SUBAGENT_BATCH_STALE_TRANSITION';
  }

  const validDone = guardedUpdate(running, ['running'], { status: 'done', result: { ok: true } });
  if (!blockedUncertain || !blockedRunning || validDone.status !== 'done') {
    throw new Error('guard candidate did not preserve required transition semantics');
  }

  process.stdout.write(`${JSON.stringify({
    verdict: 'REPRODUCED_STALE_TERMINAL_STATUS_DOWNGRADE_AND_GUARD_PASS',
    current: {
      done_to_uncertain_allowed: true,
      done_to_running_allowed: true,
    },
    candidate: {
      stale_done_to_uncertain_blocked: true,
      stale_done_to_running_blocked: true,
      running_to_done_allowed: true,
    },
    requirement: 'transition check must execute inside the same store-wide serialized/CAS transaction as the write',
  }, null, 2)}\n`);
}

main();
