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

test('hatch owns one master mask, one crack texture and two coherent shell windows', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const hotfix = await readFile(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');

  assert.match(egg, /className="lk-quiz-egg__inner"/);
  assert.match(egg, /className="lk-quiz-egg__light-burst"/);
  assert.match(egg, /className="lk-quiz-egg__base"/);
  assert.match(egg, /className="lk-quiz-egg__cracks"[\s\S]*?src="\/quiz\/egg-crack-light\.webp"/);
  assert.equal((egg.match(/src="\/quiz\/egg-crack-light\.webp"/g) ?? []).length, 1);
  assert.match(egg, /className="lk-hatch-half lk-hatch-half--left"[\s\S]*?className="lk-hatch-half__image"[\s\S]*?src="\/quiz\/egg-stage-08\.webp"/);
  assert.match(egg, /className="lk-hatch-half lk-hatch-half--right"[\s\S]*?className="lk-hatch-half__image"[\s\S]*?src="\/quiz\/egg-stage-08\.webp"/);
  assert.equal((egg.match(/src="\/quiz\/egg-stage-08\.webp"/g) ?? []).length, 2);
  assert.doesNotMatch(egg, /<svg|<path|<line|stroke=/);
  assert.doesNotMatch(hotfix, /clip-path\s*:/, 'shell opening must not use polygon clip-path');
  assert.match(hotfix, /\.lk-hatch-half\s*\{[\s\S]*?overflow:\s*hidden;/);
});

test('bird art is preloaded from question six without mounting a result early', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const assets = await readFile(new URL('../src/components/result-bird-assets.ts', import.meta.url), 'utf8');

  assert.match(egg, /if \(stage >= 6\) preloadResultBirdAssets\(\)/);
  assert.match(assets, /export function preloadResultBirdAssets\(\)/);
  assert.match(assets, /const image = new Image\(\)/);
  assert.match(assets, /image\.src = asset\.src/);
  assert.match(egg, /\{hatching && resultId && \([\s\S]*?<CanonicalBirdVisual/,
    'preload must not mount or reveal the bird before a real result exists');
});

test('bird decode gates flash while visual timeline remains independent from API timing', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const bird = await readFile(new URL('../src/components/CanonicalBirdVisual.tsx', import.meta.url), 'utf8');

  assert.match(screen, /shouldEnterQ8Hatching\(stage, eggResponding, quizComplete\)/);
  assert.match(screen, /canBeginHatchFlash\(hatchPhase, hatchMinimumElapsed, hatchReady, birdAssetReady\)/);
  assert.match(screen, /onBirdReady=\{\(\) => setBirdAssetReady\(true\)\}/);
  assert.match(bird, /void image\.decode\(\)\.then\(afterPaint, afterPaint\)/);
  assert.match(bird, /loading="eager"/);
  assert.match(bird, /if \(imageReady\) readyCallback\.current\?\.\(\);/);
});

test('phase CSS keeps shell continuity, uses a soft radial flash and never reveals bird early', async () => {
  const core = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const hotfix = await readFile(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');

  assert.match(core, /\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;/);
  assert.doesNotMatch(
    hotfix,
    /data-hatch-phase="(?:pulse|cracks|flash)"[^\{]*\.lk-quiz-hatch__bird[^\{]*\{[\s\S]*?visibility:\s*visible/,
    'bird cannot become visible during pulse, cracks, or flash',
  );
  assert.match(hotfix, /\.lk-quiz-egg__light-burst\s*\{[\s\S]*?radial-gradient/);
  assert.match(hotfix, /\.lk-quiz-hatch__flash\s*\{[\s\S]*?radial-gradient/);
  assert.doesNotMatch(
    hotfix,
    /\.lk-quiz-hatch__flash\s*\{[\s\S]{0,420}?background:\s*#fff\s*;/,
    'flash must never become the solid white egg seen in production',
  );
  assert.match(hotfix, /data-hatch-phase="flash"[^\{]*\.lk-hatch-halves\s*\{[\s\S]*?opacity:\s*1;/);
  assert.match(hotfix, /data-hatch-phase="flash"[^\{]*\.lk-quiz-egg__light-burst\s*\{[\s\S]*?opacity:\s*\.94;/);
  assert.match(hotfix, /data-hatch-phase="reveal"[^\{]*\.lk-quiz-hatch__frame,[\s\S]*?visibility:\s*visible;/);
  assert.match(hotfix, /data-hatch-phase="reveal"[^\{]*\.lk-quiz-hatch__bird\.lk-canonical-bird\s*\{[\s\S]*?visibility:\s*visible;[\s\S]*?lk-master-bird-reveal/);
});

test('ring, egg and bird use one clipped master geometry instead of a separate circle', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const hotfix = await readFile(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');
  const seal = await readFile(new URL('../src/kontur-hatch-master-frame-final.css', import.meta.url), 'utf8');

  assert.match(
    egg,
    /className="lk-quiz-egg__inner"[\s\S]*?className="lk-quiz-hatch__frame"[\s\S]*?<CanonicalBirdVisual/,
    'bird frame must live inside the same masked inner container as the egg',
  );
  assert.match(hotfix, /\.lk-quiz-egg__inner\s*\{[\s\S]*?inset:\s*8px;[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*50% \/ 46% 46% 54% 54%;/);
  assert.match(hotfix, /\.lk-quiz-egg\.is-hatching \.lk-quiz-egg__ring,[\s\S]*?border-radius:\s*50% \/ 46% 46% 54% 54%;/);
  assert.match(seal, /\.lk-quiz-egg__inner > \.lk-quiz-hatch__frame\s*\{[\s\S]*?width:\s*auto;[\s\S]*?aspect-ratio:\s*auto;[\s\S]*?border-radius:\s*0;/,
    'historical circular frame geometry must be explicitly neutralised');
  assert.match(hotfix, /\.lk-quiz-hatch__bird\.lk-canonical-bird > \.lk-result-bird\s*\{[\s\S]*?object-fit:\s*contain;/);
});

test('soft flash cover is driven by animationend, with timeout only as backup', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const hotfix = await readFile(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');

  assert.match(egg, /event\.animationName !== 'lk-hatch-flash-in'/);
  assert.match(screen, /onFlashCovered=\{beginHatchReveal\}/);
  assert.match(screen, /current === 'flash' \? 'reveal'/);
  assert.match(screen, /timings\.flash \+ 64/);
  assert.match(hotfix, /@keyframes lk-hatch-flash-in[\s\S]*?62%\s*\{\s*opacity:\s*\.92;/);
  assert.match(hotfix, /@keyframes lk-hatch-flash-out[\s\S]*?100%\s*\{\s*opacity:\s*0;/);
});

test('q8 copy and the old reveal-signal are not mounted under the result bird', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(screen, /stage !== 'hatching' && stage !== 'reveal' && question &&/);
  assert.doesNotMatch(screen, /className="lk-reveal-signal"/);
});

test('result copy is normal flow below the master frame, never absolute over the bird', async () => {
  const hotfix = await readFile(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');
  const seal = await readFile(new URL('../src/kontur-hatch-master-frame-final.css', import.meta.url), 'utf8');

  assert.match(
    hotfix,
    /\.lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage\s*\{[\s\S]*?position:\s*relative;[\s\S]*?margin:\s*clamp\(/,
  );
  assert.match(
    hotfix,
    /\.lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline\s*\{[\s\S]*?position:\s*relative;[\s\S]*?margin:\s*24px auto 0;/,
  );
  assert.match(seal, /\.lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline\s*\{[\s\S]*?top:\s*auto;[\s\S]*?bottom:\s*auto;/);
});

test('skip cancels active phase timer and atomically settles the result', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(screen, /const finishHatchReveal = useCallback\(\(\) => \{/);
  assert.match(screen, /window\.clearTimeout\(hatchPhaseTimer\.current\)/);
  assert.match(screen, /setHatchPhase\('settled'\);\s*setStage\('reveal'\);/);
  assert.match(
    screen,
    /stage === 'hatching' && hatchReady && birdAssetReady[\s\S]*?onClick=\{finishHatchReveal\}>пропустить анимацию/,
  );
});

test('reduced motion keeps ordered phases without a normal-speed shake', async () => {
  const core = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.match(core, /lk-hatch-pulse-reduced/);
  assert.match(core, /\.lk-reduced-motion[^\{]*data-hatch-phase="cracks"[^\{]*\.lk-quiz-egg__base\s*\{\s*animation:\s*none !important;/);
  assert.match(core, /data-hatch-phase="flash"[\s\S]*?animation-duration:\s*var\(--lk-hatch-flash/);
  assert.match(core, /data-hatch-phase="reveal"[\s\S]*?animation-duration:\s*var\(--lk-hatch-reveal/);
});

test('Home no longer pulls identity upward into tall crane art', async () => {
  const seal = await readFile(new URL('../src/kontur-hatch-master-frame-final.css', import.meta.url), 'utf8');

  assert.match(seal, /\.lk-home \.lk-bird-stage--home\s*\{[\s\S]*?margin:\s*0 -8px 12px;[\s\S]*?overflow:\s*hidden;/);
  assert.doesNotMatch(seal, /margin:\s*0 -8px -26px/);
  assert.match(seal, /\.lk-home \.lk-identity\s*\{[\s\S]*?margin-top:\s*0;/);
});

test('profile numbers are inert background and refresh has no font glyph', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');

  assert.doesNotMatch(screen, />↻<\/button>/);
  assert.match(screen, /aria-label=\{refreshing \? 'Обновляется' : 'Обновить'\}[\s\S]*?\/>/);
  assert.match(css, /\.lk-home \.lk-hero-index,[\s\S]*?\.lk-home \.lk-section-index\s*\{[\s\S]*?z-index:\s*0;[\s\S]*?opacity:\s*\.07;[\s\S]*?pointer-events:\s*none;/);
});
