import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canBeginHatchFlash,
  hatchTimings,
  shouldBlockQuizAnswer,
  shouldEnterQ8Hatching,
} from '../src/q8-hatch-timeline.ts';

test('q8 completion starts the visual timeline after the response gesture, independent of network state', () => {
  assert.equal(shouldEnterQ8Hatching('questions', true, true), false);
  assert.equal(shouldEnterQ8Hatching('questions', false, true), true);
  assert.equal(shouldEnterQ8Hatching('hatching', false, true), false, 'transition is idempotent');
  assert.equal(shouldEnterQ8Hatching('questions', false, false), false);
});

test('flash is fail-closed until timeline, API result, and decoded bird are all ready', () => {
  assert.equal(canBeginHatchFlash('pulse', true, true, true), false);
  assert.equal(canBeginHatchFlash('cracks', false, true, true), false);
  assert.equal(canBeginHatchFlash('cracks', true, false, true), false);
  assert.equal(canBeginHatchFlash('cracks', true, true, false), false);
  assert.equal(canBeginHatchFlash('cracks', true, true, true), true);
});

test('normal ready-path stays 1.4s with a dedicated final 400ms rattle window', () => {
  const normal = hatchTimings(false);
  assert.deepEqual(normal, { pulse: 200, cracks: 400, flash: 200, flashOut: 120, reveal: 600 });
  assert.equal(normal.cracks, 400);
  assert.equal(normal.pulse + normal.cracks + normal.flash + normal.reveal, 1400);

  assert.deepEqual(hatchTimings(true), { pulse: 60, cracks: 60, flash: 80, flashOut: 80, reveal: 220 });
  assert.equal(Object.values(hatchTimings(true)).every((duration) => duration > 0), true);
});

test('gesture and network/action locks have independent ownership', () => {
  assert.equal(shouldBlockQuizAnswer(true, false, false), true, 'network completion cannot unlock an active gesture');
  assert.equal(shouldBlockQuizAnswer(false, true, false), true, 'gesture completion cannot unlock an active network action');
  assert.equal(shouldBlockQuizAnswer(false, false, true), true, 'rendered busy state remains fail-closed');
  assert.equal(shouldBlockQuizAnswer(false, false, false), false);
});
