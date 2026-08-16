import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BALANCE as C,
  DEFAULT_FEATURES as F,
  balanceSchema,
  featureSchema,
  checkBalanceInvariants,
  decideGrant,
  grantValue,
  dailyGiveBudget,
  isDoubleDay,
  passiveAvailable,
  rollEgg,
  isAnnounceworthy,
  gameDay,
  gameEpochFrom,
  type Coloring,
  type GrantContext,
} from '../src/index.ts';

const base: GrantContext = {
  givenToday: 0,
  gaveToThisPersonToday: false,
  priorGrantsToPerson: 0,
  withReason: false,
  isDoubleDay: false,
};

describe('ценность червяка', () => {
  test('без причины — один, с причиной — два', () => {
    assert.equal(grantValue({ ...base, withReason: false }, C), 1);
    assert.equal(grantValue({ ...base, withReason: true }, C), 2);
  });

  test('с причиной всегда выгоднее — иначе причины никто не напишет', () => {
    assert.ok(
      grantValue({ ...base, withReason: true }, C) >
        grantValue({ ...base, withReason: false }, C),
    );
  });

  test('в пятницу вдвое', () => {
    assert.equal(grantValue({ ...base, withReason: true, isDoubleDay: true }, C), 4);
    assert.equal(grantValue({ ...base, isDoubleDay: true }, C), 2);
  });
});

describe('затухание повторов — защита от взаимного фарма', () => {
  test('второй червяк тому же человеку дешевле первого', () => {
    const first = grantValue({ ...base, withReason: true, priorGrantsToPerson: 0 }, C);
    const second = grantValue({ ...base, withReason: true, priorGrantsToPerson: 1 }, C);
    assert.ok(second < first, `${second} не меньше ${first}`);
  });

  test('дальше падает до нуля', () => {
    const values = [0, 1, 2, 3, 4].map((n) =>
      grantValue({ ...base, withReason: true, priorGrantsToPerson: n }, C),
    );
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i]! <= values[i - 1]!, `выросло на шаге ${i}: ${values}`);
    }
    assert.equal(values[values.length - 1], 0);
  });

  test('исчерпанный лимит на человека отклоняется явной причиной', () => {
    const d = decideGrant({ ...base, withReason: true, priorGrantsToPerson: 9 }, C);
    assert.equal(d.ok, false);
    assert.equal(d.rejection, 'exhausted');
  });
});

describe('суточные лимиты', () => {
  test('бюджет раздачи — три в сутки, в пятницу шесть', () => {
    assert.equal(dailyGiveBudget(false, C), 3);
    assert.equal(dailyGiveBudget(true, C), 6);
  });

  test('исчерпав бюджет, дать нельзя', () => {
    const d = decideGrant({ ...base, givenToday: 3 }, C);
    assert.equal(d.ok, false);
    assert.equal(d.rejection, 'daily_limit');
    assert.equal(d.leftToday, 0);
  });

  test('в пятницу бюджет больше и третий червяк ещё проходит', () => {
    const d = decideGrant({ ...base, givenToday: 3, isDoubleDay: true }, C);
    assert.equal(d.ok, true);
  });

  test('одному человеку не больше одного в сутки', () => {
    const d = decideGrant({ ...base, gaveToThisPersonToday: true }, C);
    assert.equal(d.ok, false);
    assert.equal(d.rejection, 'same_person_today');
  });

  test('успешная раздача уменьшает остаток', () => {
    const d = decideGrant({ ...base, givenToday: 1 }, C);
    assert.equal(d.ok, true);
    assert.equal(d.leftToday, 1);
  });

  test('пятница определяется по границе игровых суток', () => {
    assert.equal(isDoubleDay(new Date('2026-08-07T00:59:59Z')), false);
    assert.equal(isDoubleDay(new Date('2026-08-07T01:00:00Z')), true);
    assert.equal(isDoubleDay(new Date('2026-08-07T12:00:00Z')), true);
    assert.equal(isDoubleDay(new Date('2026-08-08T00:59:59Z')), true);
    assert.equal(isDoubleDay(new Date('2026-08-08T01:00:00Z')), false);
  });
});

describe('пассивный ручеёк', () => {
  test('доступен раз в игровые сутки', () => {
    assert.equal(passiveAvailable(null, 100, C), C.PASSIVE_WORMS_PER_DAY);
    assert.equal(passiveAvailable(99, 100, C), C.PASSIVE_WORMS_PER_DAY);
    assert.equal(passiveAvailable(100, 100, C), 0);
  });

  test('не накапливается за пропущенные дни', () => {
    assert.equal(passiveAvailable(50, 100, C), C.PASSIVE_WORMS_PER_DAY);
  });
});

describe('яйца', () => {
  const pool: Coloring[] = [
    { code: 'c1', title: 'Обычный', rarity: 'common', weight: 70, palette: p() },
    { code: 'r1', title: 'Редкий', rarity: 'rare', weight: 25, palette: p() },
    { code: 'l1', title: 'Легендарный', rarity: 'legendary', weight: 5, palette: p() },
  ];
  function p() {
    return { body: '#1', belly: '#2', wing: '#3', tail: '#4', crest: '#5' };
  }
  function seeded(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  test('всегда возвращает окрас из пула', () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const r = rollEgg(pool, new Set(), C, rng);
      assert.ok(pool.some((c) => c.code === r.coloring.code));
    }
  });

  test('распределение соответствует весам', () => {
    const rng = seeded(777);
    const counts: Record<string, number> = { c1: 0, r1: 0, l1: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollEgg(pool, new Set(), C, rng).coloring.code]!++;

    assert.ok(Math.abs(counts.c1! / N - 0.7) < 0.02, `common ${counts.c1! / N}`);
    assert.ok(Math.abs(counts.r1! / N - 0.25) < 0.02, `rare ${counts.r1! / N}`);
    assert.ok(Math.abs(counts.l1! / N - 0.05) < 0.015, `legendary ${counts.l1! / N}`);
  });

  test('дубль отмечается и компенсируется', () => {
    const owned = new Set(pool.map((c) => c.code));
    const r = rollEgg(pool, owned, C, seeded(3));
    assert.equal(r.duplicate, true);
    assert.equal(r.refund, C.EGG_DUPLICATE_REFUND);
  });

  test('новый окрас не компенсируется', () => {
    const r = rollEgg(pool, new Set(), C, seeded(3));
    assert.equal(r.duplicate, false);
    assert.equal(r.refund, 0);
  });

  test('пустой пул — явная ошибка, а не тихий сбой', () => {
    assert.throws(() => rollEgg([], new Set(), C));
  });

  test('в чат объявляются только редкие и легендарные', () => {
    assert.equal(isAnnounceworthy('common'), false);
    assert.equal(isAnnounceworthy('rare'), true);
    assert.equal(isAnnounceworthy('legendary'), true);
  });
});

describe('игровые сутки', () => {
  const epoch = gameEpochFrom(new Date(Date.UTC(2026, 7, 1)), C);

  test('граница по 04:00 МСК, а не по календарной полуночи', () => {
    const before = gameDay(new Date(Date.UTC(2026, 7, 2, 0, 30)), epoch);
    const after = gameDay(new Date(Date.UTC(2026, 7, 2, 2, 0)), epoch);
    assert.equal(after, before + 1);
  });

  test('внутри одних суток номер не меняется', () => {
    assert.equal(
      gameDay(new Date(Date.UTC(2026, 7, 5, 3, 0)), epoch),
      gameDay(new Date(Date.UTC(2026, 7, 5, 23, 59)), epoch),
    );
  });
});

describe('конфиг', () => {
  test('дефолты валидны', () => {
    assert.doesNotThrow(() => balanceSchema.parse(C));
    assert.doesNotThrow(() => featureSchema.parse(F));
  });

  test('дефолты не нарушают инвариантов', () => {
    assert.deepEqual(checkBalanceInvariants(C), []);
  });

  test('ловится равная цена с причиной и без', () => {
    const broken = { ...C, WORM_VALUE_WITH_REASON: 1 };
    assert.ok(checkBalanceInvariants(broken).some((p) => p.includes('причин')));
  });

  test('ловится неубывающее затухание', () => {
    const broken = { ...C, WORM_REPEAT_FACTORS: [1, 0.25, 0.5] };
    assert.ok(checkBalanceInvariants(broken).some((p) => p.includes('фармить')));
  });

  test('ловится слишком долгое накопление на яйцо пассивом', () => {
    const broken = { ...C, EGG_COST: 500 };
    assert.ok(checkBalanceInvariants(broken).some((p) => p.includes('долго')));
  });

  test('невалидные значения отклоняются', () => {
    assert.throws(() => balanceSchema.parse({ ...C, WORM_GIVE_PER_DAY: 0 }));
    assert.throws(() => balanceSchema.parse({ ...C, WORM_REPEAT_FACTORS: [] }));
  });
});
