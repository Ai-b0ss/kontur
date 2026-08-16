import {
  DEFAULT_BALANCE as C,
  QUESTIONS,
  ROLES,
  checkBalanceInvariants,
  dailyGiveBudget,
  decideGrant,
  grantValue,
  resolveRole,
  type Role,
} from '@kontur/core';

/**
 * Отчёт по балансу новой экономики.
 *
 * Читает те же формулы, что и прод, а не копию — это единственный способ
 * править числа осмысленно.
 */

console.log('Баланс «Контура»\n');

const problems = checkBalanceInvariants(C);
console.log(
  problems.length ? 'ПРОБЛЕМЫ:\n  ' + problems.join('\n  ') : 'Инварианты в порядке',
);

/* ── сколько червяков ходит по стае ─────────────────────────── */

console.log('\nОборот червяков');
for (const size of [30, 100, 200]) {
  // Худший случай: каждый раздал всё, что мог, разным людям
  const perDay = size * C.WORM_GIVE_PER_DAY * C.WORM_VALUE_WITH_REASON;
  const perDayFriday = size * dailyGiveBudget(true, C) * grantValue(
    {
      givenToday: 0,
      gaveToThisPersonToday: false,
      priorGrantsToPerson: 0,
      withReason: true,
      isDoubleDay: true,
    },
    C,
  );
  const eggsPerDay = perDay / C.EGG_COST;
  console.log(
    `  ${String(size).padStart(3)} чел · потолок ${String(perDay).padStart(5)}/сут` +
      ` (пт ${String(perDayFriday).padStart(5)})` +
      ` → до ${eggsPerDay.toFixed(0)} яиц в день на всю стаю`,
  );
}

/* ── за сколько копится яйцо ────────────────────────────────── */

console.log('\nСколько копить на яйцо');
const passiveOnly = C.EGG_COST / C.PASSIVE_WORMS_PER_DAY;
console.log(`  только пассивом:        ${passiveOnly.toFixed(1)} дн`);
for (const received of [1, 2, 4]) {
  const perDay = C.PASSIVE_WORMS_PER_DAY + received * C.WORM_VALUE_WITH_REASON;
  console.log(
    `  пассив + ${received} червяка в день: ${(C.EGG_COST / perDay).toFixed(1)} дн`,
  );
}

/* ── затухание повторов ─────────────────────────────────────── */

console.log('\nЦенность повторных червяков одному человеку за неделю');
for (let n = 0; n < 5; n++) {
  const d = decideGrant(
    {
      givenToday: 0,
      gaveToThisPersonToday: false,
      priorGrantsToPerson: n,
      withReason: true,
      isDoubleDay: false,
    },
    C,
  );
  console.log(
    `  ${n + 1}-й: ${d.ok ? `${d.value}` : `отказ (${d.rejection})`}`,
  );
}

/* ── распределение ролей ────────────────────────────────────── */

console.log('\nРаспределение ролей на случайных ответах');
let s = 20260801;
const rnd = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};

const counts: Record<Role, number> = {
  designer: 0, coder: 0, creative: 0, manager: 0, vibe: 0,
};
const N = 20000;
for (let i = 0; i < N; i++) {
  const answers = QUESTIONS.map((q) => Math.floor(rnd() * q.options.length));
  counts[resolveRole(answers).role]++;
}

for (const [role, n] of Object.entries(counts)) {
  const share = (n / N) * 100;
  const bar = '█'.repeat(Math.round(share / 2));
  console.log(
    `  ${ROLES[role as Role].title.padEnd(12)} ${share.toFixed(1).padStart(5)}%  ${bar}`,
  );
}

const rare = (counts.vibe / N) * 100;
console.log(
  `\nВайбодел выпадает в ${rare.toFixed(1)}% случаев ` +
    (rare > 3 && rare < 20 ? '— нормально для скрытой роли' : '— НАДО ПРАВИТЬ ПОРОГ'),
);
