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

test('the active hatch and reveal states keep the persistent QuizEgg visible without important hacks', async () => {
  const corrections = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');

  assert.match(
    corrections,
    /\.lk-first-time\.lk-first-time--hatching \.lk-quiz-egg-stage,\s*\.lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*none;/,
    'the active hatch/reveal contract must keep the same QuizEgg scene visible and unfiltered',
  );
  assert.match(egg, /className={`lk-quiz-egg\$\{hatching \? ' is-hatching' : ''\}`}/);
  assert.doesNotMatch(
    corrections,
    /opacity:\s*1\s*!important|filter:\s*none\s*!important/,
    'hatch visibility should not depend on important declarations',
  );
});

test('the intact egg stays singular until the shell actually begins opening', async () => {
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
    /@keyframes lk-hatch-bird-rise[\s\S]*?0%,\s*58%\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?68%\s*\{[\s\S]*?opacity:\s*\.34;/,
    'the bird must stay hidden until the shell has started to open',
  );
  assert.match(
    css,
    /@keyframes lk-shell-left-open[\s\S]*?0%,\s*52%\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?53%,\s*58%\s*\{[\s\S]*?opacity:\s*1;/,
    'the duplicate shell layer must stay invisible while the base egg is still intact',
  );
  assert.match(
    css,
    /@keyframes lk-hatch-base-fade[\s\S]*?0%,\s*56%\s*\{\s*opacity:\s*1;\s*\}/,
    'the single base egg must remain fully visible up to the opening hand-off',
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

test('hatch and reveal preserve the exact final bird pose without a state-change snap', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const finalPose = 'translateY(-9%) scale(1.03)';

  assert.match(
    css,
    /100%\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*translateY\(-9%\) scale\(1\.03\);[\s\S]*?\}/,
    'the hatch animation must finish at the intended bird pose',
  );
  assert.match(
    css,
    /\.lk-first-time--reveal \.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?transform:\s*translateY\(-9%\) scale\(1\.03\);/,
    'reveal must retain the final hatch pose instead of resetting transform to none',
  );
  assert.ok(css.includes(finalPose));
});

test('reward bird art stays clear of copy and cannot intercept the equip action', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /\.lk-canonical-bird > \.lk-result-bird\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*0;[\s\S]*?object-fit:\s*contain;/,
    'every canonical master must be allowed to shrink inside its bounded frame regardless of its intrinsic aspect ratio',
  );
  assert.match(
    css,
    /\.lk-bird-stage--drop,[\s\S]*?\.lk-bird-stage--drop \.lk-result-bird\s*\{[\s\S]*?pointer-events:\s*none;/,
    'the reward illustration must be click-through',
  );
  assert.match(
    css,
    /\.lk-drop \.lk-bird-stage--drop\s*\{[\s\S]*?height:\s*310px;[\s\S]*?margin-bottom:\s*0;/,
    'the canonical reward master must reserve enough layout height to stay clear of its title',
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
