import type { BalanceConfig } from './config.js';

/**
 * Яйца — гача на внешность (ТЗ).
 *
 * Роль из теста не меняется никогда, меняется только окрас. Роль — это
 * идентичность, её трогать нельзя. По арту так тоже дешевле: нужно
 * пять птиц и палитры, а не сорок разных.
 */

export type Rarity = 'common' | 'rare' | 'legendary';

export interface Coloring {
  code: string;
  title: string;
  rarity: Rarity;
  /** Палитра перекрашивает одну и ту же птицу */
  palette: { body: string; belly: string; wing: string; tail: string; crest: string };
  weight: number;
}

export interface EggResult {
  coloring: Coloring;
  /** Уже был такой окрас — дубль компенсируется червяками */
  duplicate: boolean;
  refund: number;
}

/**
 * Взвешенный ролл. `rng` передаётся аргументом, чтобы функция осталась
 * чистой и тестировалась детерминированно.
 */
export function rollEgg(
  pool: readonly Coloring[],
  owned: ReadonlySet<string>,
  cfg: BalanceConfig,
  rng: () => number = Math.random,
): EggResult {
  if (pool.length === 0) {
    throw new Error('Пустой пул окрасов — нечего разыгрывать');
  }

  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  let pick = rng() * total;

  let coloring = pool[pool.length - 1]!;
  for (const c of pool) {
    if (pick < c.weight) {
      coloring = c;
      break;
    }
    pick -= c.weight;
  }

  const duplicate = owned.has(coloring.code);
  return {
    coloring,
    duplicate,
    refund: duplicate ? cfg.EGG_DUPLICATE_REFUND : 0,
  };
}

/** Редкость, о которой бот объявляет в чат — это бесплатный контент. */
export function isAnnounceworthy(rarity: Rarity): boolean {
  return rarity === 'rare' || rarity === 'legendary';
}

export const RARITY_TITLE: Record<Rarity, string> = {
  common: 'обычный',
  rare: 'редкий',
  legendary: 'легендарный',
};
