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

test('skip finishes the same hatch scene and cancels the pending reveal timer', async () => {
  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');

  assert.match(screen, /const finishHatchReveal = \(\) => \{/);
  assert.match(screen, /if \(hatchTimer\.current\) window\.clearTimeout\(hatchTimer\.current\);/);
  assert.match(screen, /setStage\('reveal'\);/);
  assert.match(screen, /onClick=\{finishHatchReveal\}>пропустить анимацию<\/button>/);
});
