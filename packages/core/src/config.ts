import { z } from 'zod';

/**
 * Конфигурация баланса.
 *
 * Числа живут в таблице `config`, не в коде: правка баланса — это
 * `update config`, а не деплой. Значения ниже — дефолты для первого посева.
 * Невалидный конфиг не применяется, сервис продолжает работать на предыдущем.
 */
export const balanceSchema = z.object({
  /* ── червяки от людей ─────────────────────────────────────── */

  /** Сколько червяков можно раздать за сутки */
  WORM_GIVE_PER_DAY: z.number().int().positive(),
  /** Червяк с причиной ценнее — так люди сами начнут писать причины */
  WORM_VALUE_WITH_REASON: z.number().int().positive(),
  WORM_VALUE_PLAIN: z.number().int().positive(),
  /** Пятница: во столько раз больше и лимит, и ценность */
  WORM_DOUBLE_DAY_FACTOR: z.number().int().positive(),
  /**
   * Затухание повторов одному человеку за окно недели.
   * Первый элемент — первый червяк, второй — второй и так далее.
   * За пределами массива ценность нулевая: фармить друг друга бессмысленно.
   */
  WORM_REPEAT_FACTORS: z.array(z.number().min(0).max(1)).min(1),
  WORM_REPEAT_WINDOW_DAYS: z.number().int().positive(),

  /** Пассивный ручеёк в кошелёк — страховка от мёртвого старта */
  PASSIVE_WORMS_PER_DAY: z.number().int().min(0),

  /* ── яйца ─────────────────────────────────────────────────── */

  EGG_COST: z.number().int().positive(),
  /** Компенсация за дубль окраса */
  EGG_DUPLICATE_REFUND: z.number().int().min(0),

  /* ── рейтинг ──────────────────────────────────────────────── */

  /**
   * Окно рейтинга в сутках. Именно недельное: при рейтинге за всё время
   * первая пятёрка займёт верх навсегда, и остальные забьют на второй неделе.
   */
  RANK_WINDOW_DAYS: z.number().int().positive(),
  /** Сколько строк отдавать в рейтинге */
  RANK_SIZE: z.number().int().positive(),

  /** Начало игровых суток в UTC. 1 = 01:00 UTC = 04:00 МСК */
  GAME_DAY_START_UTC: z.number().int().min(0).max(23),
});

export type BalanceConfig = z.infer<typeof balanceSchema>;

export const featureSchema = z.object({
  FEATURE_EGGS: z.boolean(),
  FEATURE_COMMUNITY: z.boolean(),
  FEATURE_PASSIVE: z.boolean(),
});

export type FeatureFlags = z.infer<typeof featureSchema>;

export const DEFAULT_BALANCE: BalanceConfig = {
  WORM_GIVE_PER_DAY: 3,
  WORM_VALUE_WITH_REASON: 2,
  WORM_VALUE_PLAIN: 1,
  WORM_DOUBLE_DAY_FACTOR: 2,
  WORM_REPEAT_FACTORS: [1, 0.5, 0.25],
  WORM_REPEAT_WINDOW_DAYS: 7,

  PASSIVE_WORMS_PER_DAY: 8,

  EGG_COST: 20,
  EGG_DUPLICATE_REFUND: 5,

  RANK_WINDOW_DAYS: 7,
  RANK_SIZE: 20,

  GAME_DAY_START_UTC: 1,
};

export const DEFAULT_FEATURES: FeatureFlags = {
  FEATURE_EGGS: true,
  FEATURE_COMMUNITY: true,
  FEATURE_PASSIVE: true,
};

/**
 * Проверки, которые не блокируют запуск, но означают, что баланс поехал.
 */
export function checkBalanceInvariants(c: BalanceConfig): string[] {
  const problems: string[] = [];

  if (c.WORM_VALUE_WITH_REASON <= c.WORM_VALUE_PLAIN) {
    problems.push(
      'Червяк с причиной должен стоить дороже обычного, иначе причины никто не напишет',
    );
  }

  const first = c.WORM_REPEAT_FACTORS[0] ?? 0;
  if (first !== 1) {
    problems.push('Первый червяк человеку за неделю должен идти по полной цене');
  }
  for (let i = 1; i < c.WORM_REPEAT_FACTORS.length; i++) {
    if (c.WORM_REPEAT_FACTORS[i]! > c.WORM_REPEAT_FACTORS[i - 1]!) {
      problems.push('Затухание повторов должно убывать, иначе можно фармить друг друга');
      break;
    }
  }

  // Сколько дней копить на яйцо только пассивом — если слишком долго,
  // гача не заведётся у тех, кому пока никто не кидает
  if (c.PASSIVE_WORMS_PER_DAY > 0) {
    const days = c.EGG_COST / c.PASSIVE_WORMS_PER_DAY;
    if (days > 5) {
      problems.push(
        `Только пассивом яйцо копится ${days.toFixed(1)} дней — слишком долго для первой недели`,
      );
    }
  }

  return problems;
}
