import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quizEgg = readFileSync(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
const hotfix = readFileSync(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');
const finalFrame = readFileSync(new URL('../src/kontur-hatch-master-frame-final.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('hatch removes split shell DOM and uses the radial gacha handoff', () => {
  assert.doesNotMatch(quizEgg, /lk-hatch-half--left/);
  assert.doesNotMatch(quizEgg, /lk-hatch-half--right/);
  assert.doesNotMatch(quizEgg, /egg-crack-light\.webp/);
  assert.match(quizEgg, /event\.animationName !== 'lk-gacha-flash-burst'/);
  assert.match(quizEgg, /onFlashCovered\?\.\(\)/);

  assert.match(finalFrame, /\.lk-hatch-halves,[\s\S]*display:\s*none\s*!important/);
  assert.match(finalFrame, /@keyframes lk-gacha-shake/);
  assert.match(finalFrame, /radial-gradient\(/);
  assert.match(finalFrame, /@keyframes lk-gacha-flash-burst/);
  assert.match(finalFrame, /@keyframes lk-gacha-bird-spring/);
  assert.match(finalFrame, /scale\(\.5\)/);
  assert.match(finalFrame, /scale\(1\.05\)/);
});

test('flash remains covered across the flash to reveal state swap', () => {
  assert.match(
    finalFrame,
    /@keyframes lk-gacha-flash-burst\s*\{[\s\S]*100%\s*\{\s*opacity:\s*1;/,
  );
  assert.match(
    finalFrame,
    /data-hatch-phase="reveal"\]\s+\.lk-quiz-hatch__flash\s*\{[\s\S]*animation:\s*lk-gacha-flash-out/,
  );
  assert.match(finalFrame, /@keyframes lk-gacha-flash-out/);
});

test('stale onboarding copy is cancelled synchronously during hatch and reveal', () => {
  assert.match(hotfix, /lk-first-time--hatching[\s\S]*lk-question--egg[\s\S]*animation:\s*none/);
  assert.match(hotfix, /animation:\s*none;[\s\S]*transition:\s*none;/);
  assert.match(hotfix, /pointer-events:\s*none;/);
});

test('Telegram reveal reserves the master-frame height before result copy', () => {
  assert.match(finalFrame, /lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline\s*\{[\s\S]*padding:\s*calc\(50dvh \+ 160px\)/);
  assert.match(finalFrame, /lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage[\s\S]*width:\s*min\(61vw,\s*248px\)/);
  assert.match(finalFrame, /\.lk-quiz-egg__inner > \.lk-quiz-hatch__frame\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(finalFrame, /\.lk-quiz-egg__inner > \.lk-quiz-hatch__frame\s*\{[\s\S]*border-radius:\s*48%\s*\/\s*50%/);
  assert.match(finalFrame, /@media \(max-height:\s*700px\), \(max-width:\s*360px\)[\s\S]*lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline[\s\S]*padding-top:\s*calc\(50dvh \+ 116px\)/);
  assert.match(finalFrame, /@media \(max-height:\s*700px\), \(max-width:\s*360px\)[\s\S]*lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage[\s\S]*width:\s*min\(58vw,\s*185px\)/);
});

test('final gacha seal is loaded after the other top-level product styles', () => {
  const liveIndex = main.indexOf("import './live-campaign.css';");
  const hotfixIndex = main.indexOf("import './kontur-telegram-hotfix.css';");
  const finalIndex = main.indexOf("import './kontur-hatch-master-frame-final.css';");
  assert.ok(liveIndex >= 0 && hotfixIndex > liveIndex);
  assert.ok(finalIndex > hotfixIndex);
});
