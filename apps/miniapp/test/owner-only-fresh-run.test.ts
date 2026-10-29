import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { initialLocalStage, needsLocalQuestions, ownerOnlyFreshRun } from '../src/local-kontur-model.ts';

const owner = { hatched: true, player: { username: 'fff6pm' } };
const ownerAt = { hatched: true, player: { username: '@FFF6PM' } };
const other = { hatched: true, player: { username: 'fff6dm' } };

test('only the authenticated owner username is forced into a fresh run', () => {
  assert.equal(ownerOnlyFreshRun(owner), true);
  assert.equal(ownerOnlyFreshRun(ownerAt), true);
  assert.equal(ownerOnlyFreshRun(other), false);
  assert.equal(ownerOnlyFreshRun({ hatched: true, player: { username: null } }), false);
});

test('owner always needs questions and enters the hook even when already hatched', () => {
  assert.equal(needsLocalQuestions(owner), true);
  assert.equal(initialLocalStage(owner), 'hook');
  assert.equal(initialLocalStage(owner, '?community=1'), 'hook');
  assert.equal(initialLocalStage(other), 'home');
});

test('owner hatch is an in-memory recalculation before the normal replay/server branches', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const ownerIndex = screen.indexOf('if (ownerMode && state)');
  const replayIndex = screen.indexOf('if (replayMode && state)');
  const serverIndex = screen.indexOf('const result = await api.localHatch(finalAnswers)');
  assert.ok(ownerIndex >= 0, 'owner branch missing');
  assert.ok(replayIndex > ownerIndex, 'owner branch must run before normal replay');
  assert.ok(serverIndex > replayIndex, 'server hatch must remain the non-owner path');
  const ownerBranch = screen.slice(ownerIndex, replayIndex);
  assert.match(ownerBranch, /resolveRole\(finalAnswers\)/);
  assert.match(ownerBranch, /ROLES\[localResult\.role\]/);
  assert.match(ownerBranch, /setState\(previewState\)/);
  assert.match(ownerBranch, /setReveal\(\{ state: previewState \}\)/);
  assert.doesNotMatch(ownerBranch, /api\.localHatch|api\.localEquip|api\.localOpenEgg/);
});

test('owner mode blocks persistent Home mutations and recomputes same-session replay', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  assert.match(screen, /if \(ownerMode \|\| !state\?\.egg\?\.affordable/);
  assert.match(screen, /const equip = async \(code: string\) => \{\s*if \(ownerMode \|\| !beginAction\(\)\) return;/);
  assert.match(screen, /if \(ownerMode\) return;\s*setError\(null\);\s*try \{\s*await refresh\(\)/);
  assert.match(screen, /setReplayMode\(!ownerMode\)/);
  assert.match(screen, /disabled=\{busy \|\| refreshing \|\| ownerMode\}/);
});
