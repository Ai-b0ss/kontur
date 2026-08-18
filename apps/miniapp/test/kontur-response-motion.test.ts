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

test('q8 visible hatch cannot overtake either the response gesture or hatch result', async () => {
  const [css, screen] = await Promise.all([
    readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8'),
  ]);

  // The response gesture starts before the concurrent final hatch request.
  const respondingAt = screen.indexOf('setEggResponding(true);');
  const hatchRequestAt = screen.indexOf('if (index + 1 >= questions.length) void hatch(next);');
  assert.ok(respondingAt >= 0 && hatchRequestAt > respondingAt);
  assert.match(screen, /setEggResponding\(false\);[\s\S]*?reducedMotion \? 0 : 260/);

  // Fast result: React may enter hatching while the gesture is still active,
  // but CSS preserves the answered q8 surface and suppresses hatch-only UI.
  assert.match(
    css,
    /\.lk-first-time--hatching\.is-egg-responding \.lk-question--egg \{[\s\S]*?opacity: 1;[\s\S]*?pointer-events: none;/,
  );
  assert.match(
    css,
    /\.lk-first-time--hatching\.is-egg-responding \.lk-hatching-label,[\s\S]*?\.lk-skip-motion \{[\s\S]*?visibility: hidden;/,
  );
  assert.match(
    css,
    /\.lk-first-time--hatching\.is-egg-responding > \.lk-quiz-hatch,[\s\S]*?animation-delay: 260ms !important;/,
  );

  // Slow result: LocalKontur does not enter hatching until hatch() has a result;
  // therefore the q8 question remains the visible state after the gesture too.
  const apiAwaitAt = screen.indexOf('const result = await api.localHatch(finalAnswers);');
  const visibleHatchAt = screen.indexOf("setStage('hatching');", apiAwaitAt);
  assert.ok(apiAwaitAt >= 0 && visibleHatchAt > apiAwaitAt);
});
