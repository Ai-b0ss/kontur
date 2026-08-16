import { connect, ConfigStore, migrate, seed, type Db } from '@kontur/db';
import { gameDay, gameEpochFrom } from '@kontur/core';
import { env } from './env.js';

/** Общий контекст приложения: БД, живой конфиг, эпоха игровых суток. */
export interface Ctx {
  db: Db;
  config: ConfigStore;
  /** Точка отсчёта игровых суток в UTC */
  epochMs: number;
  gameDay(now: Date): number;
}

/**
 * Эпоха игровых суток. Сезонов больше нет, поэтому точка отсчёта —
 * фиксированная дата: от неё считается номер игрового дня, по которому
 * работают все суточные лимиты.
 */
const DEFAULT_EPOCH = '2026-08-01';

export async function createCtx(): Promise<Ctx> {
  const db = await connect(env.databaseUrl);

  // Порядок важен: конфиг читается из таблицы `config`, а её создаёт миграция
  await migrate(db);
  await seed(db);

  const config = await ConfigStore.create(db);
  const epochMs = gameEpochFrom(
    new Date(env.seasonStart ?? DEFAULT_EPOCH),
    config.balance,
  );

  return {
    db,
    config,
    epochMs,
    gameDay: (now: Date) => gameDay(now, epochMs),
  };
}
