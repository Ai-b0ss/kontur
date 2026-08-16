import type { BalanceConfig } from './config.js';
import { HOUR_MS } from './time.js';

/**
 * Червяки от людей (ТЗ: команда /червяк реплаем).
 *
 * Две валюты и их нельзя путать:
 *   репутация — сколько накидали всего, только растёт, по ней рейтинг;
 *   кошелёк   — что на руках, это тратится на яйца.
 * Если сделать одну, люди перестанут тратить, чтобы не терять место в топе,
 * и экономика встанет.
 *
 * Пассивный ручеёк идёт ТОЛЬКО в кошелёк: иначе рейтинг наполнялся бы
 * простым присутствием, а он должен отражать оценку людей.
 */

export type GrantRejection =
  | 'self'
  | 'daily_limit'
  | 'same_person_today'
  | 'exhausted';

export interface GrantContext {
  /** Сколько раздач уже сделано отправителем в этот игровой день */
  givenToday: number;
  /** Давал ли отправитель этому получателю сегодня */
  gaveToThisPersonToday: boolean;
  /** Сколько раз отправитель уже давал этому получателю за окно недели */
  priorGrantsToPerson: number;
  /** Есть ли причина в команде */
  withReason: boolean;
  /** Пятница — двойной день */
  isDoubleDay: boolean;
}

export interface GrantDecision {
  ok: boolean;
  value: number;
  rejection?: GrantRejection;
  /** Сколько раздач останется после этой */
  leftToday: number;
}

export function dailyGiveBudget(
  isDoubleDay: boolean,
  cfg: BalanceConfig,
): number {
  return isDoubleDay
    ? cfg.WORM_GIVE_PER_DAY * cfg.WORM_DOUBLE_DAY_FACTOR
    : cfg.WORM_GIVE_PER_DAY;
}

/**
 * Сколько стоит червяк с учётом причины, пятницы и затухания повторов.
 *
 * Затухание нужно, чтобы двое не фармили друг друга по кругу: второй червяк
 * тому же человеку за неделю стоит вдвое меньше, третий — вчетверо,
 * дальше ноль.
 */
export function grantValue(ctx: GrantContext, cfg: BalanceConfig): number {
  const base = ctx.withReason
    ? cfg.WORM_VALUE_WITH_REASON
    : cfg.WORM_VALUE_PLAIN;

  const multiplied = ctx.isDoubleDay ? base * cfg.WORM_DOUBLE_DAY_FACTOR : base;

  const factors = cfg.WORM_REPEAT_FACTORS;
  const factor = factors[ctx.priorGrantsToPerson] ?? 0;

  return Math.max(0, Math.floor(multiplied * factor));
}

/** Полное решение по команде: можно ли и на сколько. */
export function decideGrant(
  ctx: GrantContext,
  cfg: BalanceConfig,
): GrantDecision {
  const budget = dailyGiveBudget(ctx.isDoubleDay, cfg);
  const leftBefore = Math.max(0, budget - ctx.givenToday);

  if (ctx.gaveToThisPersonToday) {
    return { ok: false, value: 0, rejection: 'same_person_today', leftToday: leftBefore };
  }
  if (leftBefore <= 0) {
    return { ok: false, value: 0, rejection: 'daily_limit', leftToday: 0 };
  }

  const value = grantValue(ctx, cfg);
  if (value <= 0) {
    return { ok: false, value: 0, rejection: 'exhausted', leftToday: leftBefore };
  }

  return { ok: true, value, leftToday: leftBefore - 1 };
}

/**
 * Пятница по дате начала игровых суток.
 *
 * Игровой день начинается не в полночь: до этой границы ещё действуют
 * правила предыдущего дня. Сдвиг перед проверкой не даёт пятничному бонусу
 * включиться раньше смены суток или выключиться до неё.
 */
export function isDoubleDay(now: Date, gameDayStartUtc = 1): boolean {
  return new Date(now.getTime() - gameDayStartUtc * HOUR_MS).getUTCDay() === 5;
}

/**
 * Пассивный ручеёк — страховка от мёртвого старта. Не экономика, а причина
 * открыть приложение в тихий день: копится ровно сутки и не накапливается.
 */
export function passiveAvailable(
  lastCollectedDay: number | null,
  today: number,
  cfg: BalanceConfig,
): number {
  if (lastCollectedDay === today) return 0;
  return cfg.PASSIVE_WORMS_PER_DAY;
}
