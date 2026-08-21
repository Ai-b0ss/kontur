'use strict';
const assert = require('assert');

async function barrier(n) {
  let count = 0;
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return async () => {
    count += 1;
    if (count === n) release();
    await promise;
  };
}

async function reproduceCurrentContract() {
  const state = { task: { status: 'pending', result: null } };
  let sideEffects = 0;
  const meet = await barrier(2);

  async function contender(name) {
    // Mirrors runAgentSubagents(): get() is separate from markRunning().
    const current = JSON.parse(JSON.stringify(state.task));
    if (current.status === 'done') return 'resumed';
    if (current.status === 'running' || current.status === 'uncertain') return 'blocked';

    await meet(); // both contenders observed pending

    // Mirrors blind markRunning(): no expected-status/owner compare-and-set.
    state.task = { ...state.task, status: 'running', owner: name };
    sideEffects += 1; // mutating coding work begins
    state.task = { ...state.task, status: 'done', result: { ok: true, owner: name } };
    return 'executed';
  }

  const results = await Promise.all([contender('A'), contender('B')]);
  return { results, sideEffects, final: state.task };
}

async function verifyClaimContract() {
  const state = { task: { status: 'pending', result: null } };
  let sideEffects = 0;
  const meet = await barrier(2);
  let claimLocked = false;

  async function atomicClaim(name) {
    // Semantic candidate only. Production needs an inter-process lock/CAS around
    // the store mutation; a per-process JS mutex is insufficient.
    while (claimLocked) await new Promise((resolve) => setImmediate(resolve));
    claimLocked = true;
    try {
      if (state.task.status !== 'pending' && state.task.status !== 'failed') return false;
      state.task = { ...state.task, status: 'running', owner: name };
      return true;
    } finally {
      claimLocked = false;
    }
  }

  async function contender(name) {
    const observed = JSON.parse(JSON.stringify(state.task));
    if (observed.status === 'done') return 'resumed';
    await meet();
    if (!await atomicClaim(name)) return 'blocked';
    sideEffects += 1;
    state.task = { ...state.task, status: 'done', result: { ok: true, owner: name } };
    return 'executed';
  }

  const results = await Promise.all([contender('A'), contender('B')]);
  return { results, sideEffects, final: state.task };
}

(async () => {
  const current = await reproduceCurrentContract();
  const candidate = await verifyClaimContract();

  assert.strictEqual(current.sideEffects, 2);
  assert.strictEqual(current.results.filter((x) => x === 'executed').length, 2);
  assert.strictEqual(candidate.sideEffects, 1);
  assert.strictEqual(candidate.results.filter((x) => x === 'executed').length, 1);
  assert.strictEqual(candidate.results.filter((x) => x === 'blocked').length, 1);

  console.log(JSON.stringify({
    verdict: 'QWEN_BATCH_CONCURRENT_CLAIM_RACE_REPRO_PASS',
    current,
    candidate,
    required_product_contract: [
      'claim persisted task atomically across processes before any provider/tool work',
      'claim checks expected prior status instead of blind markRunning',
      'losing contender must not execute and must surface running/uncertain/resumed state',
      'store mutation serialization must be inter-process; a per-process mutex is insufficient'
    ]
  }));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
