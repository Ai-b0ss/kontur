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

test('q8 hatch opens the actual stage-08 shell instead of painting a synthetic crack over it', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');

  const stageEightShells = egg.match(/className="lk-quiz-egg__shell[^\"]*" src="\/quiz\/egg-stage-08\.webp"/g) ?? [];
  assert.equal(stageEightShells.length, 3, 'all three moving hatch fragments must be clipped from the real q8 shell asset');
  assert.match(egg, /className="lk-quiz-egg__hatch-light" src="\/quiz\/egg-crack-light\.webp"/);
  assert.doesNotMatch(egg, /<svg|<path|<line|stroke=/, 'QuizEgg must not paint a fake SVG crack over the raster shell');
});

test('the future bird becomes visible through a bounded crack before the shell fully opens', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?z-index:\s*10;[\s\S]*?clip-path:\s*polygon\(/,
    'the same canonical bird must have a small visible crack window above the shell',
  );
  assert.match(
    css,
    /\.lk-first-time--hatching \.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?animation:\s*lk-hatch-bird-window/,
  );
  assert.match(
    css,
    /@keyframes lk-hatch-bird-window[\s\S]*?38%\s*\{[\s\S]*?opacity:\s*\.42;[\s\S]*?53%\s*\{[\s\S]*?opacity:\s*\.76;/,
    'bird hint must appear before the shell reaches its final opening phase',
  );
  assert.match(css, /animation:\s*lk-shell-left-gentle/);
  assert.match(css, /animation:\s*lk-shell-right-gentle/);
  assert.match(css, /animation:\s*lk-shell-bottom-gentle/);
  assert.doesNotMatch(
    css,
    /\.lk-first-time--hatching \.lk-quiz-egg__shell--one \{ animation: lk-shell-left 2\.3s/,
    'the old wide flying-fragment animation must not be reintroduced',
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
