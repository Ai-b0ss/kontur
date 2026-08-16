/**
 * Договор новой версии «Контура».
 *
 * Здесь намеренно нет текста вопроса или ответа: черновик остаётся на
 * устройстве, а сервер хранит только выбранный человеком результат и минимум
 * ссылочного контекста.
 */

import type {
  JourneyStatus,
  NestItemStatus,
  ParticipationIntent,
  ParticipationStage,
} from '@kontur/core';

export type {
  JourneyStatus,
  NestItemStatus,
  ParticipationIntent,
  ParticipationStage,
} from '@kontur/core';

export type JourneyOutcome = 'helped' | 'clarify' | 'saved';

export type PilotChatKind = 'general' | 'specialist';

export type JourneyClient = 'desktop' | 'ios' | 'android' | 'web' | 'unknown';
export type JourneyReminderStatus = 'off' | 'pending' | 'sent';

export interface PilotChatDto {
  code: string;
  title: string;
  purpose: string;
  kind: PilotChatKind;
}

export interface ParticipationProfileDto {
  stage: ParticipationStage;
  currentIntent: ParticipationIntent | null;
  startedAt: string;
  updatedAt: string;
}

export interface JourneyDto {
  id: number;
  chatCode: string | null;
  intent: ParticipationIntent;
  status: JourneyStatus;
  /** Ссылка появляется только после явного действия человека в Telegram. */
  messageLink: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NestItemDto {
  id: number;
  journeyId: number;
  label: string;
  status: NestItemStatus;
  messageLink: string | null;
  nextStep: string | null;
  reminderStatus: JourneyReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceV2State {
  version: 'v2';
  chats: PilotChatDto[];
  /** null до первого выбранного намерения. */
  profile: ParticipationProfileDto | null;
  activeJourney: JourneyDto | null;
  nest: NestItemDto[];
}

export interface StartJourneyRequest {
  intent: ParticipationIntent;
  chatCode?: string;
  clientRequestId: string;
  client?: JourneyClient;
}

export interface JourneyPreparedRequest {
  clientRequestId: string;
  client?: JourneyClient;
}

export interface JourneyPublishedRequest {
  chatCode: string;
  /** Telegram message_id. Отсутствует, если клиент не смог вернуть его. */
  messageId?: number;
  clientRequestId: string;
  client?: JourneyClient;
}

export interface JourneyOutcomeRequest {
  outcome: JourneyOutcome;
  clientRequestId: string;
  client?: JourneyClient;
}

export interface JourneyCloseRequest {
  clientRequestId: string;
}

export interface SaveNestItemRequest {
  journeyId: number;
  label: string;
  status: NestItemStatus;
  messageLink?: string;
  nextStep?: string;
  clientRequestId: string;
}

export interface UpdateNextStepRequest {
  nextStep: string | null;
  clientRequestId: string;
}

export interface DeleteNestItemRequest {
  clientRequestId: string;
}

export interface UpdateJourneyReminderRequest {
  enabled: boolean;
  clientRequestId: string;
}

export interface JourneyActionResponse {
  state: ExperienceV2State;
}
