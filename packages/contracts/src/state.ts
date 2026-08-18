import type { Role } from '@kontur/core';

/** Ответ GET /state — единственный источник данных при открытии. */

export interface Palette {
  body: string;
  belly: string;
  wing: string;
  tail: string;
  crest: string;
  beak: string;
}

/** Канонический визуальный результат теста. Роль остаётся пятизначной игровой таксономией. */
export type BirdResultId = 'magpie' | 'woodpecker' | 'jay' | 'crane' | 'owl' | 'kotosov';

export interface PlayerState {
  userId: number;
  username: string | null;
  /** null, пока птица не вылупилась */
  role: Role | null;
  /**
   * Стабильная визуальная идентичность птицы, сохраняемая сервером между
   * WebView/устройствами. Optional только для совместимости со старыми
   * сохранёнными/тестовыми payload; новый сервер после миграции всегда отдаёт поле.
   */
  birdResultId?: BirdResultId | null;
  roleTitle: string | null;
  roleTagline: string | null;
  birdName: string | null;
  coloring: string;
  coloringTitle: string;
  palette: Palette;
  hatchedAt: string | null;
  /** Что на руках — это тратится */
  wallet: number;
  /** Сколько накидали всего — только растёт, по нему рейтинг */
  reputation: number;
  /** Проверенные реальные действия; одно действие = одно золотое перо */
  signalCount: number;
}

export interface GiveState {
  /** Сколько червяков можно раздать сегодня всего */
  budget: number;
  /** Сколько осталось */
  left: number;
  valueWithReason: number;
  valuePlain: number;
}

export interface EggState {
  cost: number;
  affordable: boolean;
  /** Сколько окрасов уже собрано из скольких */
  owned: number;
  total: number;
}

export interface PassiveState {
  available: number;
  collectedToday: boolean;
}

export interface FeatureState {
  eggs: boolean;
  community: boolean;
  passive: boolean;
}

export interface GameState {
  serverTime: string;
  gameDay: number;
  /** Пятница — двойной день */
  isDoubleDay: boolean;
  /** Птица ещё не вылупилась — показываем онбординг и больше ничего */
  hatched: boolean;
  features: FeatureState;
  player: PlayerState;
  give: GiveState;
  egg: EggState | null;
  passive: PassiveState | null;
}
