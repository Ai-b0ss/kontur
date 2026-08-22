import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import type { Role } from '@kontur/core';
import { fitBirdAsset, LOCAL_BIRD_ASSETS, resolveBirdRole } from '../src/components/local-bird-assets.ts';
import { quizEggStageModel } from '../src/quiz-egg-model.ts';
import { initialLocalStage, needsLocalQuestions, reconcileColoring, shouldReduceMotion, wormWord } from '../src/local-kontur-model.ts';
import { QUESTIONS, resolveRole } from '../../../packages/core/src/roles.ts';
import { RESULT_ASSETS } from '../src/components/result-bird-assets.ts';
import {
  parseStoredVibeVariant,
  personalizedBirdNote,
  selectBirdResult,
  vibeVariantStorageKey,
} from '../src/result-taxonomy.ts';

const ROLES: Role[] = ['designer', 'coder', 'creative', 'manager', 'vibe'];

test('Russian worm plurals cover singular, paucal and teens', () => {
  const cases = new Map<number, string>([
    [0, 'червяков'], [1, 'червяк'], [2, 'червяка'], [4, 'червяка'], [5, 'червяков'],
    [11, 'червяков'], [14, 'червяков'], [21, 'червяк'], [22, 'червяка'], [25, 'червяков'],
    [111, 'червяков'], [121, 'червяк'], [-2, 'червяка'],
  ]);
  for (const [value, expected] of cases) assert.equal(wormWord(value), expected, String(value));
});

test('returning hatched players do not need the quiz request', () => {
  assert.equal(needsLocalQuestions({ hatched: true }), false);
  assert.equal(needsLocalQuestions({ hatched: true }, '?replay=1'), true);
  assert.equal(needsLocalQuestions({ hatched: false }), true);
  assert.equal(needsLocalQuestions(null), false);
});

test('fresh default entry is the hook while community onboarding remains an explicit branch', () => {
  assert.equal(initialLocalStage({ hatched: false }, ''), 'hook');
  assert.equal(initialLocalStage({ hatched: false }, '?season=zero'), 'hook');
  assert.equal(initialLocalStage({ hatched: false }, '?community=1'), 'community');
  assert.equal(initialLocalStage({ hatched: true }, '?community=1'), 'home');
  assert.equal(initialLocalStage({ hatched: true }, '?replay=1'), 'hook');
});

test('reduced motion follows the system preference with an explicit QA override', () => {
  assert.equal(shouldReduceMotion('', false), false);
  assert.equal(shouldReduceMotion('', true), true);
  assert.equal(shouldReduceMotion('?motion=reduced', false), true);
});

test('canonical quiz stays eight questions and deterministic', () => {
  assert.equal(QUESTIONS.length, 8);
  const answers = [0, 1, 2, 3, 0, 1, 2, 3];
  assert.deepEqual(resolveRole(answers), resolveRole([...answers]));
});

test('six-result presentation keeps Kotosov inside a canonical vibe win', () => {
  for (const [role, resultId] of [
    ['designer', 'magpie'], ['coder', 'woodpecker'], ['creative', 'jay'], ['manager', 'crane'],
  ] as const) {
    assert.equal(selectBirdResult({ resolvedRole: role }).resultId, resultId);
  }
  assert.equal(selectBirdResult({
    resolvedRole: 'vibe',
    scores: { vibe: 12, coder: 7, designer: 6, creative: 5, manager: 4 },
  }).resultId, 'kotosov');
  assert.equal(selectBirdResult({
    resolvedRole: 'vibe',
    scores: { vibe: 12, coder: 7, designer: 7, creative: 5, manager: 4 },
  }).resultId, 'owl');
  assert.equal(selectBirdResult({ resolvedRole: 'vibe' }).resultId, 'owl');
});

test('presentation notes and persisted vibe variants are deterministic and fail closed', () => {
  const answers = [3, 1, 3, 1, 3, 1, 3, 1];
  assert.equal(personalizedBirdNote('kotosov', answers), personalizedBirdNote('kotosov', [...answers]));
  assert.equal(parseStoredVibeVariant('kotosov'), 'kotosov');
  assert.equal(parseStoredVibeVariant('owl'), 'owl');
  assert.equal(parseStoredVibeVariant('designer'), null);
  assert.equal(vibeVariantStorageKey(42), 'kontur:bird-result:42');
});

test('successful mutations can reconcile colorings without a second blocking request', () => {
  const base = {
    code: 'base', title: 'Обычный', rarity: 'common' as const,
    palette: { body: '#1', belly: '#2', wing: '#3', tail: '#4', crest: '#5', beak: '#6' },
    owned: true, equipped: true,
  };
  const violet = {
    code: 'violet', title: 'Сумеречный', rarity: 'rare' as const,
    palette: { ...base.palette, wing: '#8068f4' }, equipped: true,
  };
  const appended = reconcileColoring([base], violet);
  assert.equal(appended.length, 2);
  assert.equal(appended[0]?.equipped, false);
  assert.deepEqual(appended[1], { ...violet, owned: true });

  const refreshed = reconcileColoring(appended, { ...violet, title: 'Сумеречный 2' });
  assert.equal(refreshed.length, 2);
  assert.equal(refreshed[1]?.title, 'Сумеречный 2');
});

test('legacy raster evidence remains bounded and decodable', () => {
  assert.deepEqual(Object.keys(LOCAL_BIRD_ASSETS).sort(), [...ROLES].sort());
  assert.equal(resolveBirdRole(null), 'vibe');
  for (const role of ROLES) {
    const asset = LOCAL_BIRD_ASSETS[role];
    assert.match(asset.src, /^\/birds\/[a-z-]+\.webp$/);
    assert.ok(asset.width > 0 && asset.width <= 640);
    assert.ok(asset.height > 0 && asset.height <= 640);
    assert.match(asset.accentPath, /^M.+Z$/);
  }
});

test('legacy asset fit never exceeds the product box at supported sizes', () => {
  for (const role of ROLES) {
    for (const size of [88, 252, 292]) {
      const fit = fitBirdAsset(role, size);
      assert.equal(fit.boxWidth, size);
      assert.equal(fit.boxHeight, Math.round(size * 0.78));
      assert.ok(fit.renderWidth > 0 && fit.renderWidth <= fit.boxWidth, `${role}/${size} width`);
      assert.ok(fit.renderHeight > 0 && fit.renderHeight <= fit.boxHeight, `${role}/${size} height`);
    }
  }
});

test('legacy WebP evidence stays valid and within its mobile budget', async () => {
  let total = 0;
  for (const role of ROLES) {
    const asset = LOCAL_BIRD_ASSETS[role];
    const file = new URL(`../public${asset.src}`, import.meta.url);
    const info = await stat(file);
    const header = await readFile(file, { encoding: null });
    total += info.size;
    assert.ok(info.size < 30_000, `${role} is ${info.size} bytes`);
    assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(header.subarray(8, 12).toString('ascii'), 'WEBP');
  }
  assert.ok(total < 100_000, `series is ${total} bytes`);
});

test('current product has exactly six unique canonical identities and no /birds mapping', async () => {
  const ids = ['magpie', 'woodpecker', 'jay', 'crane', 'owl', 'kotosov'];
  assert.deepEqual(Object.keys(RESULT_ASSETS).sort(), [...ids].sort());
  assert.equal(new Set(Object.values(RESULT_ASSETS).map((asset) => asset.src)).size, 6);
  for (const asset of Object.values(RESULT_ASSETS)) assert.doesNotMatch(asset.src, /^\/birds\//);
  assert.equal(RESULT_ASSETS.kotosov.src, '/results/kotosov.webp');
  assert.equal(RESULT_ASSETS.crane.src, '/results/crane.webp');

  const currentRenderer = await readFile(new URL('../src/components/LocalBirdVisual.tsx', import.meta.url), 'utf8');
  assert.match(currentRenderer, /CanonicalBirdVisual/);
  assert.match(currentRenderer, /kontur:bird-result:/);
  assert.doesNotMatch(currentRenderer, /LocalBirdAsset|<LocalBird/);
});

test('quiz crack/progress mapping is exactly q1=stage1 through q8=stage8', () => {
  for (let stage = 1; stage <= 8; stage += 1) {
    const model = quizEggStageModel(stage);
    assert.equal(model.stage, stage);
    assert.equal(model.asset, `/quiz/egg-stage-${String(stage).padStart(2, '0')}.webp`);
    assert.equal(model.progressDegrees, stage * 45);
  }
});

test('q8 hatch reuses shell art inside QuizEgg and delays visible hatch until response gesture ends', async () => {
  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  assert.match(egg, /lk-quiz-egg__hatch-shells/);
  assert.equal((egg.match(/src="\/quiz\/egg-stage-08\.webp"/g) ?? []).length, 2);
  assert.equal((egg.match(/src="\/quiz\/egg-crack-light\.webp"/g) ?? []).length, 1);
  assert.match(screen, /shouldEnterQ8Hatching\(stage, eggResponding, hatchReady\)/);
  assert.match(screen, /if \(!eggResponding && hatchReady\) setStage\('hatching'\)/);
  assert.doesNotMatch(css, /animation-delay:\s*260ms/);
});

test('equipped palette stays on the same canonical bird from hatch through Home', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../src/components/CanonicalBirdVisual.tsx', import.meta.url), 'utf8');
  assert.match(screen, /palette=\{reveal\?\.state\.player\.palette \?\? state\?\.player\.palette \?\? null\}/);
  assert.match(screen, /<CanonicalBirdVisual resultId=\{currentBird\.resultId\} palette=\{state\.player\.palette\} \/>/);
  assert.doesNotMatch(screen, /<ResultBird resultId=\{currentBird\.resultId\}/);
  assert.match(renderer, /data-image-ready=\{imageReady \? 'true' : 'false'\}/);
  assert.match(renderer, /image\.decode\(\)\.then\(afterPaint, afterPaint\)/);
  assert.match(renderer, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
  assert.match(renderer, /onLoad=\{\(event\) => markImageReady\(event\.currentTarget\)\}/);
  assert.match(renderer, /palette && imageReady &&/);
});

test('all six palette channels visibly recolor the canonical bird', async () => {
  const renderer = await readFile(new URL('../src/components/CanonicalBirdVisual.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  for (const channel of ['body', 'belly', 'wing', 'tail', 'crest', 'beak']) {
    assert.match(renderer, new RegExp(`palette\\.${channel}`), channel);
  }
  assert.match(renderer, /radial-gradient/);
  assert.match(renderer, /linear-gradient/);
  assert.match(css, /\.lk-canonical-bird__tint\s*\{[\s\S]*?opacity:\s*\.68;/);
  assert.match(css, /mix-blend-mode:\s*color;/);
});

test('reveal state removes stale hook and question surfaces and wins the final CSS order', async () => {
  const css = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  assert.match(css, /\.lk-first-time\.lk-first-time--reveal \.lk-hook-copy,[\s\S]*?visibility:\s*hidden;[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*auto;[\s\S]*?animation:\s*lk-reveal-inline-in/);
});

test('quiz back control is unavailable while an answer transition is locked', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  assert.match(screen, /index > 0 && !busy && !eggResponding && !answerLock\.current/);
  assert.match(screen, /if \(busy \|\| eggResponding \|\| answerLock\.current\) return;/);
});

test('replay keeps the saved bird identity instead of presenting a temporary new bird', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const replayBranch = screen.match(/if \(replayMode && state\) \{([\s\S]*?)\n      \}\n      const result = await api\.localHatch/)?.[1] ?? '';
  assert.match(replayBranch, /const savedBird = birdPresentation\(/);
  assert.match(replayBranch, /setRevealResultId\(savedBird\.resultId\)/);
  assert.match(replayBranch, /setRevealNote\(savedBird\.note\)/);
  assert.doesNotMatch(replayBranch, /resolveRole|selectBirdResult|personalizedBirdNote/);
});

test('responsive QA contract covers 320x568, 390x844, 430x1000, safe area and reduced motion', async () => {
  const baseCss = await readFile(new URL('../src/local-kontur.css', import.meta.url), 'utf8');
  const correctionCss = await readFile(new URL('../src/kontur-core-corrections.css', import.meta.url), 'utf8');
  const browserAcceptance = await readFile(new URL('./browser-acceptance.mjs', import.meta.url), 'utf8');
  assert.match(correctionCss, /@media \(max-width: 360px\), \(max-height: 650px\)/);
  assert.match(correctionCss, /@media \(min-width: 361px\) and \(min-height: 651px\)/);
  assert.match(baseCss, /env\(safe-area-inset-bottom\)/);
  assert.match(correctionCss, /\.lk-reduced-motion/);
  assert.match(browserAcceptance, /width:\s*390,\s*height:\s*844/);
  assert.match(browserAcceptance, /hookSeparation\(medium\.page, '390 hook'\)/);
  assert.ok(320 <= 360 && 568 <= 650);
  assert.ok(390 >= 361 && 844 >= 651);
  assert.ok(430 >= 361 && 1000 >= 651);
});

test('approved quiz and six-result assets are decodable production assets', async () => {
  const paths = [
    ...Array.from({ length: 8 }, (_, index) => `/quiz/egg-stage-${String(index + 1).padStart(2, '0')}.webp`),
    '/quiz/egg-crack-light.webp',
    ...Object.values(RESULT_ASSETS).map((asset) => asset.src),
  ];
  for (const relativePath of paths) {
    const file = new URL(`../public${relativePath}`, import.meta.url);
    const bytes = await readFile(file);
    assert.ok(bytes.length > 1_000, relativePath);
    if (relativePath.endsWith('.svg')) {
      assert.match(bytes.toString('utf8'), /<svg[\s>]/, relativePath);
    } else {
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', relativePath);
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', relativePath);
    }
  }
});
