import type { BalanceConfig } from './config.js';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/**
 * Номер игрового дня (ТЗ §3).
 *
 * Единственный способ говорить «сутки» во всей системе. Календарные даты
 * сервера в бизнес-логике не используются вообще: игрок, зашедший в 03:00
 * и в 05:00 МСК, иначе получил бы два дня стрика вместо одного.
 *
 * `epochUtcMs` — 01:00 UTC даты старта первого сезона (GAME_EPOCH_UTC).
 */
export function gameDay(now: Date, epochUtcMs: number): number {
  return Math.floor((now.getTime() - epochUtcMs) / DAY_MS);
}

/** Момент начала игрового дня `day` — нужен для таймеров на клиенте. */
export function gameDayStart(day: number, epochUtcMs: number): Date {
  return new Date(epochUtcMs + day * DAY_MS);
}

/**
 * GAME_EPOCH_UTC из даты старта сезона: та же календарная дата,
 * но время — GAME_DAY_START_UTC.
 */
export function gameEpochFrom(seasonStart: Date, cfg: BalanceConfig): number {
  return Date.UTC(
    seasonStart.getUTCFullYear(),
    seasonStart.getUTCMonth(),
    seasonStart.getUTCDate(),
    cfg.GAME_DAY_START_UTC,
  );
}
