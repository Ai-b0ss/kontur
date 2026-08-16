import { decideHelpConfirmation, type JourneyStatus } from '@kontur/core';
import { ensureUser } from './db.js';
import type { Env } from './types.js';

export type JourneyHelpResult =
  | { ok: true; status: 'helped' | 'review'; helperStartedBot: boolean; repeated: boolean }
  | { ok: false; reason: 'no_active_question' | 'message_unavailable' | 'self' | 'duplicate' | 'invalid_message_pair' };

interface ActiveQuestionRow {
  id: number;
  status: JourneyStatus;
  telegram_chat_id: number | string | null;
}

/**
 * Связывает только явную команду участника с конкретной парой
 * «его вопрос → ответ другого человека». Текст сообщений не сохраняется.
 */
export async function confirmJourneyHelp(
  env: Env,
  input: {
    requesterUserId: number;
    requesterTgId: number;
    helperTgId: number;
    helperUsername: string | null;
    chatId: number;
    sourceMessageId: number | null;
    sourceAuthorTgId: number | null;
    replyMessageId: number | null;
    clientRequestId: string;
  },
): Promise<JourneyHelpResult> {
  const prior = await env.DB.prepare(
    `SELECT h.status,u.started_bot_at
       FROM help_confirmations h JOIN users u ON u.id=h.helper_user_id
      WHERE h.requester_user_id=? AND h.client_request_id=?`,
  ).bind(input.requesterUserId, input.clientRequestId)
    .first<{ status: 'helped' | 'review'; started_bot_at: string | null }>();
  if (prior) {
    return {
      ok: true,
      status: prior.status,
      helperStartedBot: Boolean(prior.started_bot_at),
      repeated: true,
    };
  }

  const journey = await env.DB.prepare(
    `SELECT j.id,j.status,c.telegram_chat_id
       FROM journeys j JOIN pilot_chats c ON c.id=j.pilot_chat_id
      WHERE j.user_id=? AND j.intent='ask' AND j.status IN ('published','waiting')
      ORDER BY j.id DESC LIMIT 1`,
  ).bind(input.requesterUserId).first<ActiveQuestionRow>();
  if (!journey || String(journey.telegram_chat_id) !== String(input.chatId)) {
    return { ok: false, reason: 'no_active_question' };
  }

  const { user: helper } = await ensureUser(env.DB, input.helperTgId, input.helperUsername);
  const duplicate = input.sourceMessageId !== null && input.replyMessageId !== null
    ? Boolean(await env.DB.prepare(
      `SELECT id FROM help_confirmations
        WHERE source_chat_id=? AND source_message_id=? AND reply_message_id=?`,
    ).bind(input.chatId, input.sourceMessageId, input.replyMessageId).first())
    : false;
  const recent = await env.DB.prepare(
    `SELECT count(*) AS count FROM help_confirmations
      WHERE created_at>=datetime('now','-7 days') AND (
        (requester_user_id=? AND helper_user_id=?) OR
        (requester_user_id=? AND helper_user_id=?))`,
  ).bind(input.requesterUserId, helper.id, helper.id, input.requesterUserId)
    .first<{ count: number }>();
  const decision = decideHelpConfirmation({
    requesterUserId: input.requesterUserId,
    helperUserId: helper.id,
    sourceMessageId: input.sourceAuthorTgId === input.requesterTgId ? input.sourceMessageId : null,
    replyMessageId: input.replyMessageId,
    duplicate,
    recentPairConfirmations: Number(recent?.count ?? 0),
  });
  if (!decision.accepted || !decision.status) {
    return { ok: false, reason: decision.rejection ?? 'message_unavailable' };
  }

  try {
    const statements = [env.DB.prepare(
      `INSERT INTO help_confirmations
        (journey_id,requester_user_id,helper_user_id,source_chat_id,
         source_message_id,reply_message_id,status,client_request_id)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(
      journey.id, input.requesterUserId, helper.id, input.chatId,
      input.sourceMessageId, input.replyMessageId, decision.status, input.clientRequestId,
    )];
    if (decision.status === 'helped') {
      statements.push(
        env.DB.prepare(
          `UPDATE journeys SET status='helped',source_chat_id=?,source_message_id=?,
                  reply_message_id=?,outcome_at=datetime('now'),updated_at=datetime('now')
            WHERE id=? AND user_id=? AND status IN ('published','waiting')`,
        ).bind(
          input.chatId, input.sourceMessageId, input.replyMessageId,
          journey.id, input.requesterUserId,
        ),
        env.DB.prepare(
          `INSERT INTO journey_events (user_id,journey_id,type,client)
           VALUES (?,?,'reply_observed','unknown'),(?,?,'outcome_helped','unknown')`,
        ).bind(input.requesterUserId, journey.id, input.requesterUserId, journey.id),
      );
    }
    await env.DB.batch(statements);
  } catch (error) {
    const repeated = await env.DB.prepare(
      `SELECT h.status,u.started_bot_at
         FROM help_confirmations h JOIN users u ON u.id=h.helper_user_id
        WHERE h.requester_user_id=? AND h.client_request_id=?`,
    ).bind(input.requesterUserId, input.clientRequestId)
      .first<{ status: 'helped' | 'review'; started_bot_at: string | null }>();
    if (repeated) {
      return {
        ok: true,
        status: repeated.status,
        helperStartedBot: Boolean(repeated.started_bot_at),
        repeated: true,
      };
    }
    throw error;
  }
  return {
    ok: true,
    status: decision.status,
    helperStartedBot: Boolean(helper.started_bot_at),
    repeated: false,
  };
}
