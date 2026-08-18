import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screenUrl = new URL('../src/screens/LocalKontur.tsx', import.meta.url);
const correctionCssUrl = new URL('../src/kontur-core-corrections.css', import.meta.url);

test('q1..q7 advance the React visual target during the answer gesture', async () => {
  const screen = await readFile(screenUrl, 'utf8');

  assert.match(
    screen,
    /const \[visualQuestionIndex, setVisualQuestionIndex\] = useState\(0\);/,
    'the answer gesture needs an explicit React visual target instead of a CSS-only N+1 impersonation',
  );
  assert.match(
    screen,
    /const eggStage = stage === 'hook' \? 1 : Math\.min\(8, visualQuestionIndex \+ 1\);/,
    'QuizEgg must derive from the explicit visual target while the old question remains mounted for its response gesture',
  );
  assert.match(
    screen,
    /setVisualQuestionIndex\(Math\.min\(questions\.length - 1, index \+ 1\)\);/,
    'answer selection must move the egg/ring/progress target to N+1 immediately',
  );
});

test('q8 visible hatch is gated by gesture completion and result readiness in React state', async () => {
  const screen = await readFile(screenUrl, 'utf8');

  assert.match(screen, /const \[hatchReady, setHatchReady\] = useState\(false\);/);
  assert.match(
    screen,
    /if \(!eggResponding && hatchReady\) setStage\('hatching'\);/,
    'React must not enter visible hatching until both q8 response motion and hatch result are ready',
  );
});

test('CSS no longer impersonates the next egg/progress state', async () => {
  const css = await readFile(correctionCssUrl, 'utf8');

  assert.doesNotMatch(css, /\.is-egg-responding:has\(\.lk-quiz-egg\[data-stage=/);
  assert.doesNotMatch(css, /\.is-egg-responding \.lk-quiz-egg\[data-stage=.*?content:\s*url\('/s);
});
