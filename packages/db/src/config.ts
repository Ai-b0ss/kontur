import {
  DEFAULT_BALANCE,
  DEFAULT_FEATURES,
  balanceSchema,
  featureSchema,
  checkBalanceInvariants,
  type BalanceConfig,
  type FeatureFlags,
} from '@kontur/core';
import type { Db } from './driver.js';

/**
 * Конфигурация баланса (ТЗ §6.1).
 *
 * Сервис читает `config` при старте и перечитывает раз в 60 секунд.
 * Правка баланса — это `update config`, а не деплой (I8).
 *
 * Невалидный конфиг НЕ применяется: сервис продолжает работать
 * на предыдущем значении и пишет предупреждение.
 */

const REFRESH_MS = 60_000;

export interface LiveConfig {
  balance: BalanceConfig;
  features: FeatureFlags;
  /** Момент последнего успешного применения */
  loadedAt: Date;
}

export class ConfigStore {
  private current: LiveConfig;
  private timer: NodeJS.Timeout | null = null;

  private constructor(
    private readonly db: Db,
    initial: LiveConfig,
  ) {
    this.current = initial;
  }

  static async create(db: Db): Promise<ConfigStore> {
    const loaded = await readConfig(db);
    const store = new ConfigStore(db, loaded ?? {
      balance: DEFAULT_BALANCE,
      features: DEFAULT_FEATURES,
      loadedAt: new Date(),
    });
    store.timer = setInterval(() => {
      void store.refresh();
    }, REFRESH_MS);
    store.timer.unref?.();
    return store;
  }

  get balance(): BalanceConfig {
    return this.current.balance;
  }

  get features(): FeatureFlags {
    return this.current.features;
  }

  get loadedAt(): Date {
    return this.current.loadedAt;
  }

  async refresh(): Promise<boolean> {
    try {
      const next = await readConfig(this.db);
      if (!next) return false;
      this.current = next;
      return true;
    } catch (e) {
      console.warn('[config] перечитать не удалось, работаем на предыдущем:', e);
      return false;
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

async function readConfig(db: Db): Promise<LiveConfig | null> {
  const rows = await db.query<{ key: string; value: unknown }>(
    'select key, value from config',
  );
  if (rows.length === 0) return null;

  const raw: Record<string, unknown> = {};
  for (const r of rows) raw[r.key] = r.value;

  const balance = balanceSchema.safeParse(raw);
  const features = featureSchema.safeParse(raw);

  if (!balance.success) {
    console.warn('[config] невалидный баланс, не применяю:', balance.error.issues);
    return null;
  }
  if (!features.success) {
    console.warn('[config] невалидные флаги, не применяю:', features.error.issues);
    return null;
  }

  const invariantProblems = checkBalanceInvariants(balance.data);
  for (const problem of invariantProblems) {
    console.warn('[config] инвариант баланса нарушен:', problem);
  }
  if (invariantProblems.length > 0) return null;

  return { balance: balance.data, features: features.data, loadedAt: new Date() };
}

/** Записывает дефолты §6.2, не затирая уже настроенные значения. */
export async function seedConfig(db: Db): Promise<void> {
  const all: Record<string, unknown> = { ...DEFAULT_BALANCE, ...DEFAULT_FEATURES };
  for (const [key, value] of Object.entries(all)) {
    await db.query(
      `insert into config (key, value) values ($1, $2)
       on conflict (key) do nothing`,
      [key, JSON.stringify(value)],
    );
  }
}
