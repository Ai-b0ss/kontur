import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldBlockQuizAnswer, shouldEnterQ8Hatching } from '../src/q8-hatch-timeline.ts';

test('fast result waits for the q8 response gesture before hatching', () => {
  assert.equal(shouldEnterQ8Hatching('questions', true, true), false);
  assert.equal(shouldEnterQ8Hatching('questions', false, true), true);
  assert.equal(shouldEnterQ8Hatching('hatching', false, true), false, 'transition is idempotent');
});

test('slow result waits after the gesture until the result is actually ready', () => {
  assert.equal(shouldEnterQ8Hatching('questions', false, false), false);
  assert.equal(shouldEnterQ8Hatching('questions', false, true), true);
});

test('gesture and network/action locks have independent ownership', () => {
  assert.equal(shouldBlockQuizAnswer(true, false, false), true, 'network completion cannot unlock an active gesture');
  assert.equal(shouldBlockQuizAnswer(false, true, false), true, 'gesture completion cannot unlock an active network action');
  assert.equal(shouldBlockQuizAnswer(false, false, true), true, 'rendered busy state remains fail-closed');
  assert.equal(shouldBlockQuizAnswer(false, false, false), false);
});
