import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('q8 hatch and reveal stay in one persistent onboarding scene with one bird render', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(
    screen,
    /stage === 'hatching'[\s\S]{0,80}\|\| stage === 'reveal'/,
    'reveal must stay inside the same onboarding render branch as hatching',
  );
  assert.doesNotMatch(
    screen,
    /if \(stage === 'reveal' && reveal\)/,
    'reveal must not replace the hatch tree with a second top-level scene',
  );
  assert.match(
    screen,
    /<QuizEgg[\s\S]*?hatching=\{stage === 'hatching' \|\| stage === 'reveal'\}[\s\S]*?resultId=\{revealResultId\}/,
    'the same QuizEgg must own the bird through hatch and reveal',
  );

  const revealBirdRenders = screen.match(/<ResultBird resultId=\{revealResultId\}/g) ?? [];
  assert.equal(
    revealBirdRenders.length,
    0,
    'LocalKontur must not mount a second reveal ResultBird outside persistent QuizEgg',
  );
});

test('q8 hatch opens the real stage-08 shell as two coherent halves', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');

  const stageEightShells = egg.match(/className="lk-quiz-egg__shell[^\"]*" src="\/quiz\/egg-stage-08\.webp"/g) ?? [];
  assert.equal(stageEightShells.length, 2, 'hatch should open two readable halves rather than explode into several abstract fragments');
  assert.match(egg, /lk-quiz-egg__shell--left/);
  assert.match(egg, /lk-quiz-egg__shell--right/);
  assert.match(egg, /className="lk-quiz-egg__hatch-light" src="\/quiz\/egg-crack-light\.webp"/);
  assert.doesNotMatch(egg, /<svg|<path|<line|stroke=/, 'QuizEgg must not paint a fake SVG crack over the raster shell');
});

test('the unified hatch scene cannot be hidden by the legacy local stylesheet', async () => {
  const corrections = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const local = await readFile(new URL('../src/local-kontur.css', import.meta.url), 'utf8');

  assert.match(
    local,
    /\.lk-first-time--hatching \.lk-quiz-egg-stage\s*\{\s*opacity:\s*0;\s*filter:\s*brightness\(1\.8\);\s*\}/,
    'this guard should be removed when the legacy hide rule is finally deleted',
  );
  assert.match(
    corrections,
    /\.lk-first-time--hatching \.lk-quiz-egg-stage,[\s\S]*?opacity:\s*1\s*!important;[\s\S]*?filter:\s*none\s*!important;/,
    'the current correction must beat the legacy hide rule regardless of Vite CSS import order',
  );
});

test('the future bird rises physically behind the shell before the shell fully opens', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.lk-quiz-egg__hatch-shells\s*\{[\s\S]*?z-index:\s*8;/,
    'the readable shell halves must occupy the foreground hatch layer',
  );
  assert.match(
    css,
    /\.lk-quiz-egg\.is-hatching\s*>\s*\.lk-quiz-hatch\s*\{[\s\S]*?z-index:\s*7;/,
    'the entire future-bird hatch layer must sit below the shell layer; a child z-index alone cannot beat the parent stacking context',
  );
  assert.match(
    css,
    /\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?z-index:\s*7;/,
    'the canonical bird should stay on the bounded hatch layer',
  );
  assert.match(
    css,
    /\.lk-first-time--hatching \.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?animation:\s*lk-hatch-bird-rise/,
  );
  assert.match(
    css,
    /@keyframes lk-hatch-bird-rise[\s\S]*?38%\s*\{[\s\S]*?opacity:\s*\.34;[\s\S]*?54%\s*\{[\s\S]*?opacity:\s*\.72;/,
    'bird hint must appear before the shell reaches its final opening phase',
  );
  assert.match(css, /animation:\s*lk-shell-left-open/);
  assert.match(css, /animation:\s*lk-shell-right-open/);
  assert.doesNotMatch(css, /lk-shell-bottom-gentle/, 'the old third fragment must stay removed');
  assert.doesNotMatch(
    css,
    /\.lk-first-time--hatching \.lk-quiz-egg__shell--left \{ animation: lk-shell-left 2\.3s/,
    'the old wide flying-fragment animation must not be reintroduced',
  );
});

test('reward bird art cannot intercept the equip action', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /\.lk-bird-stage--drop,[\s\S]*?\.lk-bird-stage--drop \.lk-result-bird\s*\{[\s\S]*?pointer-events:\s*none;/,
    'the reward illustration may overlap decoratively but must be click-through',
  );
  assert.match(
    css,
    /\.lk-drop \.lk-button\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*2;/,
    'the equip action must paint above the reward illustration',
  );
});

test('skip and reduced-motion finish through the same hatch finalizer and cancel the pending timer', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(screen, /const finishHatchReveal = \(\) => \{/);
  assert.match(screen, /if \(hatchTimer\.current\) window\.clearTimeout\(hatchTimer\.current\);/);
  assert.match(screen, /hatchTimer\.current = null;/);
  assert.match(screen, /setStage\('reveal'\);/);
  assert.match(screen, /onClick=\{finishHatchReveal\}>пропустить анимацию<\/button>/);
  assert.match(
    screen,
    /hatchTimer\.current = window\.setTimeout\(finishHatchReveal, reducedMotion \? 20 : 2340\);/,
    'reduced motion must collapse time but still reach reveal through the same finalizer',
  );
});
