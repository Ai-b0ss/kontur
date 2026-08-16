export const PARTICIPATION_INTENTS = ['orient', 'ask', 'help', 'return'] as const;
export type ParticipationIntent = (typeof PARTICIPATION_INTENTS)[number];

export const PARTICIPATION_STAGES = ['looking', 'thread', 'nest', 'connection'] as const;
export type ParticipationStage = (typeof PARTICIPATION_STAGES)[number];

export type ParticipationMilestone =
  | 'intent_selected'
  | 'conversation_joined'
  | 'result_saved'
  | 'connection_extended';

export const JOURNEY_STATUSES = [
  'started',
  'prepared',
  'published',
  'waiting',
  'helped',
  'clarify',
  'saved',
  'done',
  'closed',
] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

export const NEST_ITEM_STATUSES = ['waiting', 'helped', 'clarify', 'done'] as const;
export type NestItemStatus = (typeof NEST_ITEM_STATUSES)[number];

const stageForMilestone: Record<ParticipationMilestone, ParticipationStage> = {
  intent_selected: 'looking',
  conversation_joined: 'thread',
  result_saved: 'nest',
  connection_extended: 'connection',
};

/** Путь птицы необратим: пауза или повторное действие не уменьшают состояние. */
export function advanceParticipationStage(
  current: ParticipationStage,
  milestone: ParticipationMilestone,
): ParticipationStage {
  const candidate = stageForMilestone[milestone];
  return PARTICIPATION_STAGES.indexOf(candidate) > PARTICIPATION_STAGES.indexOf(current)
    ? candidate
    : current;
}

const journeyTransitions: Record<JourneyStatus, readonly JourneyStatus[]> = {
  started: ['prepared', 'closed'],
  prepared: ['published', 'closed'],
  published: ['waiting', 'helped', 'clarify', 'saved', 'closed'],
  waiting: ['helped', 'clarify', 'saved', 'closed'],
  helped: ['saved', 'done', 'closed'],
  clarify: ['prepared', 'saved', 'closed'],
  saved: ['done', 'closed'],
  done: ['closed'],
  closed: [],
};

export function canTransitionJourney(from: JourneyStatus, to: JourneyStatus): boolean {
  return journeyTransitions[from].includes(to);
}

const nestTransitions: Record<NestItemStatus, readonly NestItemStatus[]> = {
  waiting: ['helped', 'clarify', 'done'],
  helped: ['clarify', 'done'],
  clarify: ['helped', 'done'],
  done: [],
};

export function canTransitionNestItem(from: NestItemStatus, to: NestItemStatus): boolean {
  return from === to || nestTransitions[from].includes(to);
}

export type HelpConfirmationRejection =
  | 'self'
  | 'duplicate'
  | 'message_unavailable'
  | 'invalid_message_pair';

export interface HelpConfirmationContext {
  requesterUserId: number;
  helperUserId: number;
  sourceMessageId: number | null;
  replyMessageId: number | null;
  duplicate: boolean;
  /** Подтверждения в обе стороны у этой пары за последние семь суток. */
  recentPairConfirmations: number;
}

export interface HelpConfirmationDecision {
  accepted: boolean;
  status?: 'helped' | 'review';
  rejection?: HelpConfirmationRejection;
}

export const PAIR_REVIEW_THRESHOLD = 3;

/**
 * Решение не начисляет очков и не обвиняет участника. Повторяющаяся взаимность
 * лишь переводит запись на ручную проверку и не развивает птицу автоматически.
 */
export function decideHelpConfirmation(
  context: HelpConfirmationContext,
): HelpConfirmationDecision {
  if (context.requesterUserId === context.helperUserId) {
    return { accepted: false, rejection: 'self' };
  }
  if (context.duplicate) {
    return { accepted: false, rejection: 'duplicate' };
  }
  if (context.sourceMessageId === null || context.replyMessageId === null) {
    return { accepted: false, rejection: 'message_unavailable' };
  }
  if (
    context.sourceMessageId <= 0 ||
    context.replyMessageId <= 0 ||
    context.sourceMessageId === context.replyMessageId
  ) {
    return { accepted: false, rejection: 'invalid_message_pair' };
  }
  return {
    accepted: true,
    status: context.recentPairConfirmations >= PAIR_REVIEW_THRESHOLD ? 'review' : 'helped',
  };
}

/** Ключ повтора достаточно строгий для хранения и достаточно простой для UUID. */
export function isValidClientRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{8,128}$/.test(value);
}
