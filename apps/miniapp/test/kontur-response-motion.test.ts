import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('q1..q7 response phase advances line, ring and crack to N+1 before question index changes', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  const nextProgress = ['25%', '37.5%', '50%', '62.5%', '75%', '87.5%', '100%'];
  for (let stage = 1; stage <= 7; stage += 1) {
    const nextStage = stage + 1;
    const nextDegrees = nextStage * 45;
    const padded = String(nextStage).padStart(2, '0');

    assert.match(
      css,
      new RegExp(`is-egg-responding:has\\(\\.lk-quiz-egg\\[data-stage="${stage}"\\]\\)[\\s\\S]*?width: ${nextProgress[stage - 1]!.replace('.', '\\.')}`),
      `top progress must target q${nextStage} while q${stage} response is active`,
    );
    assert.match(
      css,
      new RegExp(`is-egg-responding \\.lk-quiz-egg\\[data-stage="${stage}"\\] \\.lk-quiz-egg__ring \\{ --lk-egg-progress: ${nextDegrees}deg`),
      `ring must target q${nextStage} while q${stage} response is active`,
    );
    assert.match(
      css,
      new RegExp(`is-egg-responding \\.lk-quiz-egg\\[data-stage="${stage}"\\] \\.lk-quiz-egg__base \\{ content: url\\('/quiz/egg-stage-${padded}\\.webp'\\)`),
      `egg art must target stage ${nextStage} while q${stage} response is active`,
    );
  }
});
