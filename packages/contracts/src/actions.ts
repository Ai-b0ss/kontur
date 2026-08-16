import type { Rarity, Role } from '@kontur/core';
import type { GameState, Palette } from './state.js';

/** Запросы и ответы действий. */

export interface WithState {
  state: GameState;
}

/* ─── онбординг ─────────────────────────────────────────────── */

export interface QuestionDto {
  text: string;
  options: string[];
}

export interface QuestionsResponse {
  questions: QuestionDto[];
}

export interface HatchRequest {
  answers: number[];
  birdName?: string;
  clientRequestId: string;
}

export interface HatchResponse extends WithState {
  role: Role;
  roleTitle: string;
  roleTagline: string;
  coloring: string;
  coloringTitle: string;
  palette: Palette;
  /** Готовый текст, которым можно похвастаться в чат */
  shareText: string;
}

/* ─── червяки ───────────────────────────────────────────────── */

export interface PassiveCollectResponse extends WithState {
  collected: number;
}

export interface NestEntry {
  kind: 'grant' | 'visit';
  at: string;
  /** Кто кинул или кто заходил */
  fromUserId: number;
  fromUsername: string | null;
  amount?: number;
  reason?: string | null;
}

export interface NestResponse {
  entries: NestEntry[];
  /** Сколько получено за окно рейтинга */
  weeklyReceived: number;
}

/* ─── яйца ──────────────────────────────────────────────────── */

export interface EggOpenResponse extends WithState {
  coloring: string;
  coloringTitle: string;
  rarity: Rarity;
  palette: Palette;
  duplicate: boolean;
  refund: number;
  /** Текст для похвальбы в чат, если окрас редкий */
  shareText: string | null;
}

export interface ColoringDto {
  code: string;
  title: string;
  rarity: Rarity;
  palette: Palette;
  owned: boolean;
  equipped: boolean;
}

export interface ColoringsResponse {
  colorings: ColoringDto[];
}

export interface EquipRequest {
  code: string;
}

/* ─── мост в реальность ────────────────────────────────────── */

export type SignalKind = 'cu_event' | 'agency_case' | 'own_project';

export interface SignalCardDto {
  id: number;
  kind: SignalKind;
  title: string;
  issuedAt: string;
}

export interface SignalsResponse {
  /** Одно подтверждённое реальное действие = одно золотое перо. */
  feathers: number;
  cards: SignalCardDto[];
}

/* ─── сообщество ────────────────────────────────────────────── */

export interface FlockMember {
  /** Место в полном рейтинге, даже если строка добавлена после топа */
  position: number;
  userId: number;
  username: string | null;
  birdName: string | null;
  role: Role | null;
  roleTitle: string | null;
  coloring: string;
  palette: Palette;
  /** Репутация за окно рейтинга — именно недельная, не за всё время */
  weekly: number;
  /** Репутация за всё время */
  total: number;
  /** Нефармящийся статус за проверенные реальные действия */
  signals: number;
  isMe: boolean;
}

export interface CommunityResponse {
  /** Рейтинг за неделю: за всё время первая пятёрка заняла бы верх навсегда */
  ranking: FlockMember[];
  myPosition: number;
  totalInFlock: number;
  windowDays: number;
}
