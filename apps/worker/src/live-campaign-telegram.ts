import { LIVE_CAMPAIGN_LENGTH_DAYS, liveCampaignThreshold, type LiveCampaignAction } from '@kontur/core';
import { ensureUser } from './db.js';
import { liveCampaignV5GloballyEnabled, liveCampaignV5PublishEnabled } from './experience-access.js';
import { createV5Narrative, type V5Narrative, type V5NarrativeInput } from './live-campaign-llm.js';
import { checkBotChatAdmin, checkChatAdmin, sendMessage, telegramCall } from './telegram-api.js';
import type { Env } from './types.js';

/** Отдельный cron V5. Пока gate публикации выключен, обработчик не трогает D1. */
export const LIVE_CAMPAIGN_CRON = '0 * * * *';

export interface LiveCampaignTelegramUser {
  id: number;
  username?: string;
  is_bot?: boolean;
}

export interface LiveCampaignTelegramChat {
  id: number;
  type: string;
}

export interface LiveCampaignTelegramMessage {
  message_id: number;
  from?: LiveCampaignTelegramUser;
  chat: LiveCampaignTelegramChat;
  reply_to_message?: { message_id: number };
}

export interface LiveCampaignTelegramMembershipUpdate {
  chat: LiveCampaignTelegramChat;
  new_chat_member: { user: LiveCampaignTelegramUser; status: string; is_member?: boolean };
}

type ChatStatus = 'draft' | 'armed' | 'paused';
type EventStatus = 'scheduled' | 'open' | 'locked' | 'resolved';
type OutboxKind = 'opening' | 'summary';
export type LiveCampaignContractAction = LiveCampaignAction | 'raid';

interface CampaignChatRow {
  id: number;
  telegram_chat_id: number | string;
  status: ChatStatus;
  campaign_id: number | null;
  game_enabled: number | null;
  publish_enabled: number | null;
}

interface CampaignRow {
  id: number;
  campaign_number: number;
  status: 'scheduled' | 'active' | 'resolved' | 'archived';
}

interface EventRow {
  id: number;
  campaign_id: number;
  event_number: number;
  status: EventStatus;
  threshold: number;
  opens_at: string;
  locks_at: string;
  forecast_deadline: string;
}

interface SectorRow {
  sector: number;
  state: 'hidden' | 'exposed' | 'secured' | 'rooted';
}

interface PendingContractRow {
  id: number;
  requested_action: LiveCampaignContractAction;
}

export interface LiveCampaignEventTarget {
  sector: number;
  state: SectorRow['state'];
  action: LiveCampaignAction;
}

export interface LiveCampaignEventPlan {
  target: LiveCampaignEventTarget;
  /** True only when the stored command changes the opened event itself. */
  usesContract: boolean;
  /** A /raid contract opens the bounded raid queue for this exact event. */
  opensRaid: boolean;
}

interface OutboxRow {
  id: number;
  kind: OutboxKind;
  payload_json: string;
  telegram_chat_id: number | string;
  event_id: number;
}

interface DueCampaignChatRow {
  id: number;
  telegram_chat_id: number;
  next_event_at: string;
}

interface ResolvedCampaignEventRow {
  chat_id: number;
  campaign_id: number;
  event_id: number;
  result_json: string | null;
  map_mutation_count: number | string | null;
}

interface CampaignRolloverChatRow {
  id: number;
}

export interface NotificationPayload {
  title: string;
  line: string;
}

export type OpenLiveCampaignEventResult =
  | { ok: true; created: boolean; event: EventRow }
  | { ok: false; reason: 'chat_not_armed' | 'campaign_missing' | 'no_legal_objective' };

/**
 * Ссылка для private Web App. Даже если штатная Mini App имеет `?season=zero`,
 * V5 очищает этот параметр и не меняет legacy launch URL.
 */
export function buildV5MiniAppUrl(
  env: Pick<Env, 'MINIAPP_URL' | 'V5_MINIAPP_URL'>,
  eventId: number,
): string | null {
  if (!Number.isSafeInteger(eventId) || eventId < 1) return null;
  const configured = env.V5_MINIAPP_URL || env.MINIAPP_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.searchParams.delete('season');
    url.searchParams.set('campaign', 'v5');
    url.searchParams.set('event', String(eventId));
    return url.toString();
  } catch {
    return null;
  }
}

/** В группе допустим только URL-deep-link: Telegram не поддерживает group Web App button. */
export function buildV5DeepLink(
  env: Pick<Env, 'V5_BOT_USERNAME'>,
  eventId: number,
): string | null {
  if (!Number.isSafeInteger(eventId) || eventId < 1) return null;
  const username = env.V5_BOT_USERNAME?.trim().replace(/^@/, '');
  if (!username || !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) return null;
  return `https://t.me/${username}?start=v5_${eventId}`;
}

/**
 * Private /start v5_<event> — единственное место, где V5 отдаёт web_app
 * кнопку. Групповой путь всегда проходит через URL выше.
 */
export async function handleLiveCampaignPrivateStart(
  env: Env,
  message: LiveCampaignTelegramMessage,
  tail: string,
): Promise<boolean> {
  if (message.chat.type !== 'private' || !message.from) return false;
  const trimmed = tail.trim();
  // Placeholder /start v5_<eventId> must not fall through into V4 hatch copy.
  if (/^v5_/i.test(trimmed) && !/^v5_\d+$/i.test(trimmed)) {
    await sendMessage(
      env,
      message.from.id,
      'Нужен номер окна, не шаблон. После /kontur open бот пишет ссылку вида /start v5_3 — отправь её целиком.',
    );
    return true;
  }
  const match = /^v5_(\d+)$/i.exec(trimmed);
  if (!match) return false;
  const eventId = Number(match[1]);
  // A syntactically valid V5 deep link must never fall through into the legacy
  // /start experience, even if a campaign was paused or its event expired.
  if (!liveCampaignV5GloballyEnabled(env) || !Number.isSafeInteger(eventId) || eventId < 1) {
    await sendMessage(env, message.from.id, 'Этот личный полёт сейчас недоступен.');
    return true;
  }

  const event = await env.DB.prepare(
    `SELECT e.id
       FROM v5_events e
       JOIN v5_campaigns p ON p.id=e.campaign_id
       JOIN v5_campaign_chats c ON c.id=p.chat_id
       JOIN v5_chat_settings s ON s.chat_id=c.id
      WHERE e.id=? AND c.status='armed' AND s.game_enabled=1
        AND p.status='active' AND e.status IN ('scheduled','open','locked','resolved')`,
  ).bind(eventId).first<{ id: number }>();
  if (!event) {
    await sendMessage(env, message.from.id, 'Этот личный полёт уже закрыт или пока недоступен.');
    return true;
  }

  const { user } = await ensureUser(env.DB, message.from.id, message.from.username ?? null);
  await env.DB.prepare(
    `UPDATE users SET started_bot_at=COALESCE(started_bot_at,datetime('now')), push_misses=0 WHERE id=?`,
  ).bind(user.id).run();

  const url = buildV5MiniAppUrl(env, event.id);
  await sendMessage(
    env,
    message.from.id,
    'Открой личный полёт: здесь твоя птица, серия и карта ветви.',
    url ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть полёт', web_app: { url } }]] } } : {},
  );
  return true;
}

/**
 * Membership updates are only cached for chats that already exist in V5.
 * This function never creates a chat, campaign or user-facing post.
 */
export async function handleLiveCampaignMembershipUpdate(
  env: Env,
  update: LiveCampaignTelegramMembershipUpdate,
): Promise<boolean> {
  if (!liveCampaignV5GloballyEnabled(env)) return false;
  const chat = await campaignChatByTelegramId(env, update.chat.id);
  if (!chat) return false;
  const member = update.new_chat_member;
  if (member.user.is_bot) return true;
  const { user } = await ensureUser(env.DB, member.user.id, member.user.username ?? null);
  const status = member.user.is_bot
    ? 'left'
    : isActiveMembershipStatus(member.status, member.is_member)
      ? 'verified'
      : member.status === 'kicked' || member.status === 'banned'
        ? 'banned'
        : 'left';
  await env.DB.prepare(
    `INSERT INTO v5_chat_memberships (chat_id,user_id,status,checked_at,updated_at)
     VALUES (?,?,?,datetime('now'),datetime('now'))
     ON CONFLICT(chat_id,user_id) DO UPDATE SET
       status=excluded.status, checked_at=excluded.checked_at, updated_at=excluded.updated_at`,
  ).bind(chat.id, user.id, status).run();
  return true;
}

/**
 * Explicit group command handler. It intentionally sees no message text except
 * the command tail and, for scout/claim/hold/raid, only the replied message id.
 */
export async function handleLiveCampaignGroupCommand(
  env: Env,
  message: LiveCampaignTelegramMessage,
  tail: string,
): Promise<void> {
  const verb = tail.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
  if (!isCampaignGroup(message.chat.type) || !liveCampaignV5GloballyEnabled(env)) return;
  if (!message.from || message.from.is_bot) return;

  // The sole V5 path that is allowed to create or answer in an unregistered
  // group. This keeps the main chat completely silent until an administrator
  // deliberately arms it.
  if (verb === 'arm') {
    if (!(await checkChatAdmin(env, message.chat.id, message.from.id))) return;
    if (!(await checkBotChatAdmin(env, message.chat.id))) {
      await reply(env, message, 'Сначала выдай боту права администратора в этой группе.');
      return;
    }
    await armCommand(env, message);
    return;
  }

  const registered = await campaignChatByTelegramId(env, message.chat.id);
  if (!registered) return;
  if (verb === 'status') {
    await statusCommand(env, message);
    return;
  }
  if (verb === 'scout' || verb === 'claim' || verb === 'hold' || verb === 'raid') {
    await contractCommand(env, message, verb);
    return;
  }
  if (!['open', 'pause', 'publish', 'silence', 'repost'].includes(verb)) {
    await reply(env, message, 'Команды: /kontur arm, open, status, pause. Действие на ответ: /kontur scout, claim, hold или raid.');
    return;
  }
  if (!(await checkChatAdmin(env, message.chat.id, message.from.id))) {
    return;
  }

  if (verb === 'open') await openCommand(env, message);
  else if (verb === 'pause') await pauseCommand(env, message);
  else if (verb === 'publish') await publishCommand(env, message);
  else if (verb === 'silence') await silenceCommand(env, message);
  else await repostCommand(env, message);
}

/**
 * Manual opening is deliberately also exported for a future lifecycle runner.
 * It creates one objective from the current map and only queues a gated,
 * durable publication; it never sends a Telegram message directly.
 */
export async function openLiveCampaignEvent(
  env: Env,
  input: { telegramChatId: number; requestKey: string },
): Promise<OpenLiveCampaignEventResult> {
  const chat = await campaignChatByTelegramId(env, input.telegramChatId);
  if (!chat || chat.status !== 'armed' || Number(chat.game_enabled) !== 1) {
    return { ok: false, reason: 'chat_not_armed' };
  }
  const campaign = await activeCampaign(env, chat.id);
  if (!campaign) return { ok: false, reason: 'campaign_missing' };

  const existing = await currentLiveEvent(env, campaign.id);
  if (existing) return { ok: true, created: false, event: existing };

  await expireStaleCampaignContracts(env, chat.id);
  const contract = await nextPendingCampaignContract(env, chat.id);
  const plan = await nextObjectiveTarget(env, campaign.id, contract?.requested_action);
  if (!plan) return { ok: false, reason: 'no_legal_objective' };
  const target = plan.target;
  const activePlayers = await env.DB.prepare(
    `SELECT count(*) AS count FROM v5_chat_memberships
      WHERE chat_id=? AND status='verified' AND checked_at>=datetime('now','-7 days')`,
  ).bind(chat.id).first<{ count: number }>();
  const eventNumber = await env.DB.prepare(
    'SELECT coalesce(max(event_number)+1,0) AS next FROM v5_events WHERE campaign_id=?',
  ).bind(campaign.id).first<{ next: number }>();
  const nextEventNumber = Number(eventNumber?.next ?? 0);
  const eventTier = Math.min(5, 1 + Math.floor(nextEventNumber / 3));
  const stormSector = await plannedStormSector(env, campaign.id, target);
  const threshold = liveCampaignThreshold(Number(activePlayers?.count ?? 0), eventTier);
  const createdKey = boundedKey(input.requestKey, `v5:open:${chat.id}`);
  let created = false;

  try {
    // D1 batch is a single transaction. A session can therefore never observe
    // an opened event before its one legal objective exists. A contract is
    // scheduled in the same batch only when it actually shaped this event.
    const statements = [
      env.DB.prepare(
        `INSERT OR IGNORE INTO v5_events (
          campaign_id,event_number,status,catalog_key,event_tier,active_players_7d,threshold,
          storm_sector,safety_rail,opens_at,locks_at,forecast_deadline,created_request_key,
          result_json,opened_at
        ) VALUES (?,?, 'open','living-flock',?,?,?,?,0,
          datetime('now'),datetime('now','+8 hours'),datetime('now','+20 minutes'),?, '{}',datetime('now'))`,
      ).bind(campaign.id, nextEventNumber, eventTier, Number(activePlayers?.count ?? 0), threshold, stormSector, createdKey),
      env.DB.prepare(
        `INSERT OR IGNORE INTO v5_event_objectives
          (event_id,sector,action,opening_state,threshold)
         SELECT id,?,?,?,? FROM v5_events
          WHERE campaign_id=? AND created_request_key=?`,
      ).bind(target.sector, target.action, target.state, threshold, campaign.id, createdKey),
    ];
    if (contract && plan.opensRaid) {
      // /raid never changes a solo action. It creates exactly one ordinary
      // four-to-six player raid queue for the server-selected legal sector.
      statements.push(env.DB.prepare(
        `INSERT OR IGNORE INTO v5_raids
          (campaign_id,event_id,target_sector,reward_item_kind,reward_route_sector,client_request_key,queue_closes_at)
         SELECT campaign_id,id,?,'signal-thread',?,?,locks_at
           FROM v5_events
          WHERE campaign_id=? AND created_request_key=?`,
      ).bind(target.sector, target.sector, `v5:contract:${contract.id}:raid`, campaign.id, createdKey));
    }
    if (contract && plan.usesContract) {
      statements.push(env.DB.prepare(
        `UPDATE v5_chat_contracts
            SET status='scheduled',
                scheduled_event_id=(SELECT id FROM v5_events WHERE campaign_id=? AND created_request_key=?),
                resolved_at=NULL
          WHERE id=? AND status='requested' AND scheduled_event_id IS NULL
            AND (expires_at IS NULL OR expires_at>datetime('now'))
            AND EXISTS (
              SELECT 1 FROM v5_events WHERE campaign_id=? AND created_request_key=?
            )`,
      ).bind(campaign.id, createdKey, contract.id, campaign.id, createdKey));
    }
    const writes = await env.DB.batch(statements);
    created = Number(writes[0]?.meta.changes ?? 0) > 0;
  } catch {
    const concurrent = await currentLiveEvent(env, campaign.id);
    if (concurrent) return { ok: true, created: false, event: concurrent };
    throw new Error('V5 event creation failed');
  }
  const event = await currentLiveEvent(env, campaign.id);
  if (!event) throw new Error('V5 event missing after creation');

  if (created) await scheduleNextEventSlot(env, chat.id, event.event_number);

  if (created && canPublish(env, chat)) {
    // The model sees only a server-selected event template. A slow or invalid
    // model result falls back before it can delay or modify game state.
    const notification = await narratedOpeningNotification(env, event, target);
    await enqueueLiveCampaignNotification(env, {
      chatId: chat.id,
      campaignId: campaign.id,
      eventId: event.id,
      kind: 'opening',
      ...notification,
    });
    await flushLiveCampaignOutbox(env, event.id);
  }
  return { ok: true, created, event };
}

/**
 * Deterministic model input: it is derived only from the persisted event
 * number and legal target, never a group message, player or answer.
 */
export function openingNarrativeInput(
  event: Pick<EventRow, 'id' | 'event_number'>,
  target: Pick<LiveCampaignEventTarget, 'sector' | 'action'>,
): V5NarrativeInput {
  const templateId = target.action === 'scout'
    ? 'fractured-route'
    : target.action === 'hold'
      ? 'nest-watch'
      : 'signal-storm';
  const themes: V5NarrativeInput['theme'][] = ['systems', 'visual', 'analysis', 'team'];
  return {
    eventId: String(event.id),
    templateId,
    theme: themes[Math.abs(event.event_number + target.sector) % themes.length]!,
  };
}

/** Model copy is presentation-only; the legal objective stays in D1. */
export function openingNotification(narrative: V5Narrative): NotificationPayload {
  return {
    title: `${narrative.reaction} ${narrative.title}`.slice(0, 90),
    line: `${narrative.brief} ${narrative.cta}. Личный полёт открывается по ссылке.`.slice(0, 220),
  };
}

async function narratedOpeningNotification(
  env: Env,
  event: Pick<EventRow, 'id' | 'event_number'>,
  target: Pick<LiveCampaignEventTarget, 'sector' | 'action'>,
): Promise<NotificationPayload> {
  const narrative = await createV5Narrative(env, openingNarrativeInput(event, target));
  return openingNotification(narrative);
}

async function narratedOpeningNotificationForStoredEvent(
  env: Env,
  event: EventRow,
): Promise<NotificationPayload> {
  const target = await env.DB.prepare(
    `SELECT sector,action FROM v5_event_objectives WHERE event_id=? ORDER BY id LIMIT 1`,
  ).bind(event.id).first<Pick<LiveCampaignEventTarget, 'sector' | 'action'>>();
  if (!target) return { title: 'Ветка зовёт', line: 'Личный полёт открывается по ссылке.' };
  return narratedOpeningNotification(env, event, { sector: Number(target.sector), action: target.action });
}

/** Create a durable, at-most-once group-notification candidate. */
export async function enqueueLiveCampaignNotification(
  env: Env,
  input: {
    chatId: number;
    campaignId: number;
    eventId: number;
    kind: OutboxKind;
    title: string;
    line: string;
  },
): Promise<void> {
  const payload = JSON.stringify({
    title: input.title.slice(0, 90),
    line: input.line.slice(0, 220),
  } satisfies NotificationPayload);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_telegram_outbox
      (chat_id,campaign_id,event_id,kind,payload_json,dedupe_key)
     VALUES (?,?,?,?,?,?)`,
  ).bind(
    input.chatId,
    input.campaignId,
    input.eventId,
    input.kind,
    payload,
    `v5:${input.eventId}:${input.kind}`,
  ).run();
}

/**
 * Safe scheduled work: disabled gates make it a true no-op. With publication
 * enabled it only delivers already durable outbox rows and never derives a
 * reward, answer, message score or game state from chat content.
 */
export async function handleLiveCampaignCron(env: Env, cron: string): Promise<void> {
  if (cron !== LIVE_CAMPAIGN_CRON || !liveCampaignV5GloballyEnabled(env)) return;
  await expireStaleCampaignContracts(env);
  await settleScheduledCampaignContracts(env);
  await rollOverExpiredCampaigns(env);
  await openDueCampaignWindows(env);
  await suppressStaleOutboxClaims(env);
  if (!liveCampaignV5PublishEnabled(env)) return;
  await enqueueRecentResolvedSummaries(env);
  await flushLiveCampaignOutbox(env);
}

async function flushLiveCampaignOutbox(env: Env, eventId?: number): Promise<void> {
  const query = eventId === undefined
    ? `SELECT o.id,o.kind,o.payload_json,c.telegram_chat_id,o.event_id
         FROM v5_telegram_outbox o
         JOIN v5_campaign_chats c ON c.id=o.chat_id
         JOIN v5_chat_settings s ON s.chat_id=c.id
         JOIN v5_campaigns p ON p.id=o.campaign_id
        WHERE o.status='queued' AND c.status='armed'
          AND s.game_enabled=1 AND s.publish_enabled=1 AND p.status='active'
        ORDER BY o.id ASC LIMIT 12`
    : `SELECT o.id,o.kind,o.payload_json,c.telegram_chat_id,o.event_id
         FROM v5_telegram_outbox o
         JOIN v5_campaign_chats c ON c.id=o.chat_id
         JOIN v5_chat_settings s ON s.chat_id=c.id
         JOIN v5_campaigns p ON p.id=o.campaign_id
        WHERE o.status='queued' AND o.event_id=? AND c.status='armed'
          AND s.game_enabled=1 AND s.publish_enabled=1 AND p.status='active'
        ORDER BY o.id ASC LIMIT 1`;
  const statement = env.DB.prepare(query);
  const rows = (eventId === undefined
    ? await statement.all<OutboxRow>()
    : await statement.bind(eventId).all<OutboxRow>()).results;
  for (const row of rows) await deliverOutboxRow(env, row);
}

async function openDueCampaignWindows(env: Env): Promise<void> {
  const rows = (await env.DB.prepare(
    `SELECT c.id,c.telegram_chat_id,c.next_event_at
       FROM v5_campaign_chats c
       JOIN v5_chat_settings s ON s.chat_id=c.id
       JOIN v5_campaigns p ON p.chat_id=c.id AND p.status='active'
      WHERE c.status='armed' AND s.game_enabled=1
        AND c.next_event_at IS NOT NULL AND c.next_event_at<=datetime('now')
        AND p.ends_at>datetime('now')
        AND NOT EXISTS (
          SELECT 1 FROM v5_events e
           WHERE e.campaign_id=p.id AND e.status IN ('open','locked')
        )
      ORDER BY c.next_event_at,c.id LIMIT 12`,
  ).all<DueCampaignChatRow>()).results;
  for (const row of rows) {
    await openLiveCampaignEvent(env, {
      telegramChatId: Number(row.telegram_chat_id),
      requestKey: `cron:open:${row.id}:${row.next_event_at}`,
    });
  }
}

/** A chat can remain alive for months: every completed 28-day tree receives a fresh campaign. */
async function rollOverExpiredCampaigns(env: Env): Promise<void> {
  await env.DB.prepare(
      `UPDATE v5_campaigns
        SET status='resolved',resolved_at=COALESCE(resolved_at,datetime('now')),updated_at=datetime('now')
      WHERE status='active' AND ends_at<=datetime('now')
        AND NOT EXISTS (
          SELECT 1 FROM v5_events live
           WHERE live.campaign_id=v5_campaigns.id
             AND live.status IN ('open','locked')
        )`,
  ).run();
  const chats = (await env.DB.prepare(
    `SELECT c.id
       FROM v5_campaign_chats c
       JOIN v5_chat_settings s ON s.chat_id=c.id
      WHERE c.status='armed' AND s.game_enabled=1
        AND NOT EXISTS (
          SELECT 1 FROM v5_campaigns active WHERE active.chat_id=c.id AND active.status='active'
        )
      ORDER BY c.id LIMIT 12`,
  ).all<CampaignRolloverChatRow>()).results;
  const cycleKey = new Date().toISOString().slice(0, 10);
  for (const chat of chats) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO v5_campaigns
        (chat_id,campaign_number,catalog_key,catalog_version,status,starts_at,ends_at,created_request_key,activated_at)
       SELECT c.id,
         (SELECT coalesce(max(campaign_number)+1,0) FROM v5_campaigns WHERE chat_id=c.id),
         'living-flock','v5','active',datetime('now'),datetime('now','+28 days'),?,datetime('now')
        FROM v5_campaign_chats c
       WHERE c.id=? AND NOT EXISTS (
         SELECT 1 FROM v5_campaigns active WHERE active.chat_id=c.id AND active.status='active'
       )`,
    ).bind(`v5:auto-rollover:${chat.id}:${cycleKey}`, chat.id).run();
    const campaign = await activeCampaign(env, chat.id);
    if (!campaign) continue;
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE v5_campaign_chats
            SET campaign_id=?,next_event_at=datetime('now','+1 hour'),updated_at=datetime('now')
          WHERE id=? AND status='armed'`,
      ).bind(campaign.id, chat.id),
      env.DB.prepare(
        `INSERT OR IGNORE INTO v5_campaign_sectors (campaign_id,sector,state)
         VALUES (?,0,'exposed'),(?,1,'hidden'),(?,2,'hidden'),(?,3,'hidden'),
                (?,4,'hidden'),(?,5,'hidden'),(?,6,'hidden')`,
      ).bind(campaign.id, campaign.id, campaign.id, campaign.id, campaign.id, campaign.id, campaign.id),
    ]);
  }
}

async function enqueueRecentResolvedSummaries(env: Env): Promise<void> {
  const rows = (await env.DB.prepare(
    `SELECT c.id AS chat_id,e.campaign_id,e.id AS event_id,e.result_json,
            (SELECT count(*) FROM v5_map_mutations mutation WHERE mutation.event_id=e.id) AS map_mutation_count
       FROM v5_events e
       JOIN v5_campaigns p ON p.id=e.campaign_id
       JOIN v5_campaign_chats c ON c.id=p.chat_id
       JOIN v5_chat_settings s ON s.chat_id=c.id
      WHERE e.status='resolved' AND e.resolved_at>=datetime('now','-2 hours')
        AND c.status='armed' AND s.game_enabled=1 AND s.publish_enabled=1
        AND NOT EXISTS (
          SELECT 1 FROM v5_telegram_outbox o WHERE o.event_id=e.id AND o.kind='summary'
        )
      ORDER BY e.resolved_at,e.id LIMIT 12`,
  ).all<ResolvedCampaignEventRow>()).results;
  for (const row of rows) {
    const summary = liveCampaignSummaryNotification(row.result_json, Number(row.map_mutation_count ?? 0));
    await enqueueLiveCampaignNotification(env, {
      chatId: Number(row.chat_id),
      campaignId: Number(row.campaign_id),
      eventId: Number(row.event_id),
      kind: 'summary',
      ...summary,
    });
  }
}

/**
 * A group summary is an aggregate over two already-persisted server records.
 * It never renders raw result JSON, player data, answers, forecasts or chat
 * text — even if malformed data gets into one of those records.
 */
export function liveCampaignSummaryNotification(
  resultJson: string | null | undefined,
  durableMapMutationCount: number,
): NotificationPayload {
  let completedObjectives = 0;
  let totalObjectives = 0;
  try {
    const parsed = resultJson ? JSON.parse(resultJson) as { objectives?: unknown } : null;
    if (Array.isArray(parsed?.objectives)) {
      totalObjectives = parsed.objectives.filter((entry) => entry && typeof entry === 'object').length;
      completedObjectives = parsed.objectives.filter((entry) => (
        entry && typeof entry === 'object' && (entry as { status?: unknown }).status === 'completed'
      )).length;
    }
  } catch { /* The aggregate below remains deterministic for malformed JSON. */ }
  const mutations = Number.isSafeInteger(durableMapMutationCount)
    ? Math.max(0, Math.min(99, durableMapMutationCount))
    : 0;
  const objectiveLine = totalObjectives === 0
    ? 'Окно закрыто: итог карты зафиксирован сервером.'
    : completedObjectives > 0
      ? `Окно закрыто: карта приняла ${completedObjectives} ${pluralRu(completedObjectives, 'переход', 'перехода', 'переходов')}.`
      : 'Окно закрыто: новых переходов на карте нет.';
  const mutationLine = mutations > 0
    ? ` В истории карты сохранено ${mutations} ${pluralRu(mutations, 'изменение', 'изменения', 'изменений')}.`
    : ' Изменений карты в этом окне не зафиксировано.';
  return {
    title: 'Итог ветви',
    line: `${objectiveLine}${mutationLine} Карта кампании доступна в личном полёте.`,
  };
}

function pluralRu(value: number, one: string, few: string, many: string): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = value % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

async function suppressStaleOutboxClaims(env: Env): Promise<void> {
  await env.DB.prepare(
    `UPDATE v5_telegram_outbox
        SET status='suppressed',updated_at=datetime('now'),last_error_code='CLAIM_EXPIRED'
      WHERE status='claimed' AND claimed_at<datetime('now','-15 minutes')`,
  ).run();
}

async function armCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const { user } = await ensureUser(env.DB, message.from!.id, message.from!.username ?? null);
  const requestKey = boundedKey(`tg:arm:${message.chat.id}:${message.message_id}`, 'v5:arm');
  await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_campaign_chats
      (telegram_chat_id,status,schedule_json,next_event_at,created_request_id,armed_at)
     VALUES (?, 'armed', ?, datetime('now','+1 hour'), ?, datetime('now'))`,
  ).bind(
    message.chat.id,
    JSON.stringify({ cadenceDays: [0, 2, 4], windowHours: 8, campaignDays: LIVE_CAMPAIGN_LENGTH_DAYS }),
    requestKey,
  ).run();
  await env.DB.prepare(
    `UPDATE v5_campaign_chats
        SET status='armed', armed_at=COALESCE(armed_at,datetime('now')),
            paused_at=NULL, next_event_at=COALESCE(next_event_at,datetime('now','+1 hour')),
            updated_at=datetime('now')
      WHERE telegram_chat_id=? AND status IN ('draft','paused')`,
  ).bind(message.chat.id).run();
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat) throw new Error('V5 chat missing after arm');
  await env.DB.prepare(
    `INSERT INTO v5_chat_settings (chat_id,game_enabled,publish_enabled)
     VALUES (?,1,0)
     ON CONFLICT(chat_id) DO UPDATE SET game_enabled=1, updated_at=datetime('now')`,
  ).bind(chat.id).run();
  await upsertCampaignMembership(env, chat.id, user.id, 'verified');

  await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_campaigns
      (chat_id,campaign_number,catalog_key,catalog_version,status,starts_at,ends_at,
       created_request_key,activated_at)
     SELECT c.id,
       (SELECT coalesce(max(campaign_number)+1,0) FROM v5_campaigns WHERE chat_id=c.id),
       'living-flock','v5','active',datetime('now'),datetime('now','+28 days'),?,datetime('now')
       FROM v5_campaign_chats c
      WHERE c.id=? AND NOT EXISTS (
        SELECT 1 FROM v5_campaigns active
         WHERE active.chat_id=c.id AND active.status='active'
      )`,
  ).bind(requestKey, chat.id).run();
  const campaign = await activeCampaign(env, chat.id);
  if (!campaign) throw new Error('V5 campaign missing after arm');
  await env.DB.prepare(
    `UPDATE v5_campaign_chats SET campaign_id=?,updated_at=datetime('now') WHERE id=?`,
  ).bind(campaign.id, chat.id).run();
  await ensureCampaignSectors(env, campaign.id);
  await reply(env, message, 'Кампания поставлена на крыло. Окно открывает администратор: /kontur open. Публикации в группу пока выключены.');
}

async function openCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const result = await openLiveCampaignEvent(env, {
    telegramChatId: message.chat.id,
    requestKey: `tg:open:${message.chat.id}:${message.message_id}`,
  });
  if (!result.ok) {
    const text = result.reason === 'chat_not_armed'
      ? 'Сначала зарегистрируй этот чат: /kontur arm.'
      : result.reason === 'campaign_missing'
        ? 'У кампании пока нет активного сезона. Повтори /kontur arm.'
        : 'На карте нет легального следующего действия.';
    await reply(env, message, text);
    return;
  }
  const deepLink = buildV5DeepLink(env, result.event.id);
  const linkLine = deepLink
    ? `Личный вход (publish-gate не нужен): ${deepLink}`
    : `Личный вход: в личке боту /start v5_${result.event.id}`;
  await reply(
    env,
    message,
    result.created
      ? `Окно #${result.event.id} открыто на восемь часов.\n${linkLine}\nГрупповая публикация по-прежнему зависит от отдельного publish-gate.`
      : `Окно #${result.event.id} уже открыто: повторная команда не создала второй раунд.\n${linkLine}`,
  );
}

async function pauseCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat) {
    await reply(env, message, 'Этот чат ещё не зарегистрирован в кампании.');
    return;
  }
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE v5_campaign_chats
          SET status='paused',paused_at=datetime('now'),next_event_at=NULL,updated_at=datetime('now')
        WHERE id=?`,
    ).bind(chat.id),
    env.DB.prepare(
      `UPDATE v5_chat_settings SET game_enabled=0,publish_enabled=0,updated_at=datetime('now') WHERE chat_id=?`,
    ).bind(chat.id),
    env.DB.prepare(
      `UPDATE v5_telegram_outbox SET status='suppressed',updated_at=datetime('now'),last_error_code='CHAT_PAUSED'
        WHERE chat_id=? AND status='queued'`,
    ).bind(chat.id),
  ]);
  await reply(env, message, 'Кампания в этом чате на паузе. Повторный /kontur arm включает её без новой кампании.');
}

async function publishCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat || chat.status !== 'armed' || Number(chat.game_enabled) !== 1) {
    await reply(env, message, 'Сначала включи кампанию командой /kontur arm.');
    return;
  }
  if (!liveCampaignV5PublishEnabled(env)) {
    await reply(env, message, 'Глобальный publish-gate выключен: в чат ничего не будет отправлено.');
    return;
  }
  if (!buildV5DeepLink(env, 1)) {
    await reply(env, message, 'Для публикаций сначала задай корректный V5_BOT_USERNAME.');
    return;
  }
  await env.DB.prepare(
    `UPDATE v5_chat_settings SET publish_enabled=1,updated_at=datetime('now') WHERE chat_id=? AND game_enabled=1`,
  ).bind(chat.id).run();
  const campaign = await activeCampaign(env, chat.id);
  const event = campaign ? await currentLiveEvent(env, campaign.id) : null;
  if (campaign && event) {
    const notification = await narratedOpeningNotificationForStoredEvent(env, event);
    await enqueueLiveCampaignNotification(env, {
      chatId: chat.id,
      campaignId: campaign.id,
      eventId: event.id,
      kind: 'opening',
      ...notification,
    });
    await flushLiveCampaignOutbox(env, event.id);
  }
  await reply(env, message, 'Публикации включены для этого чата. В них будет только URL личного полёта, без group Web App.');
}

async function silenceCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat) {
    await reply(env, message, 'Этот чат ещё не зарегистрирован в кампании.');
    return;
  }
  await env.DB.prepare(
    `UPDATE v5_chat_settings SET publish_enabled=0,updated_at=datetime('now') WHERE chat_id=?`,
  ).bind(chat.id).run();
  await reply(env, message, 'Публикации в этот чат выключены. Игра и личные deep-link остаются доступны.');
}

/** Explicit recovery only: a suppressed opening can be retried by an admin once. */
async function repostCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat || !canPublish(env, chat) || !buildV5DeepLink(env, 1)) {
    await reply(env, message, 'Для повторной публикации нужны включённые game/publish-gates и V5_BOT_USERNAME.');
    return;
  }
  const campaign = await activeCampaign(env, chat.id);
  const event = campaign ? await currentLiveEvent(env, campaign.id) : null;
  if (!event) {
    await reply(env, message, 'Сейчас нет открытого окна для повторной публикации.');
    return;
  }
  const restored = await env.DB.prepare(
    `UPDATE v5_telegram_outbox
        SET status='queued',claim_token=NULL,claimed_at=NULL,updated_at=datetime('now'),last_error_code='MANUAL_REPOST'
      WHERE event_id=? AND kind='opening' AND status='suppressed'`,
  ).bind(event.id).run();
  if (!restored.meta.changes) {
    await reply(env, message, 'Для этого окна нет подавленной публикации.');
    return;
  }
  await flushLiveCampaignOutbox(env, event.id);
  await reply(env, message, 'Повторная публикация поставлена в безопасную одноразовую доставку.');
}

async function statusCommand(env: Env, message: LiveCampaignTelegramMessage): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat) {
    await reply(env, message, 'Этот чат ещё не зарегистрирован. Администратор может начать с /kontur arm.');
    return;
  }
  const campaign = await activeCampaign(env, chat.id);
  const event = campaign ? await currentLiveEvent(env, campaign.id) : null;
  const state = chat.status === 'armed' && Number(chat.game_enabled) === 1 ? 'активна' : 'на паузе';
  const publication = Number(chat.publish_enabled) === 1 && liveCampaignV5PublishEnabled(env) ? 'включены' : 'выключены';
  const eventText = event ? `окно #${event.event_number + 1}: ${event.status}` : 'открытого окна нет';
  await reply(env, message, `Контур V5: ${state}; ${eventText}; публикации ${publication}.`);
}

async function contractCommand(
  env: Env,
  message: LiveCampaignTelegramMessage,
  requestedAction: 'scout' | 'claim' | 'hold' | 'raid',
): Promise<void> {
  const chat = await campaignChatByTelegramId(env, message.chat.id);
  if (!chat || chat.status !== 'armed' || Number(chat.game_enabled) !== 1) {
    await reply(env, message, 'Здесь пока нет активной кампании.');
    return;
  }
  if (!message.reply_to_message) {
    await reply(env, message, 'Ответь этой командой на конкретное сообщение. Текст сообщения не сохраняется.');
    return;
  }
  const { user } = await ensureUser(env.DB, message.from!.id, message.from!.username ?? null);
  // The normal next window is two or three days away. Four days keeps a
  // contract bounded while giving one valid request a chance to reach it.
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_chat_contracts
      (chat_id,source_message_id,requester_user_id,requested_action,client_request_id,expires_at)
     VALUES (?,?,?,?,?,datetime('now','+4 days'))`,
  ).bind(
    chat.id,
    message.reply_to_message.message_id,
    user.id,
    requestedAction,
    boundedKey(`tg:contract:${message.chat.id}:${message.message_id}`, 'v5:contract'),
  ).run();
  if (result.meta.changes) {
    // The command itself is transient. No message body or author is inspected.
    try {
      await telegramCall(env, 'deleteMessage', { chat_id: message.chat.id, message_id: message.message_id });
    } catch { /* A missing delete privilege must not duplicate the contract. */ }
    return;
  }
  const prior = await env.DB.prepare(
    `SELECT requester_user_id FROM v5_chat_contracts WHERE chat_id=? AND source_message_id=?`,
  ).bind(chat.id, message.reply_to_message.message_id).first<{ requester_user_id: number }>();
  await reply(
    env,
    message,
    prior?.requester_user_id === user.id
      ? 'Этот контракт уже записан; повторная команда не создаёт второй.'
      : 'Для этого сообщения уже есть один контракт кампании.',
  );
}

async function deliverOutboxRow(env: Env, row: OutboxRow): Promise<void> {
  const token = crypto.randomUUID();
  const claim = await env.DB.prepare(
    `UPDATE v5_telegram_outbox
        SET status='claimed',claim_token=?,claimed_at=datetime('now'),
            attempt_count=attempt_count+1,updated_at=datetime('now')
      WHERE id=? AND status='queued'
      RETURNING id`,
  ).bind(token, row.id).first<{ id: number }>();
  if (!claim) return;
  const url = buildV5DeepLink(env, row.event_id);
  if (!url) {
    await suppressOutbox(env, row.id, token, 'NO_DEEP_LINK');
    return;
  }
  const payload = parseNotificationPayload(row.payload_json, row.kind);
  try {
    const result = await telegramCall<{ message_id: number }>(env, 'sendMessage', {
      chat_id: row.telegram_chat_id,
      text: `${payload.title}\n${payload.line}`.slice(0, 4096),
      reply_markup: { inline_keyboard: [[{ text: 'Открыть личный полёт', url }]] },
    });
    if (!result) {
      await suppressOutbox(env, row.id, token, 'TELEGRAM_UNKNOWN');
      return;
    }
    await env.DB.prepare(
      `UPDATE v5_telegram_outbox
          SET status='sent',sent_at=datetime('now'),telegram_message_id=?,
              updated_at=datetime('now'),last_error_code=NULL
        WHERE id=? AND status='claimed' AND claim_token=?`,
    ).bind(result.message_id, row.id, token).run();
  } catch (error) {
    await suppressOutbox(env, row.id, token, error instanceof Error ? error.name.slice(0, 80) : 'UNKNOWN_ERROR');
  }
}

async function suppressOutbox(env: Env, id: number, token: string, reason: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE v5_telegram_outbox
        SET status='suppressed',updated_at=datetime('now'),last_error_code=?
      WHERE id=? AND status='claimed' AND claim_token=?`,
  ).bind(reason, id, token).run();
}

function parseNotificationPayload(value: string, kind: OutboxKind): NotificationPayload {
  try {
    const parsed = JSON.parse(value) as Partial<NotificationPayload>;
    if (typeof parsed.title === 'string' && typeof parsed.line === 'string') {
      return { title: parsed.title.slice(0, 90), line: parsed.line.slice(0, 220) };
    }
  } catch { /* The static fallback below is intentionally safe. */ }
  return kind === 'opening'
    ? { title: 'Ветка зовёт', line: 'Личный полёт открыт.' }
    : { title: 'Итог ветви', line: 'Карта обновилась в личном полёте.' };
}

async function campaignChatByTelegramId(env: Env, telegramChatId: number): Promise<CampaignChatRow | null> {
  return env.DB.prepare(
    `SELECT c.id,c.telegram_chat_id,c.status,c.campaign_id,
            coalesce(s.game_enabled,0) AS game_enabled,
            coalesce(s.publish_enabled,0) AS publish_enabled
       FROM v5_campaign_chats c
       LEFT JOIN v5_chat_settings s ON s.chat_id=c.id
      WHERE c.telegram_chat_id=?`,
  ).bind(telegramChatId).first<CampaignChatRow>();
}

async function activeCampaign(env: Env, chatId: number): Promise<CampaignRow | null> {
  return env.DB.prepare(
    `SELECT id,campaign_number,status FROM v5_campaigns
      WHERE chat_id=? AND status='active' ORDER BY id DESC LIMIT 1`,
  ).bind(chatId).first<CampaignRow>();
}

async function currentLiveEvent(env: Env, campaignId: number): Promise<EventRow | null> {
  return env.DB.prepare(
    `SELECT id,campaign_id,event_number,status,threshold,opens_at,locks_at,forecast_deadline
       FROM v5_events WHERE campaign_id=? AND status IN ('open','locked')
      ORDER BY id DESC LIMIT 1`,
  ).bind(campaignId).first<EventRow>();
}

/** Three 8h windows a week: two, two, then three days after the last opening. */
async function scheduleNextEventSlot(env: Env, chatId: number, eventNumber: number): Promise<void> {
  const modifier = eventNumber % 3 === 2 ? '+3 days' : '+2 days';
  await env.DB.prepare(
    `UPDATE v5_campaign_chats
        SET next_event_at=datetime('now',?),updated_at=datetime('now')
      WHERE id=? AND status='armed'`,
  ).bind(modifier, chatId).run();
}

/**
 * Converts only durable map state plus an optional command verb into one legal
 * event plan. It deliberately receives no Telegram message body, author or
 * reply metadata. If a requested solo action is not currently legal, it is
 * left pending instead of being silently reinterpreted.
 */
export function planLiveCampaignEvent(
  sectors: readonly SectorRow[],
  requestedAction?: LiveCampaignContractAction,
): LiveCampaignEventPlan | null {
  const legal = sectors
    .filter((sector) => sector.state !== 'rooted')
    .map<LiveCampaignEventTarget>((sector) => ({
      sector: Number(sector.sector),
      state: sector.state,
      action: sector.state === 'exposed'
        ? 'claim'
        : sector.state === 'secured'
          ? 'hold'
          : 'scout',
    }));
  const defaultTarget = legal.find((entry) => entry.state === 'exposed')
    ?? legal.find((entry) => entry.state === 'secured')
    ?? legal.find((entry) => entry.state === 'hidden');
  if (!defaultTarget) return null;

  if (requestedAction === 'raid') {
    return { target: defaultTarget, usesContract: true, opensRaid: true };
  }
  if (requestedAction) {
    const matchingTarget = legal.find((entry) => entry.action === requestedAction);
    if (matchingTarget) return { target: matchingTarget, usesContract: true, opensRaid: false };
  }
  return { target: defaultTarget, usesContract: false, opensRaid: false };
}

async function nextObjectiveTarget(
  env: Env,
  campaignId: number,
  requestedAction?: LiveCampaignContractAction,
): Promise<LiveCampaignEventPlan | null> {
  const sectors = (await env.DB.prepare(
    `SELECT sector,state FROM v5_campaign_sectors WHERE campaign_id=?
      ORDER BY CASE state WHEN 'exposed' THEN 0 WHEN 'secured' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END, sector`,
  ).bind(campaignId).all<SectorRow>()).results;
  return planLiveCampaignEvent(sectors, requestedAction);
}

/**
 * A storm is scheduled only when the current objective is a scout. A completed
 * scout therefore reveals a real upcoming risk; the next event may then spend
 * its one legal action on a hold instead of pretending the ward is cosmetic.
 */
async function plannedStormSector(
  env: Env,
  campaignId: number,
  target: LiveCampaignEventTarget,
): Promise<number | null> {
  if (target.action !== 'scout') return null;
  const row = await env.DB.prepare(
    `SELECT sector FROM v5_campaign_sectors
      WHERE campaign_id=? AND state IN ('rooted','secured')
      ORDER BY CASE state WHEN 'rooted' THEN 0 ELSE 1 END, sector LIMIT 1`,
  ).bind(campaignId).first<{ sector: number }>();
  return row ? Number(row.sector) : null;
}

async function nextPendingCampaignContract(env: Env, chatId: number): Promise<PendingContractRow | null> {
  const row = await env.DB.prepare(
    `SELECT id,requested_action FROM v5_chat_contracts
      WHERE chat_id=? AND status='requested'
        AND (expires_at IS NULL OR expires_at>datetime('now'))
      ORDER BY created_at,id LIMIT 1`,
  ).bind(chatId).first<PendingContractRow>();
  if (!row || !['scout', 'claim', 'hold', 'raid'].includes(row.requested_action)) return null;
  return { id: Number(row.id), requested_action: row.requested_action };
}

async function expireStaleCampaignContracts(env: Env, chatId?: number): Promise<void> {
  const scoped = chatId === undefined ? '' : ' AND chat_id=?';
  const statement = env.DB.prepare(
    `UPDATE v5_chat_contracts
        SET status='expired',resolved_at=COALESCE(resolved_at,datetime('now'))
      WHERE status='requested' AND expires_at IS NOT NULL AND expires_at<=datetime('now')${scoped}`,
  );
  if (chatId === undefined) await statement.run();
  else await statement.bind(chatId).run();
}

async function settleScheduledCampaignContracts(env: Env): Promise<void> {
  await env.DB.prepare(
    `UPDATE v5_chat_contracts
        SET status='fulfilled',resolved_at=COALESCE(resolved_at,datetime('now'))
      WHERE status='scheduled' AND scheduled_event_id IN (
        SELECT id FROM v5_events WHERE status='resolved'
      )`,
  ).run();
}

async function ensureCampaignSectors(env: Env, campaignId: number): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_campaign_sectors (campaign_id,sector,state)
     VALUES (?,0,'exposed'),(?,1,'hidden'),(?,2,'hidden'),(?,3,'hidden'),
            (?,4,'hidden'),(?,5,'hidden'),(?,6,'hidden')`,
  ).bind(campaignId, campaignId, campaignId, campaignId, campaignId, campaignId, campaignId).run();
}

async function upsertCampaignMembership(
  env: Env,
  chatId: number,
  userId: number,
  status: 'verified' | 'left' | 'banned',
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO v5_chat_memberships (chat_id,user_id,status,checked_at,updated_at)
     VALUES (?,?,?,datetime('now'),datetime('now'))
     ON CONFLICT(chat_id,user_id) DO UPDATE SET
       status=excluded.status,checked_at=excluded.checked_at,updated_at=excluded.updated_at`,
  ).bind(chatId, userId, status).run();
}

function canPublish(env: Env, chat: CampaignChatRow): boolean {
  return liveCampaignV5GloballyEnabled(env)
    && liveCampaignV5PublishEnabled(env)
    && chat.status === 'armed'
    && Number(chat.game_enabled) === 1
    && Number(chat.publish_enabled) === 1;
}

function boundedKey(value: string, fallback: string): string {
  const normalized = value.trim().slice(0, 120);
  return normalized.length >= 8 ? normalized : `${fallback}:${crypto.randomUUID()}`;
}

function isCampaignGroup(type: string): boolean {
  return type === 'group' || type === 'supergroup';
}

function isActiveMembershipStatus(status: string, isMember?: boolean): boolean {
  return status === 'creator'
    || status === 'administrator'
    || status === 'member'
    || (status === 'restricted' && isMember === true);
}

async function reply(env: Env, message: LiveCampaignTelegramMessage, text: string): Promise<void> {
  await sendMessage(env, message.chat.id, text, {
    reply_parameters: { message_id: message.message_id },
  });
}
