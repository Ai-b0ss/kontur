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

test('normal and reduced-motion timelines preserve phase order without zero-duration collapse', () => {
  assert.deepEqual(hatchTimings(false), { pulse: 500, cracks: 500, flash: 140, flashOut: 300, reveal: 400 });
  assert.deepEqual(hatchTimings(true), { pulse: 80, cracks: 80, flash: 80, flashOut: 180, reveal: 220 });
  assert.equal(Object.values(hatchTimings(true)).every((duration) => duration > 0), true);
});

test('gesture and network/action locks have independent ownership', () => {
  assert.equal(shouldBlockQuizAnswer(true, false, false), true, 'network completion cannot unlock an active gesture');
  assert.equal(shouldBlockQuizAnswer(false, true, false), true, 'gesture completion cannot unlock an active network action');
  assert.equal(shouldBlockQuizAnswer(false, false, true), true, 'rendered busy state remains fail-closed');
  assert.equal(shouldBlockQuizAnswer(false, false, false), false);
});
