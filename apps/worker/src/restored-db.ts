import { ROLES, type Role } from '@kontur/core';
import type {
  RestoredActionDto,
  RestoredActionStatus,
  RestoredConnectionDto,
  RestoredExperienceState,
  RestoredMotion,
  RestoredNestItemDto,
  RestoredPathKind,
  RestoredVisibility,
  SaveRestoredActionRequest,
  SaveRestoredNestRequest,
} from '@kontur/contracts';
import { buildState, iso, logEvent } from './db.js';
import { GameError } from './errors.js';
import type { Env } from './types.js';

interface ActionRow {
  id: number;
  kind: RestoredPathKind;
  status: RestoredActionStatus;
  title: string;
  note: string | null;
  chat_code: string | null;
  visibility: RestoredVisibility;
  created_at: string;
  updated_at: string;
}

interface NestRow {
  id: number;
  source_kind: RestoredNestItemDto['sourceKind'];
  source_id: string | null;
  title: string;
  note: string | null;
  next_step: string | null;
  status: RestoredNestItemDto['status'];
  created_at: string;
  updated_at: string;
}

const PATH_ORDER: RestoredPathKind[] = [
  'ask', 'help', 'connect', 'orient', 'opportunity', 'contribution', 'save', 'progress',
];
const LEVELS = [
  { at: 0, title: 'Птенец' },
  { at: 2, title: 'Собиратель сигналов' },
  { at: 5, title: 'Навигатор' },
  { at: 9, title: 'Связующий' },
  { at: 14, title: 'Маяк стаи' },
] as const;

function actionDto(row: ActionRow): RestoredActionDto {
  return {
    id: Number(row.id), kind: row.kind, status: row.status, title: row.title,
    note: row.note, chatCode: row.chat_code, visibility: row.visibility,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}

function nestDto(row: NestRow): RestoredNestItemDto {
  return {
    id: Number(row.id), sourceKind: row.source_kind, sourceId: row.source_id,
    title: row.title, note: row.note, nextStep: row.next_step, status: row.status,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}

export async function buildRestoredState(env: Env, userId: number): Promise<RestoredExperienceState> {
  const [game, chats, opportunities, actions, completedRows, nest, connectionRows, signals, preference] = await Promise.all([
    buildState(env, userId),
    env.DB.prepare(
      `SELECT code,title,purpose,kind FROM pilot_chats WHERE active=1 ORDER BY position,id`,
    ).all<{ code: string; title: string; purpose: string; kind: 'general' | 'specialist' }>(),
    env.DB.prepare(
      `SELECT code,kind,title,description,action_label FROM restored_opportunities
        WHERE active=1 ORDER BY position,code`,
    ).all<{ code: string; kind: 'grant' | 'project' | 'event' | 'resource'; title: string; description: string; action_label: string }>(),
    env.DB.prepare(
      `SELECT id,kind,status,title,note,chat_code,visibility,created_at,updated_at
         FROM restored_actions WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 30`,
    ).bind(userId).all<ActionRow>(),
    env.DB.prepare(
      `SELECT DISTINCT kind FROM restored_actions WHERE user_id=? AND status='done'`,
    ).bind(userId).all<{ kind: RestoredPathKind }>(),
    env.DB.prepare(
      `SELECT id,source_kind,source_id,title,note,next_step,status,created_at,updated_at
         FROM restored_nest_items WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 40`,
    ).bind(userId).all<NestRow>(),
    env.DB.prepare(
      `SELECT a.id AS action_id,a.title,a.note,a.updated_at,u.id AS user_id,u.username,
              p.bird_name,p.role,c.palette
         FROM restored_actions a
         JOIN users u ON u.id=a.user_id
         JOIN profiles p ON p.user_id=u.id
         JOIN colorings c ON c.code=p.coloring
        WHERE a.kind='connect' AND a.visibility='flock' AND a.status IN ('planned','active')
        ORDER BY a.updated_at DESC,a.id DESC LIMIT 16`,
    ).all<{ action_id: number; title: string; note: string | null; updated_at: string; user_id: number; username: string | null; bird_name: string | null; role: Role | null; palette: string }>(),
    env.DB.prepare(
      `SELECT id,kind,title,issued_at FROM signal_cards WHERE user_id=? ORDER BY issued_at DESC,id DESC`,
    ).bind(userId).all<{ id: number; kind: 'cu_event' | 'agency_case' | 'own_project'; title: string; issued_at: string }>(),
    env.DB.prepare('SELECT motion FROM restored_preferences WHERE user_id=?')
      .bind(userId).first<{ motion: RestoredMotion }>(),
  ]);

  const completedKinds = completedRows.results.map((row) => row.kind);
  const usefulKinds = completedKinds.filter((kind) => kind !== 'progress').length;
  const collectedSkins = game.egg?.owned ?? 0;
  const verifiedSignals = game.player.signalCount;
  const score = usefulKinds + Math.min(3, Math.max(0, collectedSkins - 1)) + verifiedSignals * 2;
  let levelIndex = 0;
  for (let index = 0; index < LEVELS.length; index++) {
    if (score >= LEVELS[index]!.at) levelIndex = index;
  }
  const nextLevel = LEVELS[levelIndex + 1] ?? null;
  const nextKind = PATH_ORDER.find((kind) => kind !== 'progress' && !completedKinds.includes(kind)) ?? null;

  const connections: RestoredConnectionDto[] = connectionRows.results.map((row) => ({
    actionId: Number(row.action_id), username: row.username, birdName: row.bird_name,
    role: row.role, roleTitle: row.role ? ROLES[row.role].title : null,
    palette: JSON.parse(row.palette), title: row.title, note: row.note,
    updatedAt: iso(row.updated_at), isMe: Number(row.user_id) === userId,
  }));

  return {
    version: 'v3', serverTime: new Date().toISOString(), game,
    chats: chats.results.map((row) => ({ ...row })),
    opportunities: opportunities.results.map((row) => ({
      code: row.code, kind: row.kind, title: row.title,
      description: row.description, actionLabel: row.action_label,
    })),
    actions: actions.results.map(actionDto), nest: nest.results.map(nestDto), connections,
    signals: signals.results.map((row) => ({
      id: Number(row.id), kind: row.kind, title: row.title, issuedAt: iso(row.issued_at),
    })),
    progress: {
      level: levelIndex + 1, levelTitle: LEVELS[levelIndex]!.title, score,
      nextLevelAt: nextLevel?.at ?? null, completedKinds, usefulKinds,
      collectedSkins, verifiedSignals, nextKind,
    },
    preferences: { motion: preference?.motion ?? 'system' },
  };
}

export async function saveRestoredAction(
  env: Env,
  userId: number,
  input: SaveRestoredActionRequest,
): Promise<RestoredExperienceState> {
  if (input.visibility === 'flock' && input.kind !== 'connect') {
    throw new GameError('VALIDATION', { field: 'visibility' });
  }
  if (input.chatCode) {
    const chat = await env.DB.prepare(
      'SELECT id FROM pilot_chats WHERE code=? AND active=1',
    ).bind(input.chatCode).first();
    if (!chat) throw new GameError('VALIDATION', { field: 'chatCode' });
  }
  const prior = await env.DB.prepare(
    'SELECT id FROM restored_actions WHERE user_id=? AND client_request_id=?',
  ).bind(userId, input.clientRequestId).first();
  if (!prior) {
    try {
      await env.DB.prepare(
        `INSERT INTO restored_actions
          (user_id,kind,status,title,note,chat_code,visibility,client_request_id,completed_at)
         VALUES (?,?,?,?,?,?,?,?,CASE WHEN ?='done' THEN datetime('now') END)`,
      ).bind(
        userId, input.kind, input.status, input.title,
        input.note ?? null, input.chatCode ?? null, input.visibility ?? 'private',
        input.clientRequestId, input.status,
      ).run();
      await logEvent(env.DB, userId, 'restored_action_saved', {
        kind: input.kind, status: input.status, visibility: input.visibility ?? 'private',
      });
    } catch (error) {
      const replay = await env.DB.prepare(
        'SELECT id FROM restored_actions WHERE user_id=? AND client_request_id=?',
      ).bind(userId, input.clientRequestId).first();
      if (!replay) throw error;
    }
  }
  return buildRestoredState(env, userId);
}

export async function updateRestoredAction(
  env: Env,
  userId: number,
  actionId: number,
  status: RestoredActionStatus,
  clientRequestId: string,
): Promise<RestoredExperienceState> {
  const action = await env.DB.prepare('SELECT id,status FROM restored_actions WHERE id=? AND user_id=?')
    .bind(actionId, userId).first<{ id: number; status: RestoredActionStatus }>();
  if (!action) throw new GameError('RESTORED_ACTION_NOT_FOUND');
  if (action.status === 'done' && status !== 'done') throw new GameError('INVALID_TRANSITION');
  if (action.status === 'active' && status === 'planned') throw new GameError('INVALID_TRANSITION');
  const prior = await env.DB.prepare(
    'SELECT action_id FROM restored_action_updates WHERE user_id=? AND client_request_id=?',
  ).bind(userId, clientRequestId).first<{ action_id: number }>();
  if (prior && Number(prior.action_id) !== actionId) throw new GameError('VALIDATION');
  if (!prior) {
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO restored_action_updates (user_id,action_id,client_request_id,status)
           VALUES (?,?,?,?)`,
        ).bind(userId, actionId, clientRequestId, status),
        env.DB.prepare(
          `UPDATE restored_actions SET status=?,updated_at=datetime('now'),
                  completed_at=CASE WHEN ?='done' THEN coalesce(completed_at,datetime('now')) ELSE NULL END
            WHERE id=? AND user_id=?`,
        ).bind(status, status, actionId, userId),
      ]);
      await logEvent(env.DB, userId, 'restored_action_status', { status });
    } catch (error) {
      const replay = await env.DB.prepare(
        'SELECT action_id FROM restored_action_updates WHERE user_id=? AND client_request_id=?',
      ).bind(userId, clientRequestId).first<{ action_id: number }>();
      if (!replay || Number(replay.action_id) !== actionId) throw error;
    }
  }
  return buildRestoredState(env, userId);
}

export async function saveRestoredNest(
  env: Env,
  userId: number,
  input: SaveRestoredNestRequest,
): Promise<RestoredExperienceState> {
  const prior = await env.DB.prepare(
    'SELECT id FROM restored_nest_items WHERE user_id=? AND client_request_id=?',
  ).bind(userId, input.clientRequestId).first();
  const sameSource = input.sourceId ? await env.DB.prepare(
    'SELECT id FROM restored_nest_items WHERE user_id=? AND source_kind=? AND source_id=?',
  ).bind(userId, input.sourceKind, input.sourceId).first() : null;
  if (!prior && !sameSource) {
    try {
      await env.DB.prepare(
        `INSERT INTO restored_nest_items
          (user_id,source_kind,source_id,title,note,next_step,client_request_id)
         VALUES (?,?,?,?,?,?,?)`,
      ).bind(
        userId, input.sourceKind, input.sourceId ?? null, input.title,
        input.note ?? null, input.nextStep ?? null, input.clientRequestId,
      ).run();
      await logEvent(env.DB, userId, 'restored_nest_saved', { sourceKind: input.sourceKind });
    } catch (error) {
      const replay = await env.DB.prepare(
        `SELECT id FROM restored_nest_items WHERE user_id=? AND (
          client_request_id=? OR (source_kind=? AND source_id=?))`,
      ).bind(userId, input.clientRequestId, input.sourceKind, input.sourceId ?? null).first();
      if (!replay) throw error;
    }
  }
  return buildRestoredState(env, userId);
}

export async function updateRestoredNest(
  env: Env,
  userId: number,
  itemId: number,
  status: RestoredNestItemDto['status'],
  nextStep: string | undefined,
  clientRequestId: string,
): Promise<RestoredExperienceState> {
  const item = await env.DB.prepare('SELECT id,status FROM restored_nest_items WHERE id=? AND user_id=?')
    .bind(itemId, userId).first<{ id: number; status: RestoredNestItemDto['status'] }>();
  if (!item) throw new GameError('RESTORED_NEST_ITEM_NOT_FOUND');
  if (item.status === 'done' && status !== 'done') throw new GameError('INVALID_TRANSITION');
  const prior = await env.DB.prepare(
    'SELECT nest_item_id FROM restored_nest_updates WHERE user_id=? AND client_request_id=?',
  ).bind(userId, clientRequestId).first<{ nest_item_id: number }>();
  if (prior && Number(prior.nest_item_id) !== itemId) throw new GameError('VALIDATION');
  if (!prior) {
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO restored_nest_updates (user_id,nest_item_id,client_request_id,status)
           VALUES (?,?,?,?)`,
        ).bind(userId, itemId, clientRequestId, status),
        env.DB.prepare(
          `UPDATE restored_nest_items SET status=?,next_step=coalesce(?,next_step),updated_at=datetime('now')
            WHERE id=? AND user_id=?`,
        ).bind(status, nextStep ?? null, itemId, userId),
      ]);
      await logEvent(env.DB, userId, 'restored_nest_status', { status });
    } catch (error) {
      const replay = await env.DB.prepare(
        'SELECT nest_item_id FROM restored_nest_updates WHERE user_id=? AND client_request_id=?',
      ).bind(userId, clientRequestId).first<{ nest_item_id: number }>();
      if (!replay || Number(replay.nest_item_id) !== itemId) throw error;
    }
  }
  return buildRestoredState(env, userId);
}

export async function updateRestoredMotion(
  env: Env,
  userId: number,
  motion: RestoredMotion,
): Promise<RestoredExperienceState> {
  await env.DB.prepare(
    `INSERT INTO restored_preferences (user_id,motion) VALUES (?,?)
     ON CONFLICT(user_id) DO UPDATE SET motion=excluded.motion,updated_at=datetime('now')`,
  ).bind(userId, motion).run();
  return buildRestoredState(env, userId);
}
