import {
  advanceParticipationStage,
  canTransitionJourney,
  type JourneyStatus,
  type ParticipationIntent,
  type ParticipationStage,
} from '@kontur/core';
import type {
  ExperienceV2State,
  JourneyClient,
  JourneyDto,
  JourneyOutcome,
  NestItemDto,
  NestItemStatus,
  ParticipationProfileDto,
  PilotChatDto,
  JourneyReminderStatus,
} from '@kontur/contracts';
import { GameError } from './errors.js';
import { iso } from './db.js';
import type { Env } from './types.js';

type ActionName =
  | 'journey_start'
  | 'journey_prepared'
  | 'journey_published'
  | 'journey_outcome_helped'
  | 'journey_outcome_clarify'
  | 'journey_outcome_saved'
  | 'nest_save'
  | 'nest_next_step'
  | 'nest_delete'
  | 'journey_close';

interface JourneyRow {
  id: number;
  chat_code: string | null;
  intent: ParticipationIntent;
  status: JourneyStatus;
  message_link: string | null;
  created_at: string;
  updated_at: string;
}

interface NestRow {
  id: number;
  journey_id: number;
  label: string;
  status: NestItemStatus;
  message_link: string | null;
  next_step: string | null;
  reminder_status: 'pending' | 'sent' | 'cancelled' | null;
  created_at: string;
  updated_at: string;
}

function journeyDto(row: JourneyRow): JourneyDto {
  return {
    id: Number(row.id),
    chatCode: row.chat_code,
    intent: row.intent,
    status: row.status,
    messageLink: row.message_link,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function nestDto(row: NestRow): NestItemDto {
  const reminderStatus: JourneyReminderStatus = row.reminder_status === 'pending'
    ? 'pending'
    : row.reminder_status === 'sent'
      ? 'sent'
      : 'off';
  return {
    id: Number(row.id),
    journeyId: Number(row.journey_id),
    label: row.label,
    status: row.status,
    messageLink: row.message_link,
    nextStep: row.next_step,
    reminderStatus,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function priorAction(
  db: D1Database,
  userId: number,
  requestId: string,
  expected: ActionName,
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT action FROM journey_action_requests WHERE user_id = ? AND client_request_id = ?',
  ).bind(userId, requestId).first<{ action: ActionName }>();
  if (!row) return false;
  if (row.action !== expected) throw new GameError('VALIDATION', { field: 'clientRequestId' });
  return true;
}

async function activeJourney(db: D1Database, userId: number): Promise<JourneyRow | null> {
  return db.prepare(
    `SELECT j.id,c.code AS chat_code,j.intent,j.status,j.message_link,j.created_at,j.updated_at
       FROM journeys j LEFT JOIN pilot_chats c ON c.id=j.pilot_chat_id
      WHERE j.user_id=? AND j.status NOT IN ('done','closed')
      ORDER BY j.id DESC LIMIT 1`,
  ).bind(userId).first<JourneyRow>();
}

async function ownedJourney(db: D1Database, userId: number, journeyId: number): Promise<JourneyRow | null> {
  return db.prepare(
    `SELECT j.id,c.code AS chat_code,j.intent,j.status,j.message_link,j.created_at,j.updated_at
       FROM journeys j LEFT JOIN pilot_chats c ON c.id=j.pilot_chat_id
      WHERE j.user_id=? AND j.id=?`,
  ).bind(userId, journeyId).first<JourneyRow>();
}

export async function buildExperienceV2State(env: Env, userId: number): Promise<ExperienceV2State> {
  const [profile, chats, journey, nest] = await Promise.all([
    env.DB.prepare(
      `SELECT stage,current_intent,started_at,updated_at
         FROM participation_profiles WHERE user_id=?`,
    ).bind(userId).first<{
      stage: ParticipationStage;
      current_intent: ParticipationIntent | null;
      started_at: string;
      updated_at: string;
    }>(),
    env.DB.prepare(
      `SELECT code,title,purpose,kind FROM pilot_chats
        WHERE active=1 ORDER BY position,id`,
    ).all<{ code: string; title: string; purpose: string; kind: 'general' | 'specialist' }>(),
    activeJourney(env.DB, userId),
    env.DB.prepare(
      `SELECT n.id,n.journey_id,n.label,n.status,n.message_link,n.next_step,
              n.created_at,n.updated_at,r.status AS reminder_status
         FROM nest_items n LEFT JOIN journey_reminders r ON r.nest_item_id=n.id
        WHERE n.user_id=? AND n.deleted_at IS NULL
        ORDER BY n.updated_at DESC,n.id DESC LIMIT 50`,
    ).bind(userId).all<NestRow>(),
  ]);

  const profileDto: ParticipationProfileDto | null = profile ? {
    stage: profile.stage,
    currentIntent: profile.current_intent,
    startedAt: iso(profile.started_at),
    updatedAt: iso(profile.updated_at),
  } : null;
  const chatDtos: PilotChatDto[] = chats.results.map((row) => ({
    code: row.code,
    title: row.title,
    purpose: row.purpose,
    kind: row.kind,
  }));

  return {
    version: 'v2',
    chats: chatDtos,
    profile: profileDto,
    activeJourney: journey ? journeyDto(journey) : null,
    nest: nest.results.map(nestDto),
  };
}

export async function startJourney(
  env: Env,
  userId: number,
  input: { intent: ParticipationIntent; chatCode: string | null; requestId: string; client: JourneyClient },
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, input.requestId, 'journey_start')) {
    return buildExperienceV2State(env, userId);
  }
  const prior = await env.DB.prepare(
    'SELECT id FROM journeys WHERE user_id=? AND client_request_id=?',
  ).bind(userId, input.requestId).first();
  if (prior) return buildExperienceV2State(env, userId);

  const current = await activeJourney(env.DB, userId);
  if (current) throw new GameError('INVALID_TRANSITION', { reason: 'active_journey_exists' });

  const chat = input.chatCode ? await env.DB.prepare(
    'SELECT id FROM pilot_chats WHERE code=? AND active=1',
  ).bind(input.chatCode).first<{ id: number }>() : null;
  if (input.chatCode && !chat) throw new GameError('VALIDATION', { field: 'chatCode' });

  try {
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO participation_profiles (user_id) VALUES (?)').bind(userId),
      env.DB.prepare(
        `UPDATE participation_profiles SET current_intent=?,updated_at=datetime('now') WHERE user_id=?`,
      ).bind(input.intent, userId),
      env.DB.prepare(
        `INSERT INTO journeys (user_id,pilot_chat_id,intent,client_request_id)
         VALUES (?,?,?,?)`,
      ).bind(userId, chat?.id ?? null, input.intent, input.requestId),
      env.DB.prepare(
        `INSERT INTO journey_action_requests (user_id,client_request_id,action)
         VALUES (?,?,'journey_start')`,
      ).bind(userId, input.requestId),
      env.DB.prepare(
        `INSERT INTO journey_events (user_id,type,client)
         VALUES (?,'journey_started',?)`,
      ).bind(userId, input.client),
    ]);
  } catch (error) {
    if (await priorAction(env.DB, userId, input.requestId, 'journey_start')) {
      return buildExperienceV2State(env, userId);
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('one_active_journey_per_user')
      || message.includes('UNIQUE constraint failed: journeys.user_id')
    ) {
      throw new GameError('INVALID_TRANSITION', { reason: 'active_journey_exists' });
    }
    throw error;
  }
  return buildExperienceV2State(env, userId);
}

async function changeJourney(
  env: Env,
  userId: number,
  input: {
    requestId: string;
    action: ActionName;
    target: JourneyStatus;
    event:
      | 'question_prepared'
      | 'chat_opened'
      | 'message_linked'
      | 'outcome_helped'
      | 'outcome_clarify'
      | 'result_saved';
    client: JourneyClient;
    chat?: { id: number; telegram_chat_id: number | string | null };
    messageId?: number | null;
  },
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, input.requestId, input.action)) {
    return buildExperienceV2State(env, userId);
  }
  const journey = await activeJourney(env.DB, userId);
  if (!journey) throw new GameError('JOURNEY_NOT_FOUND');
  if (!canTransitionJourney(journey.status, input.target)) {
    throw new GameError('INVALID_TRANSITION', { from: journey.status, to: input.target });
  }

  const stage = input.target === 'published'
    ? advanceParticipationStage(
      (await env.DB.prepare('SELECT stage FROM participation_profiles WHERE user_id=?')
        .bind(userId).first<{ stage: ParticipationStage }>())?.stage ?? 'looking',
      'conversation_joined',
    )
    : null;
  const timeColumn = input.target === 'prepared'
    ? 'prepared_at'
    : input.target === 'published'
      ? 'published_at'
      : 'outcome_at';
  const chatId = input.chat?.id ?? null;
  const sourceChatId = input.chat?.telegram_chat_id ?? null;
  const messageId = input.messageId ?? null;

  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE journeys SET status=?,pilot_chat_id=coalesce(?,pilot_chat_id),
              source_chat_id=coalesce(?,source_chat_id),
              source_message_id=coalesce(?,source_message_id),
              ${timeColumn}=datetime('now'),updated_at=datetime('now')
        WHERE id=? AND user_id=? AND status=?`,
    ).bind(input.target, chatId, sourceChatId, messageId, journey.id, userId, journey.status),
    env.DB.prepare(
      `INSERT INTO journey_action_requests
         (user_id,client_request_id,action,journey_id)
       SELECT ?,?,?,? WHERE EXISTS(
         SELECT 1 FROM journeys WHERE id=? AND user_id=? AND status=?)`,
    ).bind(userId, input.requestId, input.action, journey.id, journey.id, userId, input.target),
    env.DB.prepare(
      `INSERT INTO journey_events (user_id,journey_id,type,client)
       SELECT ?,?,?,? WHERE EXISTS(
         SELECT 1 FROM journey_action_requests WHERE user_id=? AND client_request_id=?)`,
    ).bind(userId, journey.id, input.event, input.client, userId, input.requestId),
    ...(stage ? [env.DB.prepare(
      `UPDATE participation_profiles SET stage=?,updated_at=datetime('now') WHERE user_id=?`,
    ).bind(stage, userId)] : []),
  ]);
  if (!results[1]?.meta.changes) throw new GameError('INVALID_TRANSITION');
  return buildExperienceV2State(env, userId);
}

export function markJourneyPrepared(
  env: Env,
  userId: number,
  input: { requestId: string; client: JourneyClient },
): Promise<ExperienceV2State> {
  return changeJourney(env, userId, {
    ...input,
    action: 'journey_prepared',
    target: 'prepared',
    event: 'question_prepared',
  });
}

export async function markJourneyPublished(
  env: Env,
  userId: number,
  input: { chatCode: string; messageId: number | null; requestId: string; client: JourneyClient },
): Promise<ExperienceV2State> {
  const chat = await env.DB.prepare(
    'SELECT id,telegram_chat_id FROM pilot_chats WHERE code=? AND active=1',
  ).bind(input.chatCode).first<{ id: number; telegram_chat_id: number | string | null }>();
  if (!chat) throw new GameError('VALIDATION', { field: 'chatCode' });
  if (input.messageId !== null && chat.telegram_chat_id === null) {
    throw new GameError('VALIDATION', { field: 'messageId' });
  }
  return changeJourney(env, userId, {
    ...input,
    action: 'journey_published',
    target: 'published',
    event: input.messageId === null ? 'chat_opened' : 'message_linked',
    chat,
  });
}

export function markJourneyOutcome(
  env: Env,
  userId: number,
  input: { outcome: JourneyOutcome; requestId: string; client: JourneyClient },
): Promise<ExperienceV2State> {
  const event = input.outcome === 'helped'
    ? 'outcome_helped'
    : input.outcome === 'clarify'
      ? 'outcome_clarify'
      : 'result_saved';
  return changeJourney(env, userId, {
    requestId: input.requestId,
    client: input.client,
    action: `journey_outcome_${input.outcome}` as ActionName,
    target: input.outcome,
    event,
  });
}

export async function saveNestItem(
  env: Env,
  userId: number,
  input: {
    journeyId: number;
    label: string;
    status: NestItemStatus;
    messageLink: string | null;
    nextStep: string | null;
    requestId: string;
  },
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, input.requestId, 'nest_save')) {
    return buildExperienceV2State(env, userId);
  }
  const journey = await ownedJourney(env.DB, userId, input.journeyId);
  if (!journey) throw new GameError('JOURNEY_NOT_FOUND');
  if (journey.status !== 'saved' && !canTransitionJourney(journey.status, 'saved')) {
    throw new GameError('INVALID_TRANSITION', { from: journey.status, to: 'saved' });
  }
  const currentStage = (await env.DB.prepare(
    'SELECT stage FROM participation_profiles WHERE user_id=?',
  ).bind(userId).first<{ stage: ParticipationStage }>())?.stage ?? 'looking';
  const stage = advanceParticipationStage(currentStage, 'result_saved');

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO nest_items
          (user_id,journey_id,label,status,message_link,next_step,client_request_id)
         VALUES (?,?,?,?,?,?,?)`,
      ).bind(
        userId, input.journeyId, input.label, input.status,
        input.messageLink, input.nextStep, input.requestId,
      ),
      env.DB.prepare(
        `UPDATE journeys SET status='saved',outcome_at=coalesce(outcome_at,datetime('now')),
                updated_at=datetime('now')
          WHERE id=? AND user_id=?`,
      ).bind(input.journeyId, userId),
      env.DB.prepare(
        `UPDATE participation_profiles SET stage=?,updated_at=datetime('now') WHERE user_id=?`,
      ).bind(stage, userId),
      env.DB.prepare(
        `INSERT INTO journey_action_requests (user_id,client_request_id,action,journey_id)
         VALUES (?,?,'nest_save',?)`,
      ).bind(userId, input.requestId, input.journeyId),
      env.DB.prepare(
        `INSERT INTO journey_events (user_id,journey_id,type)
         VALUES (?,?,'result_saved')`,
      ).bind(userId, input.journeyId),
    ]);
  } catch (error) {
    if (await priorAction(env.DB, userId, input.requestId, 'nest_save')) {
      return buildExperienceV2State(env, userId);
    }
    throw error;
  }
  return buildExperienceV2State(env, userId);
}

export async function updateNestNextStep(
  env: Env,
  userId: number,
  nestItemId: number,
  input: { nextStep: string | null; requestId: string },
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, input.requestId, 'nest_next_step')) {
    return buildExperienceV2State(env, userId);
  }
  const item = await env.DB.prepare(
    'SELECT journey_id FROM nest_items WHERE id=? AND user_id=? AND deleted_at IS NULL',
  ).bind(nestItemId, userId).first<{ journey_id: number }>();
  if (!item) throw new GameError('NEST_ITEM_NOT_FOUND');
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE nest_items SET next_step=?,updated_at=datetime('now')
        WHERE id=? AND user_id=? AND deleted_at IS NULL`,
    ).bind(input.nextStep, nestItemId, userId),
    env.DB.prepare(
      `INSERT INTO journey_action_requests
        (user_id,client_request_id,action,journey_id,nest_item_id)
       VALUES (?,?,'nest_next_step',?,?)`,
    ).bind(userId, input.requestId, item.journey_id, nestItemId),
    env.DB.prepare(
      `INSERT INTO journey_events (user_id,journey_id,type)
       VALUES (?,?,'next_step_opened')`,
    ).bind(userId, item.journey_id),
    ...(input.nextStep === null ? [env.DB.prepare(
      `UPDATE journey_reminders SET status='cancelled',updated_at=datetime('now')
        WHERE nest_item_id=? AND status='pending'`,
    ).bind(nestItemId)] : []),
  ]);
  if (!results[0]?.meta.changes) throw new GameError('NEST_ITEM_NOT_FOUND');
  return buildExperienceV2State(env, userId);
}

export async function deleteNestItem(
  env: Env,
  userId: number,
  nestItemId: number,
  requestId: string,
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, requestId, 'nest_delete')) {
    return buildExperienceV2State(env, userId);
  }
  const item = await env.DB.prepare(
    'SELECT journey_id FROM nest_items WHERE id=? AND user_id=? AND deleted_at IS NULL',
  ).bind(nestItemId, userId).first<{ journey_id: number }>();
  if (!item) throw new GameError('NEST_ITEM_NOT_FOUND');
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE nest_items SET deleted_at=datetime('now'),updated_at=datetime('now')
        WHERE id=? AND user_id=? AND deleted_at IS NULL`,
    ).bind(nestItemId, userId),
    env.DB.prepare(
      `INSERT INTO journey_action_requests
        (user_id,client_request_id,action,journey_id,nest_item_id)
       VALUES (?,?,'nest_delete',?,?)`,
    ).bind(userId, requestId, item.journey_id, nestItemId),
  ]);
  if (!results[0]?.meta.changes) throw new GameError('NEST_ITEM_NOT_FOUND');
  return buildExperienceV2State(env, userId);
}

export async function updateJourneyReminder(
  env: Env,
  userId: number,
  nestItemId: number,
  input: { enabled: boolean; requestId: string },
): Promise<ExperienceV2State> {
  const prior = await env.DB.prepare(
    'SELECT id FROM journey_reminders WHERE user_id=? AND client_request_id=?',
  ).bind(userId, input.requestId).first();
  if (prior) return buildExperienceV2State(env, userId);

  const item = await env.DB.prepare(
    `SELECT n.id,n.next_step,r.status AS reminder_status
       FROM nest_items n LEFT JOIN journey_reminders r ON r.nest_item_id=n.id
      WHERE n.id=? AND n.user_id=? AND n.deleted_at IS NULL`,
  ).bind(nestItemId, userId).first<{
    id: number;
    next_step: string | null;
    reminder_status: string | null;
  }>();
  if (!item) throw new GameError('NEST_ITEM_NOT_FOUND');
  if (input.enabled && !item.next_step) {
    throw new GameError('INVALID_TRANSITION', { reason: 'next_step_required' });
  }
  if (item.reminder_status === 'sent') {
    throw new GameError('INVALID_TRANSITION', { reason: 'reminder_already_sent' });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO journey_reminders
         (user_id,nest_item_id,status,due_at,client_request_id)
       VALUES (?,?,?,datetime('now','+1 day'),?)
       ON CONFLICT(nest_item_id) DO UPDATE SET
         status=excluded.status,
         due_at=CASE WHEN excluded.status='pending' THEN datetime('now','+1 day') ELSE journey_reminders.due_at END,
         client_request_id=excluded.client_request_id,
         updated_at=datetime('now')
       WHERE journey_reminders.status<>'sent'`,
    ).bind(userId, nestItemId, input.enabled ? 'pending' : 'cancelled', input.requestId).run();
  } catch (error) {
    const repeated = await env.DB.prepare(
      'SELECT id FROM journey_reminders WHERE user_id=? AND client_request_id=?',
    ).bind(userId, input.requestId).first();
    if (!repeated) throw error;
  }
  return buildExperienceV2State(env, userId);
}

export async function closeJourney(
  env: Env,
  userId: number,
  requestId: string,
): Promise<ExperienceV2State> {
  if (await priorAction(env.DB, userId, requestId, 'journey_close')) {
    return buildExperienceV2State(env, userId);
  }
  const journey = await activeJourney(env.DB, userId);
  if (!journey) throw new GameError('JOURNEY_NOT_FOUND');
  if (!canTransitionJourney(journey.status, 'closed')) {
    throw new GameError('INVALID_TRANSITION', { from: journey.status, to: 'closed' });
  }
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE journeys SET status='closed',updated_at=datetime('now')
        WHERE id=? AND user_id=? AND status=?`,
    ).bind(journey.id, userId, journey.status),
    env.DB.prepare(
      `INSERT INTO journey_action_requests (user_id,client_request_id,action,journey_id)
       SELECT ?,?,'journey_close',? WHERE EXISTS(
         SELECT 1 FROM journeys WHERE id=? AND user_id=? AND status='closed')`,
    ).bind(userId, requestId, journey.id, journey.id, userId),
  ]);
  if (!results[1]?.meta.changes) throw new GameError('INVALID_TRANSITION');
  return buildExperienceV2State(env, userId);
}
