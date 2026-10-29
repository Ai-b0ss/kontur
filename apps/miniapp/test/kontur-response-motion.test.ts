import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('q1..q7 response phase advances line, ring and crack through the explicit React visual target', async () => {
  const [screen, css] = await Promise.all([
    readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8'),
  ]);

  assert.match(screen, /const \[visualQuestionIndex, setVisualQuestionIndex\] = useState\(0\);/);
  assert.match(screen, /setVisualQuestionIndex\(Math\.min\(questions\.length - 1, index \+ 1\)\);/);
  assert.match(screen, /const eggStage = stage === 'hook' \? 1 : Math\.min\(8, visualQuestionIndex \+ 1\);/);
  assert.match(screen, /\(\(visualQuestionIndex \+ 1\) \/ questions\.length\) \* 100/);
  assert.doesNotMatch(css, /is-egg-responding:has\(\.lk-quiz-egg\[data-stage=/);
  assert.doesNotMatch(css, /is-egg-responding \.lk-quiz-egg\[data-stage=.*?content:\s*url\('/s);
});

test('q8 starts pulse after response completion and gates flash on the decoded result', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  const respondingAt = screen.indexOf('setEggResponding(true);');
  const hatchRequestAt = screen.indexOf('void hatch(next);');
  assert.ok(respondingAt >= 0 && hatchRequestAt > respondingAt);
  assert.match(screen, /const \[hatchReady, setHatchReady\] = useState\(false\);/);
  assert.match(screen, /shouldEnterQ8Hatching\(stage, eggResponding, quizComplete\)/);
  assert.match(screen, /canBeginHatchFlash\(hatchPhase, hatchMinimumElapsed, hatchReady, birdAssetReady\)/);
  assert.match(screen, /setEggResponding\(false\);[\s\S]*?reducedMotion \? 0 : 260/);
  assert.match(screen, /setHatchReady\(true\);/);
});

test('reduced motion keeps the same non-zero state ordering with gentler transforms', async () => {
  const [screen, css] = await Promise.all([
    readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8'),
  ]);

  assert.match(screen, /reducedMotion \? 0 : 260/);
  assert.match(screen, /new Promise\(\(resolve\) => window\.setTimeout\(resolve, reducedMotion \? 20 : 920\)\)/);
  assert.match(css, /lk-hatch-pulse-reduced/);
  assert.match(css, /data-hatch-phase="flash"[\s\S]*?animation-duration:\s*120ms !important;/);
  assert.match(css, /data-hatch-phase="reveal"[\s\S]*?animation-duration:\s*180ms !important;/);
});
