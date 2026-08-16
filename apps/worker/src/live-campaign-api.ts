import { Hono } from 'hono';
import {
  LIVE_CAMPAIGN_ACTIONS,
  LIVE_CAMPAIGN_BIRDS,
  LIVE_CAMPAIGN_ITEM_DEFINITIONS,
  applyLiveCampaignSafetyRail,
  createLiveCampaignChallenge,
  evaluateLiveCampaignChallenge,
  resolveLiveCampaignAction,
  resolveLiveCampaignStorm,
  toLiveCampaignChallengeClient,
  type LiveCampaignAction,
  type LiveCampaignBird,
  type LiveCampaignCardKind,
  type LiveCampaignItemKind,
  type LiveCampaignMap,
  type LiveCampaignSectorState,
} from '@kontur/core';
import { GameError } from './errors.js';
import { liveCampaignV5GloballyEnabled } from './experience-access.js';
import { checkChatMembership } from './telegram-api.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const liveCampaignApi = new Hono<AppEnv>();

const birds = new Set<string>(LIVE_CAMPAIGN_BIRDS);
const actions = new Set<string>(LIVE_CAMPAIGN_ACTIONS);
const cardKinds = new Set<string>(['base', 'track', 'chain', 'tactical', 'risk']);
const V5_CARD_CATALOG_VERSION = 'v5-catalog-1';
const V5_SESSION_SECONDS = 75;
const MEMBER_CACHE_MS = 6 * 60 * 60 * 1000;

type EventStatus = 'scheduled' | 'open' | 'locked' | 'resolved';
type ObjectiveStatus = 'open' | 'completed' | 'failed' | 'void';

interface EventAccessRow {
  event_id: number;
  event_number: number;
  event_status: EventStatus;
  event_tier: number;
  threshold: number;
  opens_at: string;
  locks_at: string;
  forecast_deadline: string;
  storm_sector: number | null;
  campaign_id: number;
  campaign_number: number;
  campaign_status: 'scheduled' | 'active' | 'resolved' | 'archived';
  campaign_starts_at: string;
  campaign_ends_at: string;
  chat_id: number;
  telegram_chat_id: number;
  chat_status: 'draft' | 'armed' | 'paused';
  game_enabled: number;
}

interface ObjectiveRow {
  id: number;
  sector: number;
  action: LiveCampaignAction;
  opening_state: LiveCampaignSectorState;
  threshold: number;
  progress: number;
  status: ObjectiveStatus;
}

interface SessionRow {
  id: number;
  campaign_id: number;
  event_id: number;
  user_id: number;
  active_bird: LiveCampaignBird;
  sector: number;
  action: LiveCampaignAction;
  status: 'started' | 'submitted' | 'settled' | 'timed_out';
  seed: string;
  map_snapshot_json: string;
  client_request_id: string;
  close_at: string;
  result_json: string | null;
  evidence_score: number | null;
}

interface ActiveBirdRow {
  bird: LiveCampaignBird;
  form: 1 | 2;
  path_feathers: number;
  is_locked: number;
  signature_action: LiveCampaignAction | null;
  signature_used_at: string | null;
  signature_request_id: string | null;
}

interface InventoryRow {
  id: number;
  item_kind: string;
  status: 'owned' | 'armed' | 'consumed' | 'discarded';
}

interface SessionCardRow {
  position: number;
  kind: LiveCampaignCardKind;
  render_json: string;
  correct_option: number;
}

const PRETEST = [
  {
    id: 'trace',
    prompt: 'В коротком проекте ошибка появляется только у части людей. Что проверишь первым?',
    options: [
      { bird: 'woodpecker', text: 'Конкретный шаг, входные данные и место сбоя' },
      { bird: 'owl', text: 'Какая группа затронута и не смешались ли причины' },
      { bird: 'magpie', text: 'Понятно ли человеку, что он увидел и куда нажать' },
      { bird: 'crane', text: 'Что заблокировано и кого нужно синхронизировать' },
    ],
  },
  {
    id: 'flow',
    prompt: 'Команда ждёт один неготовый вход. Какой ход полезнее всего?',
    options: [
      { bird: 'crane', text: 'Снять блокировку, от которой зависят остальные' },
      { bird: 'woodpecker', text: 'Проверить формат и контракт этого входа' },
      { bird: 'owl', text: 'Оценить, насколько задержка действительно меняет результат' },
      { bird: 'magpie', text: 'Сделать статус и следующий шаг видимыми всем' },
    ],
  },
  {
    id: 'signal',
    prompt: 'Люди пропускают одно главное действие на экране. Что изменишь?',
    options: [
      { bird: 'magpie', text: 'Текст, иерархию и форму главного действия' },
      { bird: 'woodpecker', text: 'Сначала проверю, что само действие не ломается' },
      { bird: 'owl', text: 'Сравню поведение разных групп до и после изменения' },
      { bird: 'crane', text: 'Назначу владельца и короткий срок проверки' },
    ],
  },
  {
    id: 'evidence',
    prompt: 'После изменения метрика выросла, но одновременно пришла другая аудитория. Какой вывод честный?',
    options: [
      { bird: 'owl', text: 'Связь есть, но причинность ещё не доказана' },
      { bird: 'woodpecker', text: 'Нужно проверить логи и саму реализацию изменения' },
      { bird: 'magpie', text: 'Нужно спросить, что именно увидели люди' },
      { bird: 'crane', text: 'Нужно договориться о следующем измерении' },
    ],
  },
  {
    id: 'edge',
    prompt: 'Цикл должен обработать ровно N элементов. Что проверишь?',
    options: [
      { bird: 'woodpecker', text: 'Границу цикла и состояние после последней итерации' },
      { bird: 'crane', text: 'Кто отвечает за входные данные и проверку' },
      { bird: 'owl', text: 'Какие случаи не попали в измерение' },
      { bird: 'magpie', text: 'Понятно ли сообщение об ошибке тому, кто его увидит' },
    ],
  },
  {
    id: 'handoff',
    prompt: 'Нужно передать решение другому человеку без созвона. Что обязательно?',
    options: [
      { bird: 'crane', text: 'Зафиксировать владельца, решение, зависимость и срок' },
      { bird: 'magpie', text: 'Описать следующий шаг коротко и заметно' },
      { bird: 'woodpecker', text: 'Приложить воспроизводимый пример и проверку' },
      { bird: 'owl', text: 'Указать, какие данные подтверждают решение' },
    ],
  },
] as const satisfies readonly { id: string; prompt: string; options: readonly { bird: LiveCampaignBird; text: string }[] }[];

function numberValue(value: unknown, field: string, min = 1): number {
  const result = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(result) || (result as number) < min) throw new GameError('VALIDATION', { field });
  return result as number;
}

function requestId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new GameError('VALIDATION', { field: 'clientRequestId' });
  }
  return value;
}

async function json(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const value = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value as Record<string, unknown>;
  } catch {
    throw new GameError('VALIDATION');
  }
}

function sqlTime(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toIso(value: string): string {
  return new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]!;
}

function eventIdFrom(c: { req: { query(name: string): string | undefined } }, body?: Record<string, unknown>): number {
  return numberValue(body?.eventId ?? c.req.query('eventId'), 'eventId');
}

async function requireEventAccess(
  env: Env,
  userId: number,
  eventId: number,
  freshMembership = false,
): Promise<EventAccessRow> {
  if (!liveCampaignV5GloballyEnabled(env)) throw new GameError('EXPERIENCE_DISABLED');
  const row = await env.DB.prepare(
    `SELECT e.id AS event_id, e.event_number, e.status AS event_status, e.event_tier, e.threshold,
            e.opens_at, e.locks_at, e.forecast_deadline, e.storm_sector,
            campaign.id AS campaign_id, campaign.campaign_number, campaign.status AS campaign_status,
            campaign.starts_at AS campaign_starts_at, campaign.ends_at AS campaign_ends_at,
            chat.id AS chat_id, chat.telegram_chat_id, chat.status AS chat_status,
            settings.game_enabled
       FROM v5_events e
       JOIN v5_campaigns campaign ON campaign.id = e.campaign_id
       JOIN v5_campaign_chats chat ON chat.id = campaign.chat_id
       JOIN v5_chat_settings settings ON settings.chat_id = chat.id
      WHERE e.id = ?`,
  ).bind(eventId).first<EventAccessRow>();
  if (!row || row.game_enabled !== 1 || row.chat_status !== 'armed' || row.campaign_status !== 'active') {
    throw new GameError('FEATURE_LOCKED', { reason: 'v5_event_unavailable' });
  }

  const user = await env.DB.prepare('SELECT tg_id FROM users WHERE id = ?')
    .bind(userId).first<{ tg_id: number }>();
  if (!user) throw new GameError('SESSION_EXPIRED');
  const cached = await env.DB.prepare(
    `SELECT status, checked_at, expires_at FROM v5_chat_memberships WHERE chat_id = ? AND user_id = ?`,
  ).bind(row.chat_id, userId).first<{ status: 'verified' | 'left' | 'banned'; checked_at: string; expires_at: string | null }>();
  const checkedAt = cached ? Date.parse(`${cached.checked_at}Z`) : 0;
  const cacheFresh = !freshMembership && cached && Number.isFinite(checkedAt) && Date.now() - checkedAt < MEMBER_CACHE_MS
    && (!cached.expires_at || Date.parse(`${cached.expires_at}Z`) > Date.now());
  let member = cacheFresh ? cached.status === 'verified' : await checkChatMembership(env, row.telegram_chat_id, user.tg_id);
  if (!cacheFresh) {
    await env.DB.prepare(
      `INSERT INTO v5_chat_memberships (chat_id, user_id, status, checked_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(chat_id, user_id) DO UPDATE SET
         status=excluded.status, checked_at=excluded.checked_at, expires_at=NULL, updated_at=excluded.updated_at`,
    ).bind(row.chat_id, userId, member ? 'verified' : 'left').run();
  }
  if (!member) throw new GameError('NOT_MEMBER');
  return row;
}

async function requireOpenEvent(env: Env, userId: number, eventId: number): Promise<EventAccessRow> {
  const event = await requireEventAccess(env, userId, eventId, true);
  const now = Date.now();
  if (event.event_status !== 'open' || Date.parse(`${event.opens_at}Z`) > now || Date.parse(`${event.locks_at}Z`) <= now) {
    throw new GameError('INVALID_TRANSITION', { reason: 'v5_event_not_open' });
  }
  return event;
}

async function objectives(env: Env, eventId: number): Promise<ObjectiveRow[]> {
  const rows = (await env.DB.prepare(
    `SELECT id, sector, action, opening_state, threshold, progress, status
       FROM v5_event_objectives WHERE event_id = ? ORDER BY sector, action`,
  ).bind(eventId).all<ObjectiveRow>()).results;
  return rows.map((row) => ({
    ...row,
    id: Number(row.id), sector: Number(row.sector), threshold: Number(row.threshold), progress: Number(row.progress),
  }));
}

async function campaignMap(env: Env, event: EventAccessRow): Promise<LiveCampaignMap> {
  const rows = (await env.DB.prepare(
    `SELECT sector, state, ward_count FROM v5_campaign_sectors WHERE campaign_id = ? ORDER BY sector`,
  ).bind(event.campaign_id).all<{ sector: number; state: LiveCampaignSectorState; ward_count: number }>()).results;
  if (rows.length !== 7) throw new Error('v5 campaign map missing sectors');
  const reveal = event.storm_sector === null ? null : await env.DB.prepare(
    `SELECT 1 FROM v5_map_mutations WHERE event_id = ? AND mutation_kind = 'reveal' LIMIT 1`,
  ).bind(event.event_id).first();
  return {
    sectors: rows.map((row) => ({ id: Number(row.sector), state: row.state, wards: Number(row.ward_count) })),
    storm: event.storm_sector === null ? null : { targetSector: Number(event.storm_sector), revealed: Boolean(reveal) },
  };
}

async function activeBird(env: Env, campaignId: number, userId: number): Promise<ActiveBirdRow | null> {
  const row = await env.DB.prepare(
    `SELECT active.bird, bird.form, bird.path_feathers, active.is_locked,
            active.signature_action, active.signature_used_at, active.signature_request_id
       FROM v5_campaign_active_birds active
       JOIN v5_birds bird ON bird.user_id=active.user_id AND bird.bird=active.bird
      WHERE active.campaign_id = ? AND active.user_id = ?`,
  ).bind(campaignId, userId).first<ActiveBirdRow>();
  if (!row) return null;
  return { ...row, form: Number(row.form) as 1 | 2, path_feathers: Number(row.path_feathers), is_locked: Number(row.is_locked) };
}

async function v5Profile(env: Env, userId: number) {
  return env.DB.prepare(
    `SELECT base_bird, pretest_scores_json, pretest_answers_json, claimed_at
       FROM v5_profiles WHERE user_id = ?`,
  ).bind(userId).first<{ base_bird: LiveCampaignBird; pretest_scores_json: string; pretest_answers_json: string; claimed_at: string }>();
}

async function sessionCards(env: Env, sessionId: number, includeAnswers = false) {
  const cards = (await env.DB.prepare(
    `SELECT position, kind, render_json, correct_option FROM v5_session_cards WHERE session_id = ? ORDER BY position`,
  ).bind(sessionId).all<SessionCardRow>()).results;
  if (cards.length !== 5) return null;
  return cards.map((card) => {
    const rendered = parseJson<{ id: string; kind: LiveCampaignCardKind; prompt: string; options: string[] }>(card.render_json, {
      id: `card-${card.position}`, kind: card.kind, prompt: 'Карточка недоступна', options: [],
    });
    return includeAnswers ? { ...rendered, answer: Number(card.correct_option) } : rendered;
  });
}

async function sessionDto(env: Env, session: SessionRow) {
  const cards = await sessionCards(env, session.id);
  const lens = await env.DB.prepare(
    `SELECT item.item_kind FROM v5_session_items link
      JOIN v5_inventory_items item ON item.id=link.inventory_item_id
     WHERE link.session_id=?`,
  ).bind(session.id).first<{ item_kind: string }>();
  return {
    id: Number(session.id), eventId: Number(session.event_id), sectorId: Number(session.sector), action: session.action,
    closeAt: toIso(session.close_at),
    cards: (cards ?? []).map((card) => lens?.item_kind === 'lens' && card.kind === 'chain'
      ? { ...card, hint: 'Цепочка не перескакивает: A → B → C.' }
      : card),
  };
}

function itemDto(row: InventoryRow) {
  const item = row.item_kind;
  const labels: Record<string, { name: string; effect: string }> = {
    'sharpening-feather': { name: 'Заточка', effect: 'Усиливает точный claim с 1 до 2' },
    'nest-resin': { name: 'Смола гнезда', effect: 'Успешный hold добавляет ward' },
    lens: { name: 'Линза', effect: 'Показывает правило цепочки до ответа' },
    'signal-thread': { name: 'Сигнальная нить', effect: 'Усиливает успешный scout на 1' },
  };
  return { id: Number(row.id), kind: item, name: labels[item]?.name ?? item, effect: labels[item]?.effect ?? '', status: row.status };
}

async function buildState(env: Env, userId: number, event: EventAccessRow) {
  const [profile, birdRows, wallet, map, objectiveRows, active, inventoryRows, ownSession, ownAction, ownForecast, ownRaid, eventRaid, influencingSession] = await Promise.all([
    v5Profile(env, userId),
    env.DB.prepare('SELECT bird, form, path_feathers FROM v5_birds WHERE user_id=? ORDER BY bird').bind(userId)
      .all<{ bird: LiveCampaignBird; form: number; path_feathers: number }>(),
    env.DB.prepare('SELECT eggs FROM v5_wallets WHERE user_id=?').bind(userId).first<{ eggs: number }>(),
    campaignMap(env, event),
    objectives(env, event.event_id),
    activeBird(env, event.campaign_id, userId),
    env.DB.prepare(`SELECT id, item_kind, status FROM v5_inventory_items WHERE user_id=? AND status IN ('owned','armed') ORDER BY id DESC`).bind(userId)
      .all<InventoryRow>(),
    env.DB.prepare(`SELECT id,campaign_id,event_id,user_id,active_bird,sector,action,status,seed,map_snapshot_json,client_request_id,close_at,result_json,evidence_score
                      FROM v5_sessions WHERE event_id=? AND user_id=?`).bind(event.event_id, userId).first<SessionRow>(),
    env.DB.prepare('SELECT total_value FROM v5_event_actions WHERE event_id=? AND user_id=?').bind(event.event_id, userId).first<{ total_value: number }>(),
    env.DB.prepare(`SELECT sector, action, predicted_outcome, status FROM v5_predictions WHERE event_id=? AND user_id=?`).bind(event.event_id, userId)
      .first<{ sector: number; action: LiveCampaignAction; predicted_outcome: string; status: string }>(),
    env.DB.prepare(
      `SELECT raid.id, raid.target_sector, raid.status, member.assigned_role, member.status AS member_status, member.attempt_close_at,
              (SELECT count(*) FROM v5_raid_members all_members WHERE all_members.raid_id=raid.id AND all_members.status NOT IN ('withdrawn','dissolved')) AS members
         FROM v5_raids raid JOIN v5_raid_members member ON member.raid_id=raid.id
        WHERE raid.event_id=? AND member.user_id=?`,
    ).bind(event.event_id, userId).first<{ id: number; target_sector: number; status: string; assigned_role: LiveCampaignAction; member_status: string; attempt_close_at: string | null; members: number }>(),
    env.DB.prepare(
      `SELECT raid.id,raid.target_sector,raid.status,
              (SELECT count(*) FROM v5_raid_members all_members WHERE all_members.raid_id=raid.id AND all_members.status NOT IN ('withdrawn','dissolved')) AS members
         FROM v5_raids raid WHERE raid.event_id=? AND raid.status IN ('queued','ready') ORDER BY raid.id LIMIT 1`,
    ).bind(event.event_id).first<{ id: number; target_sector: number; status: string; members: number }>(),
    env.DB.prepare('SELECT 1 FROM v5_sessions WHERE event_id=? LIMIT 1').bind(event.event_id).first(),
  ]);
  const objectiveBySector = new Map(objectiveRows.map((objective) => [objective.sector, objective]));
  const openObjective = objectiveRows.find((objective) => objective.status === 'open') ?? null;
  const session = ownSession ? await sessionDto(env, ownSession) : undefined;
  const now = Date.now();
  const campaignStart = Date.parse(`${event.campaign_starts_at}Z`);
  const campaignEnd = Date.parse(`${event.campaign_ends_at}Z`);
  const campaignDay = Math.max(1, Math.min(28, Math.floor((now - campaignStart) / 86_400_000) + 1));
  const last = await env.DB.prepare(
    `SELECT result_json FROM v5_sessions WHERE campaign_id=? AND user_id=? AND result_json IS NOT NULL
       ORDER BY submitted_at DESC, id DESC LIMIT 1`,
  ).bind(event.campaign_id, userId).first<{ result_json: string }>();
  const forecastOpen = event.event_status === 'open' && now < Date.parse(`${event.forecast_deadline}Z`)
    && !ownForecast && !ownSession && !influencingSession;
  const ownRaidCards = ownRaid?.member_status === 'started' ? await raidCards(env, Number(ownRaid.id), userId) : null;
  const raidSource = ownRaid ?? eventRaid;
  const raid = raidSource ? {
    id: Number(raidSource.id), status: raidSource.status as 'queued' | 'ready' | 'resolved' | 'dissolved',
    members: Number(raidSource.members), roles: LIVE_CAMPAIGN_ACTIONS.reduce((result, role) => ({
      ...result,
      [role]: ownRaid ? ownRaid.assigned_role === role : false,
    }), {} as Partial<Record<LiveCampaignAction, boolean>>),
    sectorId: Number(raidSource.target_sector), action: ownRaid?.assigned_role ?? objectiveRows[0]?.action ?? 'scout', joined: Boolean(ownRaid),
    ...(ownRaidCards && ownRaid?.attempt_close_at ? { cards: ownRaidCards, closeAt: toIso(ownRaid.attempt_close_at) } : {}),
  } : objectiveRows[0] && event.event_status === 'open' ? {
    id: 0, status: 'queued' as const, members: 0, roles: {} as Partial<Record<LiveCampaignAction, boolean>>,
    sectorId: objectiveRows[0].sector, action: objectiveRows[0].action, joined: false,
  } : null;
  const forecast = ownForecast ? {
    sectorId: Number(ownForecast.sector), action: ownForecast.action,
    prediction: ownForecast.predicted_outcome === 'complete' ? 'sector_resolves' as const : 'sector_misses' as const,
    status: ownForecast.status as 'pending' | 'won' | 'lost' | 'void',
  } : null;
  return {
    serverTime: new Date().toISOString(),
    campaign: {
      id: Number(event.campaign_id), title: `Кампания ${Number(event.campaign_number) + 1}`,
      day: campaignDay, daysLeft: Math.max(0, Math.ceil((campaignEnd - now) / 86_400_000)), status: event.campaign_status,
    },
    profile: profile ? {
      bird: profile.base_bird, baseBird: profile.base_bird,
      scores: parseJson<Record<string, number>>(profile.pretest_scores_json, {}), claimedAt: toIso(profile.claimed_at),
    } : null,
    pretest: profile ? undefined : { questions: PRETEST.map((question) => ({
      id: question.id, prompt: question.prompt,
      options: question.options.map((option) => ({ bird: option.bird, text: option.text })),
    })) },
    eggs: Number(wallet?.eggs ?? 0),
    birds: birdRows.results.map((bird) => ({ bird: bird.bird, form: Number(bird.form) as 1 | 2, feathers: Number(bird.path_feathers) })),
    activeBird: active ? {
      bird: active.bird, form: active.form, feathers: active.path_feathers, locked: Boolean(active.is_locked),
      signatureAvailable: active.form === 2 && !active.signature_used_at,
    } : null,
    sectors: map.sectors.map((sector) => {
      const objective = objectiveBySector.get(sector.id);
      return { id: sector.id, state: sector.state, ward: sector.wards > 0, progress: objective?.progress ?? 0, threshold: objective?.threshold ?? 0 };
    }),
    event: {
      id: Number(event.event_id), status: event.event_status, opensAt: toIso(event.opens_at), closesAt: toIso(event.locks_at),
      forecastDeadline: toIso(event.forecast_deadline), actionTaken: Boolean(ownAction),
      storm: map.storm ? {
        revealed: map.storm.revealed,
        targetSector: map.storm.revealed ? map.storm.targetSector : null,
      } : null,
      objective: openObjective ? {
        sectorId: openObjective.sector,
        action: openObjective.action,
        label: `${actionLabel(openObjective.action)} · сектор ${openObjective.sector + 1}`,
        progress: openObjective.progress,
        threshold: openObjective.threshold,
        itemKinds: (Object.entries(LIVE_CAMPAIGN_ITEM_DEFINITIONS) as Array<[LiveCampaignItemKind, typeof LIVE_CAMPAIGN_ITEM_DEFINITIONS[LiveCampaignItemKind]]>)
          .filter(([, definition]) => definition.allowedActions.includes(openObjective.action))
          .map(([kind]) => kind),
      } : null,
      forecastOptions: forecastOpen ? objectiveRows.filter((objective) => objective.status === 'open').map((objective) => ({
        sectorId: objective.sector, action: objective.action, label: `${actionLabel(objective.action)} · сектор ${objective.sector + 1}`,
      })) : [],
      raid,
    },
    inventory: inventoryRows.results.map(itemDto),
    forecast,
    session: session && ownSession?.status === 'started' ? session : null,
    lastResult: last ? parseJson<Record<string, unknown>>(last.result_json, {}) : null,
  };
}

function actionLabel(action: LiveCampaignAction): string {
  return ({ scout: 'Разведка', claim: 'Захват', hold: 'Удержание' })[action];
}

function answersForPretest(value: unknown): LiveCampaignBird[] {
  if (!Array.isArray(value) || value.length !== PRETEST.length || !value.every((answer) => typeof answer === 'string' && birds.has(answer))) {
    throw new GameError('VALIDATION', { field: 'answers' });
  }
  return value as LiveCampaignBird[];
}

function resolvePretest(answers: LiveCampaignBird[], userId: number) {
  const scores: Record<LiveCampaignBird, number> = { woodpecker: 0, magpie: 0, owl: 0, crane: 0 };
  for (const answer of answers) scores[answer] += 1;
  const highest = Math.max(...LIVE_CAMPAIGN_BIRDS.map((bird) => scores[bird]));
  const tied = LIVE_CAMPAIGN_BIRDS.filter((bird) => scores[bird] === highest);
  const bird = tied[Math.abs(userId) % tied.length]!;
  return { bird, scores, tiebreaker: tied.length > 1 ? `user-${Math.abs(userId) % tied.length}` : null };
}

function validAnswers(value: unknown, count: number): number[] {
  if (!Array.isArray(value) || value.length !== count || !value.every((answer) => Number.isInteger(answer) && Number(answer) >= -1 && Number(answer) <= 7)) {
    throw new GameError('VALIDATION', { field: 'answers' });
  }
  return value as number[];
}

async function objectiveFor(env: Env, eventId: number, sector: number, action: LiveCampaignAction): Promise<ObjectiveRow> {
  const row = await env.DB.prepare(
    `SELECT id, sector, action, opening_state, threshold, progress, status
       FROM v5_event_objectives WHERE event_id=? AND sector=? AND action=?`,
  ).bind(eventId, sector, action).first<ObjectiveRow>();
  if (!row || row.status !== 'open') throw new GameError('INVALID_TRANSITION', { reason: 'v5_objective_unavailable' });
  return { ...row, id: Number(row.id), sector: Number(row.sector), threshold: Number(row.threshold), progress: Number(row.progress) };
}

async function addMapMutation(
  env: Env,
  event: EventAccessRow,
  objective: ObjectiveRow | null,
  before: { state: LiveCampaignSectorState; wards: number },
  after: { state: LiveCampaignSectorState; wards: number },
  kind: 'reveal' | 'secure' | 'root' | 'storm' | 'ward_added' | 'ward_consumed' | 'safety_rail',
  key: string,
): Promise<boolean> {
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_map_mutations
       (campaign_id,event_id,objective_id,sector,mutation_kind,before_state,after_state,wards_before,wards_after,mutation_key)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(event.campaign_id, event.event_id, objective?.id ?? null, objective ? objective.sector : Number(event.storm_sector), kind,
    before.state, after.state, before.wards, after.wards, key).run();
  return Boolean(inserted.meta.changes);
}

/**
 * A started series may finish normally, become void because another player
 * completed the objective, or simply expire.  Its item must always leave the
 * transient `armed` state.  A lens already revealed its hint at start, so it
 * is spent even when the series is not scored; every other unapplied item is
 * returned to the three-slot inventory.
 */
async function settleTerminalSessionItem(env: Env, sessionId: number): Promise<void> {
  const link = await env.DB.prepare(
    `SELECT link.status AS link_status, item.item_kind
       FROM v5_session_items link
       JOIN v5_inventory_items item ON item.id=link.inventory_item_id
      WHERE link.session_id=?`,
  ).bind(sessionId).first<{ link_status: 'armed' | 'consumed' | 'released'; item_kind: string }>();
  if (!link || link.link_status !== 'armed') return;
  await env.DB.prepare(
    `UPDATE v5_session_items
        SET status=?, resolved_at=datetime('now')
      WHERE session_id=? AND status='armed'`,
  ).bind(link.item_kind === 'lens' ? 'consumed' : 'released', sessionId).run();
}

async function applyCompletedObjective(env: Env, event: EventAccessRow, objective: ObjectiveRow): Promise<void> {
  const map = await campaignMap(env, event);
  const before = map.sectors[objective.sector]!;
  const resolution = resolveLiveCampaignAction(map, {
    action: objective.action, sectorId: objective.sector, contribution: objective.threshold, threshold: objective.threshold,
  });
  if (!resolution.applied) return;
  const after = resolution.map.sectors[objective.sector]!;
  const kind = resolution.note === 'exposed' ? 'reveal'
    : resolution.note === 'secured' ? 'secure'
      : resolution.note === 'rooted' ? 'root' : 'ward_added';
  const accepted = await addMapMutation(env, event, objective, before, after, kind, `event:${event.event_id}:objective:${objective.id}:complete`);
  if (!accepted) return;
  await env.DB.prepare(
    `UPDATE v5_campaign_sectors SET state=?, ward_count=?, version=version+1, updated_at=datetime('now')
      WHERE campaign_id=? AND sector=?`,
  ).bind(after.state, after.wards, event.campaign_id, objective.sector).run();
}

async function settleSessionAction(
  env: Env,
  event: EventAccessRow,
  session: SessionRow,
  correct: number,
  tacticalCorrect: boolean,
  contribution: 0 | 1 | 2,
): Promise<Record<string, unknown>> {
  const objective = await env.DB.prepare(
    `SELECT id, sector, action, opening_state, threshold, progress, status
       FROM v5_event_objectives WHERE event_id=? AND sector=? AND action=?`,
  ).bind(event.event_id, session.sector, session.action).first<ObjectiveRow>();
  if (!objective) throw new Error('v5 objective missing for session');
  if (objective.status !== 'open') {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO v5_event_actions
        (event_id,objective_id,session_id,user_id,sector,action,status,base_value,item_bonus,maneuver_bonus,total_value,idempotency_key)
       VALUES (?,?,?,?,?,?, 'void', ?,0,0,0,?)`,
    ).bind(event.event_id, objective.id, session.id, session.user_id, session.sector, session.action, contribution,
      `session:${session.id}:void`).run();
    await settleTerminalSessionItem(env, session.id);
    return { contribution: 0, sectorProgress: Number(objective.progress), threshold: Number(objective.threshold), actionApplied: false };
  }
  const normalized = { ...objective, id: Number(objective.id), sector: Number(objective.sector), threshold: Number(objective.threshold), progress: Number(objective.progress) };
  const active = await activeBird(env, event.campaign_id, session.user_id);
  const signature = Boolean(active && active.form === 2 && active.signature_action === session.action
    && active.signature_request_id === session.client_request_id && contribution === 1);
  const item = await env.DB.prepare(
    `SELECT item.id, item.item_kind, item.status
       FROM v5_session_items link JOIN v5_inventory_items item ON item.id=link.inventory_item_id
      WHERE link.session_id=?`,
  ).bind(session.id).first<InventoryRow>();
  let itemBonus = 0;
  if (item?.item_kind === 'signal-thread' && session.action === 'scout' && contribution >= 1) itemBonus = 1;
  // Sharpening never breaks the per-player cap of two. It turns a valid
  // one-point claim into two; a perfect two-point claim keeps the item.
  if (item?.item_kind === 'sharpening-feather' && session.action === 'claim' && contribution === 1) itemBonus = 1;
  const maneuverBonus = signature ? 1 : 0;
  const total = Math.min(2, contribution + itemBonus + maneuverBonus);
  const actionInsert = await env.DB.prepare(
    `INSERT OR IGNORE INTO v5_event_actions
      (event_id,objective_id,session_id,user_id,sector,action,status,base_value,item_bonus,maneuver_bonus,total_value,idempotency_key)
     VALUES (?,?,?,?,?,?, 'pending', ?,?,?,?,?)`,
  ).bind(event.event_id, normalized.id, session.id, session.user_id, session.sector, session.action,
    contribution, itemBonus, maneuverBonus, total, `session:${session.id}:action`).run();
  if (!actionInsert.meta.changes) {
    const prior = await env.DB.prepare('SELECT total_value,status FROM v5_event_actions WHERE session_id=?').bind(session.id)
      .first<{ total_value: number; status: string }>();
    const applied = prior?.status === 'applied';
    return {
      contribution: applied ? Number(prior?.total_value ?? 0) : 0,
      sectorProgress: normalized.progress,
      threshold: normalized.threshold,
      actionApplied: applied,
    };
  }

  let progressApplied = true;
  if (total > 0) {
    const progressed = await env.DB.prepare(
      `UPDATE v5_event_objectives
          SET progress=MIN(threshold, progress + ?), version=version+1, updated_at=datetime('now')
        WHERE id=? AND status='open' AND progress < threshold`,
    ).bind(total, normalized.id).run();
    progressApplied = Boolean(progressed.meta.changes);
  }
  if (total > 0 && !progressApplied) {
    await env.DB.prepare(
      `UPDATE v5_event_actions
          SET status='void', item_bonus=0, maneuver_bonus=0, total_value=0, applied_at=datetime('now')
        WHERE session_id=? AND status='pending'`,
    ).bind(session.id).run();
    await settleTerminalSessionItem(env, session.id);
    const closed = await env.DB.prepare('SELECT progress,threshold FROM v5_event_objectives WHERE id=?').bind(normalized.id)
      .first<{ progress: number; threshold: number }>();
    return {
      contribution: 0,
      baseContribution: contribution,
      tacticalCorrect,
      correct,
      actionApplied: false,
      sectorProgress: Number(closed?.progress ?? normalized.progress),
      threshold: Number(closed?.threshold ?? normalized.threshold),
    };
  }
  const after = await env.DB.prepare(
    `SELECT id, sector, action, opening_state, threshold, progress, status
       FROM v5_event_objectives WHERE id=?`,
  ).bind(normalized.id).first<ObjectiveRow>();
  if (!after) throw new Error('v5 objective missing after action');
  const completed = await env.DB.prepare(
    `UPDATE v5_event_objectives SET status='completed', completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=? AND status='open' AND progress >= threshold`,
  ).bind(normalized.id).run();
  await env.DB.prepare(`UPDATE v5_event_actions SET status='applied', applied_at=datetime('now') WHERE session_id=?`)
    .bind(session.id).run();

  if (item) {
    const consume = item.item_kind === 'lens'
      || (item.item_kind === 'sharpening-feather' && contribution === 1)
      || (item.item_kind !== 'sharpening-feather' && item.item_kind !== 'lens' && total > 0);
    await env.DB.prepare(
      `UPDATE v5_session_items SET status=?, resolved_at=datetime('now') WHERE session_id=? AND status='armed'`,
    ).bind(consume ? 'consumed' : 'released', session.id).run();
    if (consume && item.item_kind === 'nest-resin' && session.action === 'hold') {
      const latest = await campaignMap(env, event);
      const sector = latest.sectors[session.sector]!;
      const resinAfter = { ...sector, wards: sector.wards + 1 };
      const accepted = await addMapMutation(env, event, normalized, sector, resinAfter, 'ward_added', `session:${session.id}:resin`);
      if (accepted) await env.DB.prepare(
        `UPDATE v5_campaign_sectors SET ward_count=ward_count+1, version=version+1, updated_at=datetime('now')
          WHERE campaign_id=? AND sector=?`,
      ).bind(event.campaign_id, session.sector).run();
    }
  }
  if (completed.meta.changes) await applyCompletedObjective(env, event, { ...after, id: Number(after.id), threshold: Number(after.threshold), progress: Number(after.progress), sector: Number(after.sector) });

  const awardsFeather = total >= 2 && correct >= 4 && tacticalCorrect;
  if (awardsFeather) {
    await env.DB.prepare(
      `UPDATE v5_birds SET path_feathers=MIN(8,path_feathers+?), updated_at=datetime('now')
        WHERE user_id=? AND bird=?`,
    ).bind(1, session.user_id, session.active_bird).run();
  }
  if (total >= 2 && correct >= 4) await grantEgg(env, session.user_id, `event:${event.event_id}:session:${session.id}:egg`, 'event_award');
  const finalObjective = await env.DB.prepare('SELECT progress,threshold FROM v5_event_objectives WHERE id=?').bind(normalized.id)
    .first<{ progress: number; threshold: number }>();
  return {
    contribution: total, baseContribution: contribution, tacticalCorrect, correct, actionApplied: true,
    featherAwarded: awardsFeather,
    sectorProgress: Number(finalObjective?.progress ?? normalized.progress), threshold: Number(finalObjective?.threshold ?? normalized.threshold),
  };
}

async function grantEgg(
  env: Env,
  userId: number,
  sourceKey: string,
  sourceKind: 'event_award' | 'raid_award',
): Promise<boolean> {
  // D1.batch is transactional. The ledger claim comes first, then the
  // wallet change is conditional on that exact insert having won. This avoids
  // the old read → increment → duplicate-ledger compensation window.
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO v5_wallet_ledger
        (user_id,delta,balance_after,source_kind,source_key,idempotency_key)
       VALUES (?,1,0,?,?,?)`,
    ).bind(userId, sourceKind, sourceKey, sourceKey),
    env.DB.prepare(
      `UPDATE v5_wallets SET eggs=eggs+1, revision=revision+1, updated_at=datetime('now')
        WHERE user_id=? AND changes()=1`,
    ).bind(userId),
    env.DB.prepare(
      `UPDATE v5_wallet_ledger
          SET balance_after=(SELECT eggs FROM v5_wallets WHERE user_id=?)
        WHERE idempotency_key=? AND balance_after=0 AND changes()=1`,
    ).bind(userId, sourceKey),
  ]);
  return Boolean(results[1]?.meta.changes);
}

async function raidCards(env: Env, raidId: number, userId: number) {
  const rows = (await env.DB.prepare(
    `SELECT position,render_json FROM v5_raid_cards WHERE raid_id=? AND user_id=? ORDER BY position`,
  ).bind(raidId, userId).all<{ position: number; render_json: string }>()).results;
  if (rows.length !== 2) return null;
  return rows.map((row) => parseJson<{ id: string; kind: LiveCampaignCardKind; prompt: string; options: string[] }>(row.render_json, {
    id: `raid-${row.position}`, kind: 'base', prompt: 'Карточка рейда недоступна', options: [],
  }));
}

/** A raid can only give a route/item; it never substitutes or multiplies the solo event action. */
async function maybeResolveRaid(env: Env, raidId: number, force = false): Promise<boolean> {
  const raid = await env.DB.prepare(
    `SELECT id,status,reward_item_kind,reward_route_sector,queue_closes_at
       FROM v5_raids WHERE id=?`,
  ).bind(raidId).first<{ id: number; status: string; reward_item_kind: string; reward_route_sector: number | null; queue_closes_at: string }>();
  if (!raid || !['queued', 'ready'].includes(raid.status)) return false;
  const members = (await env.DB.prepare(
    `SELECT user_id,assigned_role,status,correct_count FROM v5_raid_members WHERE raid_id=? AND status NOT IN ('withdrawn','dissolved')`,
  ).bind(raidId).all<{ user_id: number; assigned_role: LiveCampaignAction; status: string; correct_count: number | null }>()).results;
  const allTerminal = members.length > 0 && members.every((member) => member.status === 'submitted' || member.status === 'settled');
  if (!force && !allTerminal) return false;
  const required = Math.ceil(members.length * 0.6);
  const successful = members.filter((member) => Number(member.correct_count ?? 0) >= 1);
  const coveredRoles = new Set(successful.map((member) => member.assigned_role));
  const success = members.length >= 4
    && successful.length >= required
    && LIVE_CAMPAIGN_ACTIONS.every((role) => coveredRoles.has(role));
  const claim = await env.DB.prepare(
    `UPDATE v5_raids SET status=?,resolved_at=datetime('now'),result_json=? WHERE id=? AND status IN ('queued','ready')`,
  ).bind(success ? 'resolved' : 'dissolved', JSON.stringify({
    members: members.length,
    successful: successful.length,
    required,
    coveredRoles: [...coveredRoles].sort(),
    success,
  }), raidId).run();
  if (!claim.meta.changes) return false;
  if (success) {
    for (const member of successful) {
      const count = await env.DB.prepare(
        `SELECT count(*) AS n FROM v5_inventory_items WHERE user_id=? AND status IN ('owned','armed')`,
      ).bind(member.user_id).first<{ n: number }>();
      if (Number(count?.n ?? 0) >= 3) continue;
      const sourceKey = `raid:${raidId}:user:${member.user_id}`;
      const item = await env.DB.prepare(
        `INSERT OR IGNORE INTO v5_inventory_items (user_id,item_kind,source_kind,source_key,created_request_id)
         VALUES (?,?,'raid',?,?) RETURNING id`,
      ).bind(member.user_id, raid.reward_item_kind, sourceKey, `v5:${sourceKey}`).first<{ id: number }>();
      if (item) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO v5_raid_rewards (raid_id,user_id,inventory_item_id,route_sector,grant_key)
           VALUES (?,?,?,?,?)`,
        ).bind(raidId, member.user_id, item.id, raid.reward_route_sector, sourceKey).run();
      }
    }
  }
  await env.DB.prepare(
    `UPDATE v5_raid_members SET status=?,resolved_at=datetime('now') WHERE raid_id=? AND status IN ('queued','ready','started','submitted')`,
  ).bind(success ? 'settled' : 'dissolved', raidId).run();
  return true;
}

/**
 * A small chat must never remain on a fully hidden map after two genuinely
 * empty windows. The core rule chooses the first legal hidden sector; the
 * mutation key makes a repeated resolver harmless.
 */
async function applySafetyRailIfNeeded(
  env: Env,
  event: EventAccessRow,
  currentObjectives: Array<{ status: ObjectiveStatus }>,
): Promise<boolean> {
  const currentCompleted = currentObjectives.some((objective) => objective.status === 'completed');
  const prior = await env.DB.prepare(
    `SELECT EXISTS(
        SELECT 1 FROM v5_event_objectives objective
         WHERE objective.event_id=e.id AND objective.status='completed'
      ) AS completed
       FROM v5_events e
      WHERE e.campaign_id=? AND e.id<>? AND e.status='resolved'
      ORDER BY e.event_number DESC LIMIT 1`,
  ).bind(event.campaign_id, event.event_id).first<{ completed: number }>();
  const unresolvedWindows = (currentCompleted ? 0 : 1) + (prior && Number(prior.completed) === 0 ? 1 : 0);
  const map = await campaignMap(env, event);
  const safety = applyLiveCampaignSafetyRail(map, unresolvedWindows);
  if (!safety.applied) return false;
  const sector = safety.map.sectors.find((entry, index) => entry.state !== map.sectors[index]?.state);
  if (!sector) return false;
  const before = map.sectors[sector.id]!;
  const applied = await addMapMutation(env, event, null, before, sector, 'safety_rail', `event:${event.event_id}:safety-rail`);
  if (!applied) return false;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE v5_campaign_sectors
          SET state=?,safety_exposed=1,version=version+1,updated_at=datetime('now')
        WHERE campaign_id=? AND sector=?`,
    ).bind(sector.state, event.campaign_id, sector.id),
    env.DB.prepare('UPDATE v5_events SET safety_rail=1,updated_at=datetime(\'now\') WHERE id=?')
      .bind(event.event_id),
  ]);
  return true;
}

liveCampaignApi.get('/api/v5/state', async (c) => {
  if (!liveCampaignV5GloballyEnabled(c.env)) throw new GameError('EXPERIENCE_DISABLED');
  const raw = c.req.query('eventId');
  if (!raw) return c.json({ serverTime: new Date().toISOString(), event: null, waiting: 'Открой игру из кнопки события в чате.' });
  const event = await requireEventAccess(c.env, c.get('userId'), numberValue(raw, 'eventId'));
  return c.json(await buildState(c.env, c.get('userId'), event));
});

liveCampaignApi.post('/api/v5/pretest', async (c) => {
  const body = await json(c);
  const event = await requireEventAccess(c.env, c.get('userId'), eventIdFrom(c, body), true);
  const clientRequestId = requestId(body.clientRequestId);
  const answers = answersForPretest(body.answers);
  const existing = await v5Profile(c.env, c.get('userId'));
  if (existing) {
    const replay = await c.env.DB.prepare('SELECT 1 FROM v5_profiles WHERE user_id=? AND client_request_id=?')
      .bind(c.get('userId'), clientRequestId).first();
    if (!replay) throw new GameError('INVALID_TRANSITION', { reason: 'v5_pretest_locked' });
    return c.json({ state: await buildState(c.env, c.get('userId'), event) });
  }
  const result = resolvePretest(answers, c.get('userId'));
  try {
    await c.env.DB.prepare(
      `INSERT INTO v5_profiles (user_id,base_bird,pretest_catalog_version,pretest_answers_json,pretest_scores_json,pretest_tiebreaker,client_request_id)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(c.get('userId'), result.bird, 'v5-pretest-1', JSON.stringify(answers), JSON.stringify(result.scores), result.tiebreaker, clientRequestId).run();
  } catch (error) {
    const replay = await c.env.DB.prepare('SELECT 1 FROM v5_profiles WHERE user_id=? AND client_request_id=?')
      .bind(c.get('userId'), clientRequestId).first();
    if (!replay) throw error;
  }
  return c.json({ state: await buildState(c.env, c.get('userId'), event) });
});

liveCampaignApi.post('/api/v5/birds/active', async (c) => {
  const body = await json(c);
  const event = await requireEventAccess(c.env, c.get('userId'), eventIdFrom(c, body), true);
  const clientRequestId = requestId(body.clientRequestId);
  if (typeof body.bird !== 'string' || !birds.has(body.bird)) throw new GameError('VALIDATION', { field: 'bird' });
  if (!await v5Profile(c.env, c.get('userId'))) throw new GameError('NOT_HATCHED');
  const selected = body.bird as LiveCampaignBird;
  const owned = await c.env.DB.prepare('SELECT 1 FROM v5_birds WHERE user_id=? AND bird=?')
    .bind(c.get('userId'), selected).first();
  if (!owned) throw new GameError('INVALID_TRANSITION', { reason: 'v5_bird_not_owned' });
  const priorRequest = await c.env.DB.prepare(
    `SELECT bird FROM v5_campaign_bird_selection_requests WHERE campaign_id=? AND user_id=? AND client_request_id=?`,
  ).bind(event.campaign_id, c.get('userId'), clientRequestId).first<{ bird: LiveCampaignBird }>();
  if (!priorRequest) {
    const current = await activeBird(c.env, event.campaign_id, c.get('userId'));
    if (current?.is_locked) throw new GameError('INVALID_TRANSITION', { reason: 'v5_active_bird_locked' });
    await c.env.DB.prepare(
      `INSERT INTO v5_campaign_active_birds (campaign_id,user_id,bird,selected_at)
       VALUES (?,?,?,datetime('now'))
       ON CONFLICT(campaign_id,user_id) DO UPDATE SET bird=excluded.bird, selected_at=excluded.selected_at, version=v5_campaign_active_birds.version+1
        WHERE v5_campaign_active_birds.is_locked=0`,
    ).bind(event.campaign_id, c.get('userId'), selected).run();
    const applied = await c.env.DB.prepare(
      `SELECT bird,is_locked FROM v5_campaign_active_birds WHERE campaign_id=? AND user_id=?`,
    ).bind(event.campaign_id, c.get('userId')).first<{ bird: LiveCampaignBird; is_locked: number }>();
    if (!applied || Boolean(applied.is_locked) || applied.bird !== selected) {
      throw new GameError('INVALID_TRANSITION', { reason: Boolean(applied?.is_locked) ? 'v5_active_bird_locked' : 'v5_active_bird_changed' });
    }
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO v5_campaign_bird_selection_requests (campaign_id,user_id,bird,client_request_id)
       VALUES (?,?,?,?)`,
    ).bind(event.campaign_id, c.get('userId'), selected, clientRequestId).run();
  }
  return c.json({ state: await buildState(c.env, c.get('userId'), event) });
});

liveCampaignApi.post('/api/v5/molt', async (c) => {
  const body = await json(c);
  const event = await requireEventAccess(c.env, c.get('userId'), eventIdFrom(c, body), true);
  const clientRequestId = requestId(body.clientRequestId);
  if (typeof body.sourceBird !== 'string' || typeof body.targetBird !== 'string' || !birds.has(body.sourceBird) || !birds.has(body.targetBird)) {
    throw new GameError('VALIDATION', { field: 'bird' });
  }
  const source = body.sourceBird as LiveCampaignBird;
  const target = body.targetBird as LiveCampaignBird;
  const replay = await c.env.DB.prepare('SELECT 1 FROM v5_bird_molts WHERE user_id=? AND client_request_id=?')
    .bind(c.get('userId'), clientRequestId).first();
  if (replay) return c.json({ state: await buildState(c.env, c.get('userId'), event) });
  const sourceRow = await c.env.DB.prepare(
    'SELECT form,path_feathers FROM v5_birds WHERE user_id=? AND bird=?',
  ).bind(c.get('userId'), source).first<{ form: number; path_feathers: number }>();
  if (!sourceRow || Number(sourceRow.form) !== 1 || Number(sourceRow.path_feathers) < 8) {
    const alreadyChosen = await c.env.DB.prepare(
      'SELECT 1 FROM v5_bird_molts WHERE user_id=? AND source_bird=?',
    ).bind(c.get('userId'), source).first();
    if (alreadyChosen) return c.json({ state: await buildState(c.env, c.get('userId'), event) });
    throw new GameError('INVALID_TRANSITION', { reason: 'v5_form_ii_unavailable' });
  }
  const decision = source === target ? 'evolve' : 'unlock';
  if (decision === 'unlock') {
    const targetRow = await c.env.DB.prepare('SELECT 1 FROM v5_birds WHERE user_id=? AND bird=?').bind(c.get('userId'), target).first();
    if (targetRow) throw new GameError('INVALID_TRANSITION', { reason: 'v5_form_ii_target_owned' });
  }
  try {
    // D1.batch is transactional: a simultaneous source/target claim rolls
    // back the whole losing batch instead of spending a second set of feathers.
    await c.env.DB.batch([
      ...(decision === 'unlock' ? [c.env.DB.prepare(
        `INSERT INTO v5_birds (user_id,bird,form,path_feathers,origin,promoted_at)
         VALUES (?,?,2,0,'molt',datetime('now'))`,
      ).bind(c.get('userId'), target)] : [c.env.DB.prepare(
        `UPDATE v5_birds SET form=2, promoted_at=datetime('now'), updated_at=datetime('now') WHERE user_id=? AND bird=?`,
      ).bind(c.get('userId'), source)]),
      c.env.DB.prepare('UPDATE v5_birds SET path_feathers=0, updated_at=datetime(\'now\') WHERE user_id=? AND bird=?')
        .bind(c.get('userId'), source),
      c.env.DB.prepare(
        `INSERT INTO v5_bird_molts (user_id,source_bird,target_bird,decision,client_request_id)
         VALUES (?,?,?,?,?)`,
      ).bind(c.get('userId'), source, target, decision, clientRequestId),
    ]);
  } catch (error) {
    const alreadyChosen = await c.env.DB.prepare(
      'SELECT 1 FROM v5_bird_molts WHERE user_id=? AND source_bird=?',
    ).bind(c.get('userId'), source).first();
    if (alreadyChosen) return c.json({ state: await buildState(c.env, c.get('userId'), event) });
    if (decision === 'unlock') {
      const targetNowOwned = await c.env.DB.prepare('SELECT 1 FROM v5_birds WHERE user_id=? AND bird=?')
        .bind(c.get('userId'), target).first();
      if (targetNowOwned) throw new GameError('INVALID_TRANSITION', { reason: 'v5_form_ii_target_owned' });
    }
    throw error;
  }
  return c.json({ state: await buildState(c.env, c.get('userId'), event) });
});

liveCampaignApi.post('/api/v5/events/:id/session/start', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireOpenEvent(c.env, c.get('userId'), eventId);
  if (Date.now() < Date.parse(`${event.forecast_deadline}Z`)) {
    throw new GameError('INVALID_TRANSITION', { reason: 'v5_forecast_phase' });
  }
  const clientRequestId = requestId(body.clientRequestId);
  if (!Number.isInteger(body.sectorId) || (body.sectorId as number) < 0 || (body.sectorId as number) > 6) {
    throw new GameError('VALIDATION', { field: 'sectorId' });
  }
  if (typeof body.action !== 'string' || !actions.has(body.action)) throw new GameError('VALIDATION', { field: 'action' });
  const sector = body.sectorId as number;
  const action = body.action as LiveCampaignAction;
  const existing = await c.env.DB.prepare(
    `SELECT id,campaign_id,event_id,user_id,active_bird,sector,action,status,seed,map_snapshot_json,client_request_id,close_at,result_json,evidence_score
       FROM v5_sessions WHERE event_id=? AND user_id=?`,
  ).bind(eventId, c.get('userId')).first<SessionRow>();
  if (existing) {
    const state = await buildState(c.env, c.get('userId'), event);
    return c.json({ state, session: await sessionDto(c.env, existing) });
  }
  const active = await activeBird(c.env, event.campaign_id, c.get('userId'));
  if (!active) throw new GameError('INVALID_TRANSITION', { reason: 'v5_active_bird_required' });
  await objectiveFor(c.env, eventId, sector, action);
  let item: InventoryRow | null = null;
  if (body.itemId !== undefined && body.itemId !== null) {
    const itemId = numberValue(body.itemId, 'itemId');
    item = await c.env.DB.prepare('SELECT id,item_kind,status FROM v5_inventory_items WHERE id=? AND user_id=?')
      .bind(itemId, c.get('userId')).first<InventoryRow>();
    if (!item || item.status !== 'owned') throw new GameError('INVALID_TRANSITION', { reason: 'v5_item_not_owned' });
    const definition = LIVE_CAMPAIGN_ITEM_DEFINITIONS[item.item_kind as keyof typeof LIVE_CAMPAIGN_ITEM_DEFINITIONS];
    if (!definition || !definition.allowedActions.includes(action)) throw new GameError('INVALID_TRANSITION', { reason: 'v5_item_action_mismatch' });
  }
  const map = await campaignMap(c.env, event);
  const seed = randomSeed();
  const now = new Date();
  // When an item is selected, the session and the owned→armed transition must
  // share one D1 batch. The EXISTS predicate makes a failed concurrent claim
  // create no session at all; within the batch no other SQLite writer can turn
  // that item non-owned before the link trigger arms it.
  const sessionInsert = c.env.DB.prepare(
    `INSERT${item ? '' : ' OR IGNORE'} INTO v5_sessions
      (campaign_id,event_id,user_id,active_bird,sector,action,seed,catalog_version,map_revision,map_snapshot_json,client_request_id,started_at,close_at)
     SELECT ?,?,?,bird,?,?,?,?,0,?,?,?,?
       FROM v5_campaign_active_birds
      WHERE campaign_id=? AND user_id=? AND bird=?
        ${item ? "AND EXISTS (SELECT 1 FROM v5_inventory_items WHERE id=? AND user_id=? AND status='owned')" : ''}`,
  ).bind(event.campaign_id, eventId, c.get('userId'), sector, action, String(seed), V5_CARD_CATALOG_VERSION,
    JSON.stringify(map), clientRequestId, sqlTime(now), sqlTime(new Date(now.getTime() + V5_SESSION_SECONDS * 1000)),
    event.campaign_id, c.get('userId'), active.bird, ...(item ? [item.id, c.get('userId')] : []));
  let created = false;
  try {
    const startResults = item ? await c.env.DB.batch([
      sessionInsert,
      c.env.DB.prepare(
        `INSERT INTO v5_session_items (session_id,inventory_item_id)
         SELECT session.id,item.id
           FROM v5_sessions AS session
           JOIN v5_inventory_items AS item ON item.id=? AND item.user_id=? AND item.status='owned'
          WHERE session.event_id=? AND session.user_id=? AND session.client_request_id=?`,
      ).bind(item.id, c.get('userId'), eventId, c.get('userId'), clientRequestId),
    ]) : [await sessionInsert.run()];
    created = Boolean(startResults[0]?.meta.changes);
  } catch (error) {
    // A same-event racing start is still a valid first-session-wins replay.
    // A different campaign that already armed this item has no such session
    // and is reported as an unavailable item instead of leaking a partial one.
    const raced = await c.env.DB.prepare(
      `SELECT id,campaign_id,event_id,user_id,active_bird,sector,action,status,seed,map_snapshot_json,client_request_id,close_at,result_json,evidence_score
         FROM v5_sessions WHERE event_id=? AND user_id=?`,
    ).bind(eventId, c.get('userId')).first<SessionRow>();
    if (raced) return c.json({ state: await buildState(c.env, c.get('userId'), event), session: await sessionDto(c.env, raced) });
    if (item) {
      const latestItem = await c.env.DB.prepare('SELECT status FROM v5_inventory_items WHERE id=? AND user_id=?')
        .bind(item.id, c.get('userId')).first<Pick<InventoryRow, 'status'>>();
      if (!latestItem || latestItem.status !== 'owned') throw new GameError('INVALID_TRANSITION', { reason: 'v5_item_not_owned' });
    }
    throw error;
  }
  const session = await c.env.DB.prepare(
    `SELECT id,campaign_id,event_id,user_id,active_bird,sector,action,status,seed,map_snapshot_json,client_request_id,close_at,result_json,evidence_score
       FROM v5_sessions WHERE event_id=? AND user_id=?`,
  ).bind(eventId, c.get('userId')).first<SessionRow>();
  if (!session) {
    if (item) {
      const latestItem = await c.env.DB.prepare('SELECT status FROM v5_inventory_items WHERE id=? AND user_id=?')
        .bind(item.id, c.get('userId')).first<Pick<InventoryRow, 'status'>>();
      if (!latestItem || latestItem.status !== 'owned') throw new GameError('INVALID_TRANSITION', { reason: 'v5_item_not_owned' });
    }
    const current = await activeBird(c.env, event.campaign_id, c.get('userId'));
    throw new GameError('INVALID_TRANSITION', {
      reason: current ? 'v5_session_start_rejected' : 'v5_active_bird_required',
    });
  }
  const snapshot = parseJson<LiveCampaignMap>(session.map_snapshot_json, map);
  const challenge = createLiveCampaignChallenge({ seed: Number(session.seed), bird: session.active_bird, action: session.action, sectorId: Number(session.sector), map: snapshot });
  const clientCards = toLiveCampaignChallengeClient(challenge).cards;
  await c.env.DB.batch(challenge.cards.map((card, index) => c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_session_cards (session_id,position,kind,prompt_key,variant_key,render_json,correct_option)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(session.id, index + 1, card.kind, card.id, `${card.id}:${session.seed}`, JSON.stringify(clientCards[index]), card.answer)));
  if (created && body.useSignature === true && active.form === 2) {
    await c.env.DB.prepare(
      `UPDATE v5_campaign_active_birds
          SET signature_action=?, signature_used_at=datetime('now'), signature_request_id=?, version=version+1
        WHERE campaign_id=? AND user_id=? AND signature_used_at IS NULL`,
    ).bind(action, clientRequestId, event.campaign_id, c.get('userId')).run();
  }
  const state = await buildState(c.env, c.get('userId'), event);
  return c.json({ state, session: await sessionDto(c.env, session) });
});

liveCampaignApi.post('/api/v5/events/:id/session/submit', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireEventAccess(c.env, c.get('userId'), eventId, true);
  const clientRequestId = requestId(body.clientRequestId);
  const answers = validAnswers(body.answers, 5);
  const session = await c.env.DB.prepare(
    `SELECT id,campaign_id,event_id,user_id,active_bird,sector,action,status,seed,map_snapshot_json,client_request_id,close_at,result_json,evidence_score
       FROM v5_sessions WHERE event_id=? AND user_id=?`,
  ).bind(eventId, c.get('userId')).first<SessionRow>();
  if (!session) throw new GameError('INVALID_TRANSITION', { reason: 'v5_session_required' });
  const prior = await c.env.DB.prepare('SELECT result_json FROM v5_session_submissions WHERE session_id=?')
    .bind(session.id).first<{ result_json: string }>();
  if (prior) return c.json({ state: await buildState(c.env, c.get('userId'), event), result: parseJson<Record<string, unknown>>(prior.result_json, {}) });
  const cards = (await c.env.DB.prepare(
    `SELECT position,kind,render_json,correct_option FROM v5_session_cards WHERE session_id=? ORDER BY position`,
  ).bind(session.id).all<SessionCardRow>()).results;
  if (cards.length !== 5 || cards.some((card) => !cardKinds.has(card.kind))) throw new Error('v5 session cards missing');
  const correct = cards.filter((card, index) => answers[index] === Number(card.correct_option)).length;
  const tacticalCorrect = cards.some((card, index) => card.kind === 'tactical' && answers[index] === Number(card.correct_option));
  const now = Date.now();
  const late = event.event_status !== 'open' || now > Date.parse(`${session.close_at}Z`) || now > Date.parse(`${event.locks_at}Z`);
  const evidence = late ? { correct: 0, tacticalCorrect: false, contribution: 0 as const }
    : evaluateLiveCampaignChallenge(
      { seed: 0, bird: session.active_bird, action: session.action, sectorId: Number(session.sector), cards: cards.map((card, index) => ({
        id: `stored-${index}`, kind: card.kind, prompt: '', options: [], answer: Number(card.correct_option),
      })) }, answers,
    );
  const resultBase = late ? { correct: 0, tacticalCorrect: false, evidenceScore: 0, contribution: 0, timedOut: true }
    : { correct, tacticalCorrect, evidenceScore: correct, contribution: evidence.contribution, timedOut: false };
  const written = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_session_submissions
      (session_id,client_request_id,answers_json,was_late,correct_count,tactical_correct,evidence_score,result_json)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(session.id, clientRequestId, JSON.stringify(answers), late ? 1 : 0, resultBase.correct, resultBase.tacticalCorrect ? 1 : 0,
    late ? 0 : evidence.contribution, JSON.stringify(resultBase)).run();
  if (!written.meta.changes) {
    const replay = await c.env.DB.prepare('SELECT result_json FROM v5_session_submissions WHERE session_id=?').bind(session.id)
      .first<{ result_json: string }>();
    return c.json({ state: await buildState(c.env, c.get('userId'), event), result: parseJson<Record<string, unknown>>(replay?.result_json ?? '{}', {}) });
  }
  let result: Record<string, unknown> = resultBase;
  if (!late) result = { ...resultBase, ...await settleSessionAction(c.env, event, session, correct, tacticalCorrect, evidence.contribution) };
  else await settleTerminalSessionItem(c.env, session.id);
  await c.env.DB.prepare(
    `UPDATE v5_sessions SET status=?, submitted_at=datetime('now'), settled_at=datetime('now'), correct_count=?, tactical_correct=?, evidence_score=?, result_json=?
      WHERE id=?`,
  ).bind(late ? 'timed_out' : 'settled', resultBase.correct, resultBase.tacticalCorrect ? 1 : 0, late ? 0 : evidence.contribution, JSON.stringify(result), session.id).run();
  await c.env.DB.prepare('UPDATE v5_session_submissions SET result_json=? WHERE session_id=?')
    .bind(JSON.stringify(result), session.id).run();
  return c.json({ state: await buildState(c.env, c.get('userId'), event), result });
});

liveCampaignApi.post('/api/v5/events/:id/forecast', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireOpenEvent(c.env, c.get('userId'), eventId);
  const clientRequestId = requestId(body.clientRequestId);
  if (Date.now() >= Date.parse(`${event.forecast_deadline}Z`)) throw new GameError('INVALID_TRANSITION', { reason: 'v5_forecast_closed' });
  if (!Number.isInteger(body.sectorId) || (body.sectorId as number) < 0 || (body.sectorId as number) > 6 || typeof body.action !== 'string' || !actions.has(body.action)) {
    throw new GameError('VALIDATION', { field: 'forecast' });
  }
  if (body.prediction !== 'sector_resolves' && body.prediction !== 'sector_misses') {
    throw new GameError('VALIDATION', { field: 'prediction' });
  }
  const prior = await c.env.DB.prepare('SELECT sector,action,predicted_outcome,status FROM v5_predictions WHERE event_id=? AND user_id=?')
    .bind(eventId, c.get('userId')).first<{ sector: number; action: LiveCampaignAction; predicted_outcome: string; status: string }>();
  if (prior) return c.json({ state: await buildState(c.env, c.get('userId'), event), forecast: prior });
  const influenced = await c.env.DB.prepare('SELECT 1 FROM v5_sessions WHERE event_id=? AND user_id=?').bind(eventId, c.get('userId')).first();
  if (influenced) throw new GameError('INVALID_TRANSITION', { reason: 'v5_forecast_before_move' });
  const sector = body.sectorId as number;
  const action = body.action as LiveCampaignAction;
  const predictedOutcome = body.prediction === 'sector_resolves' ? 'complete' : 'incomplete';
  await objectiveFor(c.env, eventId, sector, action);
  const inserted = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_predictions (campaign_id,event_id,user_id,sector,action,predicted_outcome,forecast_deadline,client_request_id)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(event.campaign_id, eventId, c.get('userId'), sector, action, predictedOutcome, event.forecast_deadline, clientRequestId).run();
  if (!inserted.meta.changes) {
    const replay = await c.env.DB.prepare('SELECT sector,action,predicted_outcome,status FROM v5_predictions WHERE event_id=? AND user_id=?')
      .bind(eventId, c.get('userId')).first();
    if (replay) return c.json({ state: await buildState(c.env, c.get('userId'), event), forecast: replay });
  }
  return c.json({
    state: await buildState(c.env, c.get('userId'), event),
    forecast: { sectorId: sector, action, prediction: body.prediction, status: 'pending' },
  });
});

liveCampaignApi.post('/api/v5/events/:id/raids/join', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireOpenEvent(c.env, c.get('userId'), eventId);
  const clientRequestId = requestId(body.clientRequestId);
  if (!Number.isInteger(body.sectorId) || (body.sectorId as number) < 0 || (body.sectorId as number) > 6 || typeof body.action !== 'string' || !actions.has(body.action)) {
    throw new GameError('VALIDATION', { field: 'raid' });
  }
  const targetSector = body.sectorId as number;
  const targetAction = body.action as LiveCampaignAction;
  await objectiveFor(c.env, eventId, targetSector, targetAction);
  if (!await v5Profile(c.env, c.get('userId')) || !await activeBird(c.env, event.campaign_id, c.get('userId'))) {
    throw new GameError('INVALID_TRANSITION', { reason: 'v5_raid_profile_required' });
  }
  const existing = await c.env.DB.prepare(
    `SELECT raid_id FROM v5_raid_members WHERE event_id=? AND user_id=?`,
  ).bind(eventId, c.get('userId')).first<{ raid_id: number }>();
  if (existing) return c.json({ state: await buildState(c.env, c.get('userId'), event) });
  const priorRaid = await c.env.DB.prepare(
    `SELECT 1 FROM v5_raids r JOIN v5_events e ON e.id=r.event_id
      WHERE r.campaign_id=? AND e.event_number >= ? AND e.event_number < ? LIMIT 1`,
  ).bind(event.campaign_id, Math.max(0, event.event_number - 2), event.event_number).first();
  if (priorRaid) throw new GameError('INVALID_TRANSITION', { reason: 'v5_raid_cooldown' });
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_raids
      (campaign_id,event_id,target_sector,reward_item_kind,reward_route_sector,client_request_key,queue_closes_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(event.campaign_id, eventId, targetSector, 'signal-thread', targetSector, `event:${eventId}:raid`, event.locks_at).run();
  const raid = await c.env.DB.prepare('SELECT id,status FROM v5_raids WHERE event_id=? AND target_sector=?')
    .bind(eventId, targetSector).first<{ id: number; status: string }>();
  if (!raid) throw new Error('v5 raid missing');
  const joined = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_raid_members (raid_id,event_id,user_id,assigned_role,client_request_id)
     SELECT ?,?,?,
       CASE (
         SELECT count(*) FROM v5_raid_members
          WHERE raid_id=? AND status NOT IN ('withdrawn','dissolved')
       ) % 3
         WHEN 0 THEN 'scout'
         WHEN 1 THEN 'claim'
         ELSE 'hold'
       END,
       ?
      WHERE (SELECT count(*) FROM v5_raid_members WHERE raid_id=? AND status NOT IN ('withdrawn','dissolved')) < 6`,
  ).bind(raid.id, eventId, c.get('userId'), raid.id, clientRequestId, raid.id).run();
  if (!joined.meta.changes) {
    const replay = await c.env.DB.prepare('SELECT 1 FROM v5_raid_members WHERE event_id=? AND user_id=?').bind(eventId, c.get('userId')).first();
    if (!replay) throw new GameError('RATE_LIMITED', { reason: 'v5_raid_full' });
  }
  await c.env.DB.prepare(
    `UPDATE v5_raids SET status=CASE WHEN (SELECT count(*) FROM v5_raid_members WHERE raid_id=? AND status NOT IN ('withdrawn','dissolved')) >= 4 THEN 'ready' ELSE 'queued' END,
       ready_at=CASE WHEN (SELECT count(*) FROM v5_raid_members WHERE raid_id=? AND status NOT IN ('withdrawn','dissolved')) >= 4 THEN coalesce(ready_at,datetime('now')) ELSE ready_at END
      WHERE id=? AND status IN ('queued','ready')`,
  ).bind(raid.id, raid.id, raid.id).run();
  await c.env.DB.prepare(
    `UPDATE v5_raid_members SET status='ready' WHERE raid_id=? AND status='queued'
       AND EXISTS (SELECT 1 FROM v5_raids WHERE id=? AND status='ready')`,
  ).bind(raid.id, raid.id).run();
  return c.json({ state: await buildState(c.env, c.get('userId'), event) });
});

liveCampaignApi.post('/api/v5/events/:id/raids/start', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireOpenEvent(c.env, c.get('userId'), eventId);
  requestId(body.clientRequestId);
  const member = await c.env.DB.prepare(
    `SELECT member.raid_id,member.assigned_role,member.status,member.attempt_seed,member.attempt_close_at,
            raid.target_sector,raid.status AS raid_status
       FROM v5_raid_members member JOIN v5_raids raid ON raid.id=member.raid_id
      WHERE member.event_id=? AND member.user_id=?`,
  ).bind(eventId, c.get('userId')).first<{
    raid_id: number; assigned_role: LiveCampaignAction; status: string; attempt_seed: string | null; attempt_close_at: string | null;
    target_sector: number; raid_status: string;
  }>();
  if (!member || member.raid_status !== 'ready') throw new GameError('INVALID_TRANSITION', { reason: 'v5_raid_not_ready' });
  const active = await activeBird(c.env, event.campaign_id, c.get('userId'));
  if (!active) throw new GameError('INVALID_TRANSITION', { reason: 'v5_active_bird_required' });
  if (!member.attempt_seed) {
    const startedAt = new Date();
    const claimed = await c.env.DB.prepare(
      `UPDATE v5_raid_members SET status='started',attempt_seed=?,attempt_started_at=?,attempt_close_at=?
        WHERE raid_id=? AND user_id=? AND status='ready' AND attempt_seed IS NULL`,
    ).bind(String(randomSeed()), sqlTime(startedAt), sqlTime(new Date(startedAt.getTime() + 90_000)), member.raid_id, c.get('userId')).run();
    if (!claimed.meta.changes) {
      // A double click races only with the same player; the stored attempt is reused below.
    }
  }
  const stored = await c.env.DB.prepare(
    `SELECT attempt_seed,attempt_close_at FROM v5_raid_members WHERE raid_id=? AND user_id=?`,
  ).bind(member.raid_id, c.get('userId')).first<{ attempt_seed: string | null; attempt_close_at: string | null }>();
  if (!stored?.attempt_seed || !stored.attempt_close_at) throw new Error('v5 raid attempt missing');
  const map = await campaignMap(c.env, event);
  const challenge = createLiveCampaignChallenge({
    seed: Number(stored.attempt_seed), bird: active.bird, action: member.assigned_role,
    sectorId: Number(member.target_sector), map,
  });
  const roleCard = challenge.cards.find((card) => card.kind === 'tactical');
  if (!roleCard) throw new Error('v5 raid role card missing');
  const raidServerCards = [challenge.cards[0]!, roleCard];
  const clientCards = toLiveCampaignChallengeClient({ ...challenge, cards: raidServerCards }).cards;
  await c.env.DB.batch(raidServerCards.map((card, index) => c.env.DB.prepare(
    `INSERT OR IGNORE INTO v5_raid_cards (raid_id,user_id,position,prompt_key,variant_key,render_json,correct_option)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(member.raid_id, c.get('userId'), index + 1, card.id, `${card.id}:${stored.attempt_seed}`, JSON.stringify(clientCards[index]), card.answer)));
  return c.json({
    state: await buildState(c.env, c.get('userId'), event),
    raid: { id: Number(member.raid_id), closeAt: toIso(stored.attempt_close_at), cards: await raidCards(c.env, member.raid_id, c.get('userId')) ?? [] },
  });
});

liveCampaignApi.post('/api/v5/events/:id/raids/submit', async (c) => {
  const body = await json(c);
  const eventId = numberValue(c.req.param('id'), 'eventId');
  const event = await requireEventAccess(c.env, c.get('userId'), eventId, true);
  requestId(body.clientRequestId);
  const answers = validAnswers(body.answers, 2);
  const member = await c.env.DB.prepare(
    `SELECT raid_id,status,attempt_close_at,attempt_answers_json FROM v5_raid_members WHERE event_id=? AND user_id=?`,
  ).bind(eventId, c.get('userId')).first<{ raid_id: number; status: string; attempt_close_at: string | null; attempt_answers_json: string | null }>();
  if (!member || !member.attempt_close_at) throw new GameError('INVALID_TRANSITION', { reason: 'v5_raid_attempt_required' });
  if (member.attempt_answers_json) return c.json({ state: await buildState(c.env, c.get('userId'), event) });
  const cards = (await c.env.DB.prepare(
    `SELECT position,correct_option FROM v5_raid_cards WHERE raid_id=? AND user_id=? ORDER BY position`,
  ).bind(member.raid_id, c.get('userId')).all<{ position: number; correct_option: number }>()).results;
  if (cards.length !== 2) throw new Error('v5 raid cards missing');
  const late = event.event_status !== 'open' || Date.now() > Date.parse(`${member.attempt_close_at}Z`) || Date.now() > Date.parse(`${event.locks_at}Z`);
  const correct = late ? 0 : cards.filter((card, index) => answers[index] === Number(card.correct_option)).length;
  const written = await c.env.DB.prepare(
    `UPDATE v5_raid_members SET status='submitted',attempt_answers_json=?,correct_count=?,resolved_at=NULL
      WHERE raid_id=? AND user_id=? AND attempt_answers_json IS NULL AND status='started'`,
  ).bind(JSON.stringify(answers), correct, member.raid_id, c.get('userId')).run();
  if (written.meta.changes) await maybeResolveRaid(c.env, member.raid_id);
  return c.json({ state: await buildState(c.env, c.get('userId'), event), result: { correct, timedOut: late } });
});

/** Cron-facing resolver. It is safe to call repeatedly; each state update is guarded by a terminal status. */
export async function resolveLiveCampaignDueEvents(env: Env, now = new Date()): Promise<number> {
  if (!liveCampaignV5GloballyEnabled(env)) return 0;
  const due = (await env.DB.prepare(
    `SELECT e.id AS event_id, e.event_number, e.status AS event_status, e.event_tier, e.threshold,
            e.opens_at,e.locks_at,e.forecast_deadline,e.storm_sector,
            campaign.id AS campaign_id,campaign.campaign_number,campaign.status AS campaign_status,campaign.starts_at AS campaign_starts_at,campaign.ends_at AS campaign_ends_at,
            chat.id AS chat_id,chat.telegram_chat_id,chat.status AS chat_status,settings.game_enabled
       FROM v5_events e JOIN v5_campaigns campaign ON campaign.id=e.campaign_id
       JOIN v5_campaign_chats chat ON chat.id=campaign.chat_id JOIN v5_chat_settings settings ON settings.chat_id=chat.id
      WHERE e.status IN ('open','locked') AND e.locks_at <= ?
        AND chat.status='armed' AND settings.game_enabled=1`,
  ).bind(sqlTime(now)).all<EventAccessRow>()).results;
  let resolved = 0;
  for (const row of due) {
    const event: EventAccessRow = { ...row, event_id: Number(row.event_id), campaign_id: Number(row.campaign_id), chat_id: Number(row.chat_id), event_number: Number(row.event_number), event_tier: Number(row.event_tier), threshold: Number(row.threshold), storm_sector: row.storm_sector === null ? null : Number(row.storm_sector), telegram_chat_id: Number(row.telegram_chat_id), game_enabled: Number(row.game_enabled), campaign_number: Number(row.campaign_number) };
    if (event.event_status === 'open') {
      const locked = await env.DB.prepare("UPDATE v5_events SET status='locked', locked_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status='open'")
        .bind(event.event_id).run();
      if (!locked.meta.changes) continue;
      event.event_status = 'locked';
    }
    // A player who never returns after starting a series must not lose an
    // inventory slot forever.  This is deliberately before objective/event
    // settlement, while all still-started sessions are unambiguously void.
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE v5_session_items
            SET status=CASE WHEN EXISTS (
                  SELECT 1 FROM v5_inventory_items item
                   WHERE item.id=v5_session_items.inventory_item_id AND item.item_kind='lens'
                ) THEN 'consumed' ELSE 'released' END,
                resolved_at=datetime('now')
          WHERE status='armed' AND session_id IN (
            SELECT id FROM v5_sessions WHERE event_id=? AND status='started'
          )`,
      ).bind(event.event_id),
      env.DB.prepare(
        `UPDATE v5_sessions
            SET status='timed_out', settled_at=datetime('now'), result_json=COALESCE(result_json, '{"timedOut":true}')
          WHERE event_id=? AND status='started'`,
      ).bind(event.event_id),
    ]);
    await env.DB.prepare("UPDATE v5_event_objectives SET status='failed', resolved_at=datetime('now'), updated_at=datetime('now') WHERE event_id=? AND status='open'")
      .bind(event.event_id).run();
    const completeRows = (await env.DB.prepare(
      `SELECT sector,action,status FROM v5_event_objectives WHERE event_id=?`,
    ).bind(event.event_id).all<{ sector: number; action: LiveCampaignAction; status: ObjectiveStatus }>()).results;
    for (const objective of completeRows) {
      const outcome = objective.status === 'completed' ? 'complete' : 'incomplete';
      await env.DB.prepare(
        `UPDATE v5_predictions SET status=CASE WHEN predicted_outcome=? THEN 'won' ELSE 'lost' END,
         payout=CASE WHEN predicted_outcome=? THEN 2 ELSE 0 END, settled_at=datetime('now')
          WHERE event_id=? AND sector=? AND action=? AND status='pending'`,
      ).bind(outcome, outcome, event.event_id, objective.sector, objective.action).run();
    }
    if (event.storm_sector !== null) {
      const map = await campaignMap(env, event);
      const before = map.sectors[event.storm_sector]!;
      const storm = resolveLiveCampaignStorm(map);
      const after = storm.map.sectors[event.storm_sector]!;
      if (storm.note !== 'no_storm' && storm.note !== 'no_effect') {
        const kind = storm.note === 'ward_absorbed' ? 'ward_consumed' : 'storm';
        const applied = await addMapMutation(env, event, null, before, after, kind, `event:${event.event_id}:storm`);
        if (applied) await env.DB.prepare(
          `UPDATE v5_campaign_sectors SET state=?,ward_count=?,version=version+1,updated_at=datetime('now') WHERE campaign_id=? AND sector=?`,
        ).bind(after.state, after.wards, event.campaign_id, event.storm_sector).run();
      }
    }
    const raids = (await env.DB.prepare(
      `SELECT id FROM v5_raids WHERE event_id=? AND status IN ('queued','ready')`,
    ).bind(event.event_id).all<{ id: number }>()).results;
    for (const raid of raids) await maybeResolveRaid(env, Number(raid.id), true);
    const safetyRail = await applySafetyRailIfNeeded(env, event, completeRows);
    const done = await env.DB.prepare(
      `UPDATE v5_events SET status='resolved', resolved_at=datetime('now'), result_json=?, updated_at=datetime('now')
        WHERE id=? AND status='locked'`,
    ).bind(JSON.stringify({
      resolvedAt: now.toISOString(),
      objectives: completeRows.map((row) => ({ sector: Number(row.sector), action: row.action, status: row.status })),
      stormSector: event.storm_sector,
      safetyRail,
    }), event.event_id).run();
    if (done.meta.changes) resolved += 1;
  }
  return resolved;
}
