'use strict';
const assert = require('assert');
const { SessionRequestGate } = require('../candidates/QWEN_SESSION_REQUEST_GATE_20260821');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const gate = new SessionRequestGate();
  const events = [];
  let sameActive = 0;
  let samePeak = 0;

  async function same(label, delay) {
    return gate.runExclusive('session-A', async () => {
      sameActive += 1;
      samePeak = Math.max(samePeak, sameActive);
      events.push(`${label}:start`);
      await sleep(delay);
      events.push(`${label}:end`);
      sameActive -= 1;
    });
  }

  await Promise.all([same('A1', 25), same('A2', 1)]);
  assert.strictEqual(samePeak, 1);
  assert.deepStrictEqual(events, ['A1:start', 'A1:end', 'A2:start', 'A2:end']);
  assert.strictEqual(gate.size(), 0);

  let globalActive = 0;
  let globalPeak = 0;
  async function different(key) {
    return gate.runExclusive(key, async () => {
      globalActive += 1;
      globalPeak = Math.max(globalPeak, globalActive);
      await sleep(20);
      globalActive -= 1;
    });
  }
  await Promise.all([different('session-B'), different('session-C')]);
  assert.strictEqual(globalPeak, 2);
  assert.strictEqual(gate.size(), 0);

  const release = await gate.acquire('session-D');
  release();
  release();
  assert.strictEqual(gate.size(), 0);

  let failed = false;
  try {
    await gate.runExclusive('session-E', async () => {
      throw new Error('boom');
    });
  } catch (error) {
    failed = error.message === 'boom';
  }
  assert.strictEqual(failed, true);
  assert.strictEqual(gate.size(), 0);

  console.log(JSON.stringify({
    verdict: 'QWEN_SESSION_REQUEST_GATE_CANDIDATE_PASS',
    same_session_peak: samePeak,
    different_session_peak: globalPeak,
    idempotent_release: true,
    throw_cleanup: true,
  }));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
