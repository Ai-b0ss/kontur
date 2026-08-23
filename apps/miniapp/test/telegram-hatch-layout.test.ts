import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quizEgg = readFileSync(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');
const hotfix = readFileSync(new URL('../src/kontur-telegram-hotfix.css', import.meta.url), 'utf8');
const finalFrame = readFileSync(new URL('../src/kontur-hatch-master-frame-final.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('hatch keeps PR22 flash handoff and restores two real shell halves', () => {
  assert.match(quizEgg, /lk-hatch-half--left/);
  assert.match(quizEgg, /lk-hatch-half--right/);
  assert.equal((quizEgg.match(/src="\/quiz\/egg-stage-08\.webp"/g) ?? []).length, 2);
  assert.equal((quizEgg.match(/src="\/quiz\/egg-crack-light\.webp"/g) ?? []).length, 1);
  assert.match(quizEgg, /event\.animationName !== 'lk-hatch-flash-in'/);
  assert.match(quizEgg, /onFlashCovered\?\.\(\)/);
  assert.match(hotfix, /data-hatch-phase="cracks"[^}]*lk-hatch-halves/s);
  assert.match(hotfix, /data-hatch-phase="flash"[^}]*lk-quiz-egg__base[^}]*opacity:\s*0/s);
  assert.match(hotfix, /data-hatch-phase="reveal"[^}]*lk-hatch-halves/s);
});

test('stale onboarding copy is cancelled synchronously during hatch and reveal', () => {
  assert.match(hotfix, /lk-first-time--hatching[\s\S]*lk-question--egg[\s\S]*animation:\s*none/);
  assert.match(hotfix, /animation:\s*none;[\s\S]*transition:\s*none;/);
  assert.match(hotfix, /pointer-events:\s*none;/);
});

test('Telegram reveal reserves real master-frame height before result copy', () => {
  assert.match(hotfix, /@media \(max-height:\s*700px\), \(max-width:\s*360px\)/);
  assert.match(hotfix, /lk-quiz-egg\.is-hatching > \.lk-quiz-hatch\s*\{[\s\S]*z-index:\s*18/);
  assert.match(hotfix, /\.lk-quiz-egg \.lk-hatch-half__image\s*\{[\s\S]*filter:\s*none/);

  assert.match(finalFrame, /lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline\s*\{[\s\S]*padding:\s*calc\(50dvh \+ 166px\)/);
  assert.match(finalFrame, /lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage[\s\S]*width:\s*min\(58vw,\s*230px\)/);
  assert.match(finalFrame, /@media \(max-height:\s*700px\), \(max-width:\s*360px\)[\s\S]*lk-first-time\.lk-first-time--reveal \.lk-reveal\.lk-reveal--inline[\s\S]*padding-top:\s*calc\(50dvh \+ 120px\)/);
  assert.match(finalFrame, /@media \(max-height:\s*700px\), \(max-width:\s*360px\)[\s\S]*lk-first-time\.lk-first-time--reveal \.lk-quiz-egg-stage[\s\S]*width:\s*min\(58vw,\s*185px\)/);
});

test('final master-frame seal is loaded after the other top-level product styles', () => {
  const liveIndex = main.indexOf("import './live-campaign.css';");
  const hotfixIndex = main.indexOf("import './kontur-telegram-hotfix.css';");
  const finalIndex = main.indexOf("import './kontur-hatch-master-frame-final.css';");
  assert.ok(liveIndex >= 0 && hotfixIndex > liveIndex);
  assert.ok(finalIndex > hotfixIndex);
});
