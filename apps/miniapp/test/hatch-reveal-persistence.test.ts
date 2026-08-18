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
