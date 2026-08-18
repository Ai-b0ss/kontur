import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const V84_PRESENTATION = [
  {
    text: 'тебе кинули идею. что первым делом?',
    options: ['пойму, в чем вообще суть', 'попробую сразу собрать', 'накидаю еще вариантов', 'позову кого-нибудь обсудить'],
  },
  {
    text: 'что бесит сильнее?',
    options: ['когда ничего не понятно', 'когда что-то не работает', 'когда всё скучно', 'когда все тупят на месте'],
  },
  {
    text: 'освободился вечер. что скорее сделаешь?',
    options: ['допилю старую штуку', 'начну что-то новое', 'разберусь с накопившимся', 'пойду к людям'],
  },
  {
    text: 'в чате уже полчаса спорят. ты где?',
    options: ['пытаюсь понять, кто о чем', 'кидаю конкретный пример', 'приношу еще одну версию', 'пытаюсь всех собрать'],
  },
  {
    text: 'какой момент самый кайфовый?',
    options: ['когда стало понятно', 'когда заработало', 'когда получилось необычно', 'когда все наконец совпали'],
  },
  {
    text: 'штука уже работает, но кривовато',
    options: ['еще посижу над ней', 'норм, можно двигаться', 'покажу кому-нибудь', 'вернусь потом свежим'],
  },
  {
    text: 'что тебе обычно проще?',
    options: ['разобраться', 'собрать', 'придумать', 'договориться'],
  },
  {
    text: 'завтра дедлайн. готова половина',
    options: ['оставлю только главное', 'дожму сколько успею', 'придумаю обходной путь', 'соберу всех и разрулим'],
  },
] as const;

test('owner hook copy stays short, non-combative and without a system arrow', async () => {
  const source = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');
  const hook = source.match(/<section className="lk-hook-action"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hook, 'hook action section must exist');
  assert.match(hook, /8 вопросов\. Пара минут —[\s\S]*и узнаешь свою птицу\./);
  assert.doesNotMatch(hook, /занудств|не как|↗/i);
  assert.match(hook, />\s*начать\s*<\/button>/);
});

test('local quiz API keeps the exact accepted v84 presentation copy separate from scoring', async () => {
  const source = await readFile(new URL('../../worker/src/local-kontur-api.ts', import.meta.url), 'utf8');
  assert.match(source, /const LOCAL_QUESTIONS = \[/);
  assert.match(source, /questions: LOCAL_QUESTIONS/);

  for (const question of V84_PRESENTATION) {
    assert.match(source, new RegExp(question.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const option of question.options) {
      assert.match(source, new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }

  // Presentation remains a display-only layer. Canonical answers still go to
  // validateAnswers/resolveRole, so indexes and weights stay in @kontur/core.
  assert.match(source, /validateAnswers\(body\.answers\)/);
  assert.match(source, /resolveRole\(body\.answers\)/);
  assert.doesNotMatch(source, /LOCAL_QUESTIONS[\s\S]{0,5000}weights\s*:/);
});
