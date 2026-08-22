'use strict';

function currentProcessModel() {
  let wallNow = 1_000_000;
  let monoNow = 5_000;
  const cooldownMs = 10 * 60 * 1000;
  const persisted = { unavailableUntil: wallNow + cooldownMs };
  let monotonicDeadline = monoNow + cooldownMs;

  const available = () => !(
    persisted.unavailableUntil > wallNow || monotonicDeadline > monoNow
  );

  if (available()) throw new Error('cooldown must start unavailable');

  // Forward wall-clock jump inside the same process: monotonic guard still wins.
  wallNow += 60 * 60 * 1000;
  monoNow += 60 * 1000; // only one real minute elapsed
  const sameProcessAvailable = available();

  // Process restart: hrtime origin changes and the in-memory monotonic map is empty.
  const restartedMonoNow = 100;
  let restartedDeadline = 0;
  // Current account-store load(): only reconstructs the monotonic deadline when
  // persisted unavailableUntil is still in the future according to wall clock.
  if (persisted.unavailableUntil > wallNow) {
    restartedDeadline = restartedMonoNow + (persisted.unavailableUntil - wallNow);
  }
  const restartedAvailable = !(
    persisted.unavailableUntil > wallNow || restartedDeadline > restartedMonoNow
  );

  return {
    sameProcessAvailable,
    restartedAvailable,
    persistedUnavailableUntil: persisted.unavailableUntil,
    wallNowAfterJump: wallNow,
    realElapsedMs: 60 * 1000,
    intendedCooldownMs: cooldownMs,
  };
}

function safeContractModel() {
  // Candidate contract: persist a restart-safe duration anchor that does not trust
  // the current wall clock alone. One simple representation is a boot/generation
  // marker plus remaining duration refreshed durably when the cooldown starts;
  // on an untrusted clock discontinuity/restart, fail closed for at least the
  // persisted remaining duration unless a trusted monotonic/boot-time source can
  // prove more elapsed time. This model checks the required invariant, not a
  // particular product implementation.
  const cooldownMs = 10 * 60 * 1000;
  const realElapsedBeforeRestart = 60 * 1000;
  const persistedRemainingAtRestart = cooldownMs - realElapsedBeforeRestart;
  const restartedAvailable = persistedRemainingAtRestart <= 0;
  return {
    restartedAvailable,
    persistedRemainingAtRestart,
    verdict: restartedAvailable ? 'FAIL' : 'PASS',
  };
}

const current = currentProcessModel();
const candidate = safeContractModel();
if (current.sameProcessAvailable !== false) throw new Error('in-process monotonic guard regression');
if (current.restartedAvailable !== true) throw new Error('restart counterexample did not reproduce');
if (candidate.restartedAvailable !== false) throw new Error('candidate invariant failed');

console.log(JSON.stringify({
  verdict: 'QWEN_COOLDOWN_FORWARD_CLOCK_JUMP_RESTART_GAP_REPRODUCED',
  current,
  candidate,
}, null, 2));
