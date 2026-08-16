import type { GameState, Palette } from './state.js';
import type { PilotChatDto } from './journey.js';
import type { SignalCardDto } from './actions.js';
import type { Role } from '@kontur/core';

export type RestoredPathKind =
  | 'ask'
  | 'help'
  | 'connect'
  | 'orient'
  | 'opportunity'
  | 'contribution'
  | 'save'
  | 'progress';

export type RestoredActionStatus = 'planned' | 'active' | 'done';
export type RestoredVisibility = 'private' | 'flock';
export type RestoredMotion = 'system' | 'reduced';

export interface RestoredActionDto {
  id: number;
  kind: RestoredPathKind;
  status: RestoredActionStatus;
  title: string;
  note: string | null;
  chatCode: string | null;
  visibility: RestoredVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface RestoredNestItemDto {
  id: number;
  sourceKind: 'action' | 'opportunity' | 'signal' | 'note';
  sourceId: string | null;
  title: string;
  note: string | null;
  nextStep: string | null;
  status: 'active' | 'done';
  createdAt: string;
  updatedAt: string;
}

export interface RestoredOpportunityDto {
  code: string;
  kind: 'grant' | 'project' | 'event' | 'resource';
  title: string;
  description: string;
  actionLabel: string;
}

export interface RestoredConnectionDto {
  actionId: number;
  username: string | null;
  birdName: string | null;
  role: Role | null;
  roleTitle: string | null;
  palette: Palette;
  title: string;
  note: string | null;
  updatedAt: string;
  isMe: boolean;
}

export interface RestoredProgressDto {
  level: number;
  levelTitle: string;
  score: number;
  nextLevelAt: number | null;
  completedKinds: RestoredPathKind[];
  usefulKinds: number;
  collectedSkins: number;
  verifiedSignals: number;
  nextKind: RestoredPathKind | null;
}

export interface RestoredExperienceState {
  version: 'v3';
  serverTime: string;
  game: GameState;
  chats: PilotChatDto[];
  opportunities: RestoredOpportunityDto[];
  actions: RestoredActionDto[];
  nest: RestoredNestItemDto[];
  connections: RestoredConnectionDto[];
  signals: SignalCardDto[];
  progress: RestoredProgressDto;
  preferences: { motion: RestoredMotion };
}

export interface SaveRestoredActionRequest {
  kind: RestoredPathKind;
  status: RestoredActionStatus;
  title: string;
  note?: string;
  chatCode?: string;
  visibility?: RestoredVisibility;
  clientRequestId: string;
}

export interface UpdateRestoredActionRequest {
  status: RestoredActionStatus;
  clientRequestId: string;
}

export interface SaveRestoredNestRequest {
  sourceKind: RestoredNestItemDto['sourceKind'];
  sourceId?: string;
  title: string;
  note?: string;
  nextStep?: string;
  clientRequestId: string;
}

export interface UpdateRestoredNestRequest {
  status: RestoredNestItemDto['status'];
  nextStep?: string;
  clientRequestId: string;
}

export interface UpdateRestoredPreferenceRequest {
  motion: RestoredMotion;
}
