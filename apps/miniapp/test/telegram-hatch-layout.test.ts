import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quizEgg = readFileSync(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
const hotfix = readFileSync(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('hatch keeps PR22 flash handoff and restores two real shell halves', () => {
  assert.match(quizEgg, /lk-quiz-egg__shell--left/);
  assert.match(quizEgg, /lk-quiz-egg__shell--right/);
  assert.equal((quizEgg.match(/src="\/quiz\/egg-stage-08\.webp"/g) ?? []).length, 2);
  assert.match(quizEgg, /event\.animationName !== 'lk-hatch-flash-in'/);
  assert.match(quizEgg, /onFlashCovered\?\.\(\)/);
  assert.match(hotfix, /data-hatch-phase="cracks"[^}]*lk-quiz-egg__hatch-shells/s);
  assert.match(hotfix, /data-hatch-phase="flash"[^}]*lk-quiz-egg__base[^}]*opacity:\s*0/s);
  assert.match(hotfix, /data-hatch-phase="reveal"[^}]*lk-quiz-egg__hatch-shells/s);
});

test('stale onboarding copy is cancelled synchronously during hatch and reveal', () => {
  assert.match(hotfix, /lk-first-time--hatching[\s\S]*lk-question--egg[\s\S]*animation:\s*none/);
  assert.match(hotfix, /animation:\s*none;[\s\S]*transition:\s*none;/);
  assert.match(hotfix, /pointer-events:\s*none;/);
});

test('short Telegram viewport reserves room between result ring and reveal copy', () => {
  assert.match(hotfix, /@media \(max-height:\s*820px\)/);
  assert.match(hotfix, /lk-first-time--reveal \.lk-quiz-egg-stage\s*\{[\s\S]*top:\s*45%;[\s\S]*width:\s*min\(56vw,\s*230px\)/);

  // Conservative geometry check for an iPhone-like Telegram content viewport.
  // QuizEgg is 1101/1429 wide/high and its progress ring extends 10px past it.
  const viewportWidth = 390;
  const viewportHeight = 760;
  const stageWidth = Math.min(viewportWidth * 0.56, 230);
  const stageHeight = stageWidth * (1429 / 1101);
  const ringBottom = viewportHeight * 0.45 + stageHeight / 2 + 10;
  assert.ok(ringBottom < 510, `short viewport ring bottom is too low: ${ringBottom}`);
});

test('Telegram hotfix is loaded after the other top-level product styles', () => {
  const hotfixIndex = main.indexOf("import './kontur-telegram-hotfix.css';");
  const liveIndex = main.indexOf("import './live-campaign.css';");
  assert.ok(liveIndex >= 0 && hotfixIndex > liveIndex);
});
