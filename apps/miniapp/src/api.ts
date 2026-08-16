import type {
  ColoringsResponse,
  CommunityResponse,
  EggOpenResponse,
  ExperienceV2State,
  GameState,
  HatchResponse,
  NestResponse,
  PassiveCollectResponse,
  QuestionsResponse,
  SignalsResponse,
  JourneyClient,
  JourneyOutcome,
  NestItemStatus,
  ParticipationIntent,
  RestoredActionStatus,
  RestoredExperienceState,
  RestoredMotion,
  RestoredNestItemDto,
  SaveRestoredActionRequest,
  SaveRestoredNestRequest,
} from '@kontur/contracts';
import type {
  LiveCampaignAction,
  LiveCampaignBird,
  LiveCampaignCardKind,
  LiveCampaignItemKind,
  LiveCampaignSectorState,
} from '@kontur/core';
import { getInitData } from './telegram.js';

const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';
const BASE_V1 = API_ORIGIN + '/api/v1';
const BASE_V2 = API_ORIGIN + '/api/v2';
const BASE_V3 = API_ORIGIN + '/api/v3';
const BASE_V4 = API_ORIGIN + '/api/v4';
const BASE_V5 = API_ORIGIN + '/api/v5';
const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class OfflineError extends Error {
  constructor() {
    super('Нет связи');
  }
}

let token: string | null = null;
let serverSkewMs = 0;
let authSource = 'direct';

export function serverNow(): Date {
  return new Date(Date.now() + serverSkewMs);
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown; auth?: boolean; base?: string },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init?.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${init?.base ?? BASE_V1}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError('TIMEOUT', 'Сервер отвечает слишком долго');
    }
    throw new OfflineError();
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Не-JSON — это страница ошибки прокси, а не наш ответ
      body = {};
    }
  }

  if (!res.ok) {
    const err = body.error as { code?: string; message?: string; details?: Record<string, unknown> } | undefined;
    // 5xx без нашего тела ошибки означает, что до API не доехали
    if (!err && res.status >= 500) {
      throw new ApiError('SERVER_DOWN', 'Сервер не отвечает');
    }
    throw new ApiError(err?.code ?? 'UNKNOWN', err?.message ?? `Ошибка ${res.status}`, err?.details);
  }

  const stamp =
    (body as { serverTime?: string }).serverTime ??
    (body as { state?: { serverTime?: string } }).state?.serverTime;
  if (stamp) serverSkewMs = new Date(stamp).getTime() - Date.now();

  return body as T;
}

async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
      await authenticate(authSource);
      return fn();
    }
    throw e;
  }
}

export async function authenticate(source = 'direct'): Promise<GameState> {
  const res = await call<{ token: string; state: GameState }>('/auth/telegram', {
    method: 'POST',
    body: { initData: getInitData(), source },
    auth: false,
  });
  token = res.token;
  authSource = source;
  return res.state;
}

const rid = () => crypto.randomUUID();
const v2 = <T>(path: string, init?: { method?: string; body?: unknown }) =>
  call<T>(path, { ...init, base: BASE_V2 });
const v3 = <T>(path: string, init?: { method?: string; body?: unknown }) =>
  call<T>(path, { ...init, base: BASE_V3 });
const v4 = <T>(path: string, init?: { method?: string; body?: unknown }) =>
  call<T>(path, { ...init, base: BASE_V4 });
const v5 = <T>(path: string, init?: { method?: string; body?: unknown }) =>
  call<T>(path, { ...init, base: BASE_V5 });


export interface LocalKonturStateResponse {
  state: GameState;
  colorings: ColoringsResponse['colorings'];
}

export type ZeroSeasonBird = 'woodpecker' | 'magpie' | 'owl' | 'crane';
export type ZeroSeasonIntent = 'attack' | 'shield' | 'scout';
export interface ZeroSeasonFlight {
  id: number;
  intent: ZeroSeasonIntent;
  nest: number;
  status: 'open' | 'ready';
  members: number;
}
export interface ZeroSeasonLastRound {
  gameDay: number;
  actions: Partial<Record<ZeroSeasonBird, { intent: ZeroSeasonIntent; nest: number; votes: number }>>;
}
export interface ZeroSeasonCore {
  hatched: boolean;
  wallet: number;
  reputation: number;
  coloringTitle: string | null;
  birdName: string | null;
  roleTitle: string | null;
}

export interface ZeroSeasonState {
  gameDay: number;
  season: { number: number; day: number; daysLeft: number };
  profile: { bird: ZeroSeasonBird; scores: Record<ZeroSeasonBird, number>; joinedAt: string } | null;
  activeBird: ZeroSeasonBird | null;
  board: { nests: Array<ZeroSeasonBird | null>; shields: number[]; marks: number[] };
  eggs: number;
  /** True when the user already finished today's series (reload-safe). */
  actionTaken: boolean;
  flight: ZeroSeasonFlight | null;
  lastRound: ZeroSeasonLastRound | null;
  forecast: { bird: ZeroSeasonBird; status: 'pending' | 'won' | 'lost' | 'void' } | null;
  paths: Array<{ bird: ZeroSeasonBird; mastery: number; rank: 'rookie' | 'field' | 'crown' }>;
  /** Classic V1 worm/wallet identity when profiles+wallets rows exist. */
  core?: ZeroSeasonCore;
}
export interface ZeroSeasonPublicQuestion { id: string; prompt: string; options: string[] }

/**
 * V5 is intentionally not represented by the legacy GameState. Its data is
 * scoped to a separately registered campaign chat and is only fetched after
 * `authenticate('campaign-v5')`.
 */
export type LiveCampaignEventStatus = 'scheduled' | 'open' | 'locked' | 'resolved';
export type LiveCampaignItemStatus = 'owned' | 'armed' | 'consumed';
export type LiveCampaignForecastStatus = 'pending' | 'won' | 'lost' | 'void';

export interface LiveCampaignBirdDto {
  bird: LiveCampaignBird;
  form: 1 | 2;
  feathers: number;
}

export interface LiveCampaignActiveBirdDto extends LiveCampaignBirdDto {
  locked: boolean;
  signatureAvailable: boolean;
}

export interface LiveCampaignSectorDto {
  id: number;
  state: LiveCampaignSectorState;
  ward: boolean;
  progress: number;
  threshold: number;
}

export interface LiveCampaignInventoryDto {
  id: number;
  kind: LiveCampaignItemKind;
  status: LiveCampaignItemStatus;
  name: string;
  effect: string;
}

export interface LiveCampaignForecastOption {
  sectorId: number;
  action: LiveCampaignAction;
  label: string;
}

/** The server exposes the only legal map move for this event. */
export interface LiveCampaignObjectiveDto extends LiveCampaignForecastOption {
  progress: number;
  threshold: number;
  itemKinds: LiveCampaignItemKind[];
}

export interface LiveCampaignForecastDto {
  sectorId: number;
  action: LiveCampaignAction;
  prediction: 'sector_resolves' | 'sector_misses';
  status: LiveCampaignForecastStatus;
}

export interface LiveCampaignRaidDto {
  id: number;
  status: 'queued' | 'ready' | 'resolved' | 'dissolved';
  sectorId: number;
  action: LiveCampaignAction;
  members: number;
  joined: boolean;
  roles: Partial<Record<LiveCampaignAction, boolean>>;
  closeAt?: string;
  cards?: LiveCampaignCardDto[];
}

export interface LiveCampaignCardDto {
  id: string;
  kind: LiveCampaignCardKind;
  prompt: string;
  options: string[];
  hint?: string;
}

export interface LiveCampaignSessionDto {
  id: number;
  eventId: number;
  sectorId: number;
  action: LiveCampaignAction;
  closeAt: string;
  cards: LiveCampaignCardDto[];
}

export interface LiveCampaignLastResultDto {
  eventId: number;
  evidenceScore: number;
  contribution: 0 | 1 | 2;
  featherAwarded: boolean;
  itemAwarded?: string | null;
  sectorProgress: number;
  threshold: number;
}

export interface LiveCampaignState {
  serverTime: string;
  campaign: {
    id: number;
    title?: string;
    day: number;
    daysLeft: number;
    status: 'draft' | 'armed' | 'active' | 'paused' | 'resolved';
  };
  profile: {
    baseBird: LiveCampaignBird;
    scores: Record<LiveCampaignBird, number>;
  } | null;
  eggs: number;
  birds: LiveCampaignBirdDto[];
  activeBird: LiveCampaignActiveBirdDto | null;
  sectors: LiveCampaignSectorDto[];
  event: {
    id: number;
    status: LiveCampaignEventStatus;
    opensAt: string;
    closesAt: string;
    forecastDeadline: string;
    actionTaken: boolean;
    storm: { revealed: boolean; targetSector: number | null } | null;
    objective: LiveCampaignObjectiveDto | null;
    forecastOptions: LiveCampaignForecastOption[];
    raid: LiveCampaignRaidDto | null;
  } | null;
  inventory: LiveCampaignInventoryDto[];
  forecast: LiveCampaignForecastDto | null;
  session: LiveCampaignSessionDto | null;
  lastResult: LiveCampaignLastResultDto | null;
}

export interface LiveCampaignStartResponse {
  state: LiveCampaignState;
  session: LiveCampaignSessionDto;
}

export interface LiveCampaignSubmitResponse {
  state: LiveCampaignState;
  result: LiveCampaignLastResultDto;
}

export interface LiveCampaignRaidStartResponse {
  state: LiveCampaignState;
  raid: { id: number; closeAt: string; cards: LiveCampaignCardDto[] };
}

export const api = {
  localState: () => withAuth(() => v4<LocalKonturStateResponse>('/local/state')),

  localQuestions: () => withAuth(() => v4<QuestionsResponse>('/local/questions')),

  localHatch: (answers: number[]) =>
    withAuth(() => v4<HatchResponse>('/local/hatch', {
      method: 'POST',
      body: { answers, clientRequestId: rid() },
    })),

  localOpenEgg: (clientRequestId: string) =>
    withAuth(() => v4<EggOpenResponse>('/local/egg/open', {
      method: 'POST',
      body: { clientRequestId },
    })),

  localColorings: () => withAuth(() => v4<ColoringsResponse>('/local/colorings')),

  localEquip: (code: string) =>
    withAuth(() => v4<{ state: GameState }>('/local/coloring/equip', {
      method: 'POST', body: { code },
    })),

  state: () => withAuth(() => call<GameState>('/state')),

  questions: () => withAuth(() => call<QuestionsResponse>('/questions')),

  hatch: (answers: number[], birdName?: string) =>
    withAuth(() =>
      call<HatchResponse>('/onboarding/hatch', {
        method: 'POST',
        body: { answers, birdName, clientRequestId: rid() },
      }),
    ),

  collectPassive: () =>
    withAuth(() =>
      call<PassiveCollectResponse>('/passive/collect', {
        method: 'POST',
        body: { clientRequestId: rid() },
      }),
    ),

  openEgg: () =>
    withAuth(() =>
      call<EggOpenResponse>('/egg/open', {
        method: 'POST',
        body: { clientRequestId: rid() },
      }),
    ),

  colorings: () => withAuth(() => call<ColoringsResponse>('/colorings')),

  signals: () => withAuth(() => call<SignalsResponse>('/signals')),

  equip: (code: string) =>
    withAuth(() =>
      call<{ state: GameState }>('/coloring/equip', {
        method: 'POST',
        body: { code },
      }),
    ),

  nest: () => withAuth(() => call<NestResponse>('/nest')),

  community: () => withAuth(() => call<CommunityResponse>('/community')),

  visit: (userId: number) =>
    withAuth(() => call<{ ok: true }>(`/visit/${userId}`, { method: 'POST' })),

  experienceState: () => withAuth(() => v2<ExperienceV2State>('/state')),

  startJourney: (
    intent: ParticipationIntent,
    chatCode: string | undefined,
    clientRequestId: string,
    client: JourneyClient = 'unknown',
  ) => withAuth(() => v2<ExperienceV2State>('/journey/start', {
    method: 'POST', body: { intent, chatCode, clientRequestId, client },
  })),

  markPrepared: (clientRequestId: string, client: JourneyClient = 'unknown') =>
    withAuth(() => v2<ExperienceV2State>('/journey/prepared', {
      method: 'POST', body: { clientRequestId, client },
    })),

  markPublished: (
    chatCode: string,
    clientRequestId: string,
    client: JourneyClient = 'unknown',
  ) => withAuth(() => v2<ExperienceV2State>('/journey/published', {
    method: 'POST', body: { chatCode, clientRequestId, client },
  })),

  markOutcome: (
    outcome: JourneyOutcome,
    clientRequestId: string,
    client: JourneyClient = 'unknown',
  ) => withAuth(() => v2<ExperienceV2State>('/journey/outcome', {
    method: 'POST', body: { outcome, clientRequestId, client },
  })),

  closeJourney: (clientRequestId: string) =>
    withAuth(() => v2<ExperienceV2State>('/journey/close', {
      method: 'POST', body: { clientRequestId },
    })),

  saveNestItem: (input: {
    journeyId: number;
    label: string;
    status: NestItemStatus;
    nextStep?: string;
    clientRequestId: string;
  }) => withAuth(() => v2<ExperienceV2State>('/nest/save', {
    method: 'POST', body: input,
  })),

  updateNestNextStep: (id: number, nextStep: string | null, clientRequestId: string) =>
    withAuth(() => v2<ExperienceV2State>(`/nest/${id}/next-step`, {
      method: 'POST', body: { nextStep, clientRequestId },
    })),

  deleteNestItem: (id: number, clientRequestId: string) =>
    withAuth(() => v2<ExperienceV2State>(`/nest/${id}/delete`, {
      method: 'POST', body: { clientRequestId },
    })),

  updateJourneyReminder: (id: number, enabled: boolean, clientRequestId: string) =>
    withAuth(() => v2<ExperienceV2State>(`/nest/${id}/reminder`, {
      method: 'POST', body: { enabled, clientRequestId },
    })),

  restoredState: () => withAuth(() => v3<RestoredExperienceState>('/state')),

  saveRestoredAction: (input: Omit<SaveRestoredActionRequest, 'clientRequestId'>) =>
    withAuth(() => v3<RestoredExperienceState>('/actions', {
      method: 'POST', body: { ...input, clientRequestId: rid() },
    })),

  updateRestoredAction: (id: number, status: RestoredActionStatus) =>
    withAuth(() => v3<RestoredExperienceState>(`/actions/${id}/status`, {
      method: 'POST', body: { status, clientRequestId: rid() },
    })),

  saveRestoredNest: (input: Omit<SaveRestoredNestRequest, 'clientRequestId'>) =>
    withAuth(() => v3<RestoredExperienceState>('/nest', {
      method: 'POST', body: { ...input, clientRequestId: rid() },
    })),

  zeroSeasonState: () => withAuth(() => v4<ZeroSeasonState>('/state')),

  saveZeroSeasonProfile: (bird: ZeroSeasonBird, scores: Record<ZeroSeasonBird, number>) =>
    withAuth(() => v4<{ profile: ZeroSeasonState['profile'] }>('/profile', {
      method: 'POST', body: { bird, scores, clientRequestId: rid() },
    })),

  chooseZeroSeasonBird: (bird: ZeroSeasonBird) =>
    withAuth(() => v4<{ activeBird: ZeroSeasonBird }>('/season/bird', {
      method: 'POST', body: { bird, clientRequestId: rid() },
    })),

  joinZeroSeasonFlight: (intent: ZeroSeasonIntent, nest: number) =>
    withAuth(() => v4<{ gameDay: number; flight: ZeroSeasonFlight }>('/flight/join', {
      method: 'POST', body: { intent, nest, clientRequestId: rid() },
    })),

  leaveZeroSeasonFlight: () =>
    withAuth(() => v4<{ gameDay: number; flight: null }>('/flight/leave', {
      method: 'POST', body: { clientRequestId: rid() },
    })),

  startZeroSeasonSeries: (intent: ZeroSeasonIntent, nest: number) =>
    withAuth(() => v4<{ gameDay: number; seconds: number; difficulty: 'base' | 'applied' | 'advanced'; intent: ZeroSeasonIntent; nest: number; flight: ZeroSeasonFlight | null; questions: ZeroSeasonPublicQuestion[] }>('/series/start', {
      method: 'POST', body: { intent, nest, clientRequestId: rid() },
    })),

  saveZeroSeasonSeries: (answers: number[]) =>
    withAuth(() => v4<{ gameDay: number; correct: number; effect: ZeroSeasonIntent | 'none'; eggs: number; paths: ZeroSeasonState['paths']; review: Array<{ id: string; correct: boolean; answer: number }> }>('/series', {
      method: 'POST', body: { answers, clientRequestId: rid() },
    })),

  saveZeroSeasonForecast: (bird: ZeroSeasonBird) =>
    withAuth(() => v4<{ forecast: NonNullable<ZeroSeasonState['forecast']>; eggs: number }>('/forecast', {
      method: 'POST', body: { bird, clientRequestId: rid() },
    })),

  liveCampaignState: (eventId?: number) => {
    const query = Number.isInteger(eventId) ? `?eventId=${eventId}` : '';
    return withAuth(() => v5<LiveCampaignState>(`/state${query}`));
  },

  saveLiveCampaignPretest: (eventId: number, answers: LiveCampaignBird[]) =>
    withAuth(() => v5<{ state: LiveCampaignState }>('/pretest', {
      method: 'POST', body: { eventId, answers, clientRequestId: rid() },
    })),

  chooseLiveCampaignBird: (eventId: number, bird: LiveCampaignBird) =>
    withAuth(() => v5<{ state: LiveCampaignState }>('/birds/active', {
      method: 'POST', body: { eventId, bird, clientRequestId: rid() },
    })),

  moltLiveCampaignBird: (eventId: number, sourceBird: LiveCampaignBird, targetBird: LiveCampaignBird) =>
    withAuth(() => v5<{ state: LiveCampaignState }>('/molt', {
      method: 'POST', body: { eventId, sourceBird, targetBird, clientRequestId: rid() },
    })),

  startLiveCampaignSession: (input: {
    eventId: number;
    sectorId: number;
    action: LiveCampaignAction;
    itemId?: number;
    useSignature?: boolean;
  }) => withAuth(() => v5<LiveCampaignStartResponse>(`/events/${input.eventId}/session/start`, {
    method: 'POST',
    body: {
      sectorId: input.sectorId,
      action: input.action,
      itemId: input.itemId,
      useSignature: input.useSignature,
      clientRequestId: rid(),
    },
  })),

  submitLiveCampaignSession: (eventId: number, answers: number[]) =>
    withAuth(() => v5<LiveCampaignSubmitResponse>(`/events/${eventId}/session/submit`, {
      method: 'POST', body: { answers, clientRequestId: rid() },
    })),

  saveLiveCampaignForecast: (
    eventId: number,
    sectorId: number,
    action: LiveCampaignAction,
    prediction: LiveCampaignForecastDto['prediction'],
  ) => withAuth(() => v5<{ state: LiveCampaignState }>(`/events/${eventId}/forecast`, {
    method: 'POST', body: { sectorId, action, prediction, clientRequestId: rid() },
  })),

  joinLiveCampaignRaid: (
    eventId: number,
    sectorId: number,
    action: LiveCampaignAction,
  ) => withAuth(() => v5<{ state: LiveCampaignState }>(`/events/${eventId}/raids/join`, {
    method: 'POST', body: { sectorId, action, clientRequestId: rid() },
  })),

  startLiveCampaignRaid: (eventId: number) => withAuth(() => v5<LiveCampaignRaidStartResponse>(`/events/${eventId}/raids/start`, {
    method: 'POST', body: { clientRequestId: rid() },
  })),

  submitLiveCampaignRaid: (eventId: number, answers: number[]) => withAuth(() => v5<{ state: LiveCampaignState; result: { correct: number; timedOut: boolean } }>(`/events/${eventId}/raids/submit`, {
    method: 'POST', body: { answers, clientRequestId: rid() },
  })),

  updateRestoredNest: (
    id: number,
    status: RestoredNestItemDto['status'],
    nextStep?: string,
  ) => withAuth(() => v3<RestoredExperienceState>(`/nest/${id}/status`, {
    method: 'POST', body: { status, nextStep, clientRequestId: rid() },
  })),

  updateRestoredMotion: (motion: RestoredMotion) =>
    withAuth(() => v3<RestoredExperienceState>('/preferences/motion', {
      method: 'POST', body: { motion },
    })),
};
