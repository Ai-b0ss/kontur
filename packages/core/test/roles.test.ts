import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS,
  ROLES,
  VIBE_THRESHOLD,
  resolveRole,
  validateAnswers,
  type Role,
} from '../src/index.ts';

describe('вопросы теста', () => {
  test('ровно восемь', () => {
    assert.equal(QUESTIONS.length, 8);
  });

  test('у каждого вопроса от трёх до четырёх вариантов', () => {
    for (const q of QUESTIONS) {
      assert.ok(
        q.options.length >= 3 && q.options.length <= 4,
        `«${q.text}»: ${q.options.length} вариантов`,
      );
    }
  });

  test('ни один вариант не пустой', () => {
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        assert.ok(o.text.trim().length > 0);
      }
    }
  });

  test('каждая явная роль достижима хотя бы одним вариантом', () => {
    const reachable = new Set<string>();
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        for (const r of Object.keys(o.weights)) reachable.add(r);
      }
    }
    for (const role of ['designer', 'coder', 'creative', 'manager']) {
      assert.ok(reachable.has(role), `роль ${role} недостижима`);
    }
  });
});

describe('определение роли', () => {
  test('одни и те же ответы всегда дают одну и ту же птицу', () => {
    const answers = [0, 1, 2, 0, 1, 1, 3, 1];
    const a = resolveRole(answers);
    const b = resolveRole(answers);
    assert.equal(a.role, b.role);
    assert.deepEqual(a.scores, b.scores);
  });

  test('последовательный выбор «само рассосётся» даёт скрытую роль', () => {
    // Вариант с максимальным vibe в каждом вопросе
    const answers = QUESTIONS.map((q) => {
      let best = 0;
      q.options.forEach((o, i) => {
        if ((o.vibe ?? 0) > (q.options[best]?.vibe ?? 0)) best = i;
      });
      return best;
    });
    const r = resolveRole(answers);
    assert.equal(r.role, 'vibe');
    assert.ok(r.scores.vibe >= VIBE_THRESHOLD);
  });

  test('Вайбодел не выпадает случайно при обычных ответах', () => {
    // Выбираем всюду вариант без vibe
    const answers = QUESTIONS.map((q) => q.options.findIndex((o) => !o.vibe));
    const r = resolveRole(answers);
    assert.notEqual(r.role, 'vibe');
  });

  test('Вайбодел скрыт, остальные роли объявлены', () => {
    assert.equal(ROLES.vibe.hidden, true);
    for (const role of ['designer', 'coder', 'creative', 'manager'] as Role[]) {
      assert.equal(ROLES[role].hidden, false);
    }
  });

  test('перебор всех комбинаций: каждая роль реально выпадает', () => {
    const seen = new Set<Role>();
    // Полный перебор 4^8 = 65536 слишком много для быстрого теста,
    // берём псевдослучайную выборку с фиксированным зерном
    let s = 12345;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 5000; i++) {
      const answers = QUESTIONS.map((q) =>
        Math.floor(rnd() * q.options.length),
      );
      seen.add(resolveRole(answers).role);
    }
    for (const role of ['designer', 'coder', 'creative', 'manager', 'vibe'] as Role[]) {
      assert.ok(seen.has(role), `роль ${role} не выпала ни разу за 5000 прогонов`);
    }
  });

  test('роль устойчива к пропущенным ответам и не падает', () => {
    assert.doesNotThrow(() => resolveRole([]));
    assert.doesNotThrow(() => resolveRole([99, -1, 0]));
  });
});

describe('валидация ответов', () => {
  test('принимает полный корректный набор', () => {
    assert.ok(validateAnswers(QUESTIONS.map(() => 0)));
  });

  test('отклоняет неполный набор', () => {
    assert.equal(validateAnswers([0, 1, 2]), false);
  });

  test('отклоняет несуществующий вариант', () => {
    const answers = QUESTIONS.map(() => 0);
    answers[3] = 99;
    assert.equal(validateAnswers(answers), false);
  });

  test('отклоняет мусор', () => {
    assert.equal(validateAnswers(null), false);
    assert.equal(validateAnswers('0,1,2'), false);
    assert.equal(validateAnswers(QUESTIONS.map(() => 1.5)), false);
  });
});
