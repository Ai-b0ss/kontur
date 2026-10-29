import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('q8 hatch and reveal stay in one persistent scene with a stable header', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(
    screen,
    /stage === 'hatching'[\s\S]{0,80}\|\| stage === 'reveal'/,
    'reveal must stay inside the same onboarding render branch as hatching',
  );
  assert.doesNotMatch(screen, /if \(stage === 'reveal' && reveal\)/);
  assert.match(screen, /showingReveal \? 'ГОТОВО'/);
  assert.match(screen, /`\$\{String\(index \+ 1\)\.padStart\(2, '0'\)\} \/ 08`/);
  assert.match(
    screen,
    /hatchPhase=\{stage === 'reveal' \? 'settled' : hatchPhase\}[\s\S]*?resultId=\{hatchReady \? revealResultId : undefined\}/,
    'the result identity must not mount before the API result is ready',
  );
});

test('the hatch uses one intact egg plus a light texture, never split shell geometry', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');

  assert.match(egg, /className="lk-quiz-egg__base"/);
  assert.match(egg, /className="lk-quiz-egg__cracks" src="\/quiz\/egg-crack-light\.webp"/);
  assert.doesNotMatch(egg, /lk-quiz-egg__shell/);
  assert.doesNotMatch(egg, /clip-path|<svg|<path|<line|stroke=/);
  assert.match(egg, /data-hatch-phase=\{hatchPhase\}/);
});

test('bird decode gates flash while the state machine remains independent from API timing', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const bird = await readFile(new URL('../src/components/CanonicalBirdVisual.tsx', import.meta.url), 'utf8');

  assert.match(
    screen,
    /shouldEnterQ8Hatching\(stage, eggResponding, quizComplete\)/,
    'q8 completion, not API completion, starts pulse',
  );
  assert.match(
    screen,
    /canBeginHatchFlash\(hatchPhase, hatchMinimumElapsed, hatchReady, birdAssetReady\)/,
    'flash must wait for both API data and decoded bird pixels',
  );
  assert.match(screen, /onBirdReady=\{\(\) => setBirdAssetReady\(true\)\}/);
  assert.match(bird, /void image\.decode\(\)\.then\(afterPaint, afterPaint\)/);
  assert.match(bird, /loading="eager"/);
  assert.match(bird, /if \(imageReady\) readyCallback\.current\?\.\(\);/);
});

test('phase CSS never reveals bird before handoff and never creates an empty frame', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;/,
  );
  assert.doesNotMatch(
    css,
    /data-hatch-phase="(?:pulse|cracks|flash)"[^\{]*\.lk-quiz-hatch__bird[^\{]*\{[\s\S]*?visibility:\s*visible/,
    'bird cannot become visible during pulse, cracks, or flash',
  );
  assert.match(
    css,
    /data-hatch-phase="flash"[^\{]*\.lk-quiz-hatch__flash\s*\{[\s\S]*?lk-hatch-flash-in/,
  );
  assert.match(
    css,
    /@keyframes lk-hatch-flash-in[\s\S]*?100%\s*\{\s*opacity:\s*\.82;/,
    'flash must still cover the frame at the egg-to-bird state handoff',
  );
  assert.match(
    css,
    /@keyframes lk-hatch-flash-out[\s\S]*?0%\s*\{\s*opacity:\s*\.82;/,
    'the reveal phase must begin under the same opaque flash',
  );
  assert.match(
    css,
    /data-hatch-phase="reveal"[^\{]*\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?visibility:\s*visible;[\s\S]*?lk-hatch-bird-reveal/,
  );
});

test('result bird clips inside a stable circle while glow remains outside', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(
    egg,
    /lk-quiz-hatch__halo[\s\S]*?lk-quiz-hatch__frame[\s\S]*?<CanonicalBirdVisual/,
    'external halo and clipped content frame must be separate siblings',
  );
  assert.match(
    css,
    /\.lk-quiz-hatch__frame\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*50%;[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;/,
    'the empty result circle must not paint before flash handoff',
  );
  assert.match(
    css,
    /data-hatch-phase="reveal"[^\{]*\.lk-quiz-hatch__frame,[\s\S]*?data-hatch-phase="settled"[^\{]*\.lk-quiz-hatch__frame\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?visibility:\s*visible;/,
  );
  assert.match(
    css,
    /data-hatch-phase="settled"[^\{]*\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?translate3d\(0,0,0\) scale\(1\);/,
    'stable result geometry must exactly match the reveal endpoint',
  );
  assert.match(
    css,
    /@keyframes lk-hatch-bird-reveal[\s\S]*?100%\s*\{\s*opacity:\s*1;\s*transform:\s*translate3d\(0,0,0\) scale\(1\);/,
  );
});

test('skip cancels the active phase timer and atomically settles the result', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(screen, /const finishHatchReveal = useCallback\(\(\) => \{/);
  assert.match(screen, /window\.clearTimeout\(hatchPhaseTimer\.current\)/);
  assert.match(screen, /setHatchPhase\('settled'\);\s*setStage\('reveal'\);/);
  assert.match(
    screen,
    /stage === 'hatching' && hatchReady && birdAssetReady[\s\S]*?onClick=\{finishHatchReveal\}>пропустить анимацию/,
    'skip is offered only when a decoded final result can replace the hatch atomically',
  );
});

test('reduced motion preserves non-zero ordered phases without shake', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(css, /lk-hatch-pulse-reduced/);
  assert.match(
    css,
    /\.lk-reduced-motion[^\{]*data-hatch-phase="cracks"[^\{]*\.lk-quiz-egg__base\s*\{\s*animation:\s*none !important;/,
  );
  assert.match(css, /data-hatch-phase="flash"[\s\S]*?animation-duration:\s*120ms !important;/);
  assert.match(css, /data-hatch-phase="reveal"[\s\S]*?animation-duration:\s*180ms !important;/);
});

test('profile numbers are inert background and refresh has no font glyph', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.doesNotMatch(screen, />↻<\/button>/);
  assert.match(screen, /aria-label=\{refreshing \? 'Обновляется' : 'Обновить'\}[\s\S]*?\/>/);
  assert.match(
    css,
    /\.lk-home \.lk-hero-index,[\s\S]*?\.lk-home \.lk-section-index\s*\{[\s\S]*?z-index:\s*0;[\s\S]*?opacity:\s*\.07;[\s\S]*?pointer-events:\s*none;/,
  );
});
