import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import type { Role } from '@kontur/core';
import { fitBirdAsset, LOCAL_BIRD_ASSETS, resolveBirdRole } from '../src/components/local-bird-assets.ts';
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

test('asset manifest covers every role and null falls back to owl', () => {
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

test('asset fit never exceeds the product box at supported sizes', () => {
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

test('production WebP assets are valid and stay under the mobile budget', async () => {
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

test('approved quiz and six-result assets are decodable WebP files', async () => {
  const paths = [
    ...Array.from({ length: 8 }, (_, index) => `/quiz/egg-stage-${String(index + 1).padStart(2, '0')}.webp`),
    '/quiz/egg-crack-light.webp',
    ...Object.values(RESULT_ASSETS).map((asset) => asset.src),
  ];
  for (const relativePath of paths) {
    const file = new URL(`../public${relativePath}`, import.meta.url);
    const bytes = await readFile(file);
    assert.ok(bytes.length > 1_000, relativePath);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', relativePath);
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', relativePath);
  }
});
