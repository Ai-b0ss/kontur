import {
  DEFAULT_BALANCE,
  DEFAULT_FEATURES,
  ROLES,
  dailyGiveBudget,
  gameDay,
  gameEpochFrom,
  isDoubleDay,
  passiveAvailable,
  type Role,
} from '@kontur/core';
import type { GameState, Palette } from '@kontur/contracts';
import type { ColoringRow, Env, PlayerRow, UserRow } from './types.js';

const FALLBACK_PALETTE: Palette = {
  body: '#edd9b6', belly: '#faeed6', wing: '#d3ae74',
  tail: '#c09a68', crest: '#c8a26c', beak: '#ef8a52',
};

export function currentGameDay(env: Pick<Env, 'SEASON_START'>, now = new Date()): number {
  const epoch = gameEpochFrom(new Date(env.SEASON_START || '2026-08-01'), DEFAULT_BALANCE);
  // В день запуска до 04:00 МСК сезон уже доступен, но первая игровая ночь ещё не началась.
  return Math.max(0, gameDay(now, epoch));
}

export async function ensureUser(
  db: D1Database,
  tgId: number,
  username: string | null,
): Promise<{ user: UserRow; isNew: boolean }> {
  const prior = await db.prepare('SELECT id FROM users WHERE tg_id = ?').bind(tgId).first<{ id: number }>();
  const user = await db.prepare(
    `INSERT INTO users (tg_id, username, last_seen_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(tg_id) DO UPDATE SET
       -- Telegram omits username for some valid updates. Never erase a
       -- previously known identity merely because this update has no handle.
       username = CASE
         WHEN excluded.username IS NULL OR trim(excluded.username) = '' THEN users.username
         ELSE excluded.username
       END,
       last_seen_at = datetime('now')
     RETURNING *`,
  ).bind(tgId, username).first<UserRow>();
  if (!user) throw new Error('ensureUser failed');
  return { user, isNew: !prior };
}

export async function loadPlayer(db: D1Database, userId: number): Promise<PlayerRow> {
  const row = await db.prepare(
    `SELECT u.id, u.tg_id, u.username, u.started_bot_at, u.is_member,
            u.member_checked_at, u.banned_at, u.push_enabled,
            u.quiet_from_hour, u.quiet_to_hour, u.push_misses,
            p.user_id, p.role, p.bird_result_id, p.coloring, p.hatched_at, p.bird_name,
            w.wallet, w.reputation, w.passive_collected_day
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       JOIN wallets w ON w.user_id = u.id
      WHERE u.id = ?`,
  ).bind(userId).first<PlayerRow>();
  if (!row) throw new Error(`player ${userId} not found`);
  return row;
}

export async function logEvent(
  db: D1Database,
  userId: number | null,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.prepare('INSERT INTO events (user_id, type, payload) VALUES (?, ?, ?)')
    .bind(userId, type, JSON.stringify(payload)).run();
}

export async function buildState(
  env: Env,
  userId: number,
  now = new Date(),
): Promise<GameState> {
  const player = await loadPlayer(env.DB, userId);
  const day = currentGameDay(env, now);
  const doubleDay = isDoubleDay(now, DEFAULT_BALANCE.GAME_DAY_START_UTC);
  const coloring = await env.DB.prepare('SELECT * FROM colorings WHERE code = ?')
    .bind(player.coloring).first<ColoringRow>();
  const given = await env.DB.prepare(
    'SELECT count(*) AS n FROM worm_grants WHERE from_user_id = ? AND game_day = ?',
  ).bind(userId, day).first<{ n: number }>();
  const owned = await env.DB.prepare(
    'SELECT count(*) AS n FROM player_colorings WHERE user_id = ?',
  ).bind(userId).first<{ n: number }>();
  const total = await env.DB.prepare('SELECT count(*) AS n FROM colorings').first<{ n: number }>();
  const signals = await env.DB.prepare(
    'SELECT count(*) AS n FROM signal_cards WHERE user_id = ?',
  ).bind(userId).first<{ n: number }>();

  const role = (player.role ?? null) as Role | null;
  const hatched = Boolean(role && player.hatched_at);
  const budget = dailyGiveBudget(doubleDay, DEFAULT_BALANCE);
  const palette = coloring ? JSON.parse(coloring.palette) as Palette : FALLBACK_PALETTE;

  return {
    serverTime: now.toISOString(),
    gameDay: day,
    isDoubleDay: doubleDay,
    hatched,
    features: {
      eggs: DEFAULT_FEATURES.FEATURE_EGGS,
      community: DEFAULT_FEATURES.FEATURE_COMMUNITY,
      passive: DEFAULT_FEATURES.FEATURE_PASSIVE,
    },
    player: {
      userId,
      username: player.username,
      role,
      birdResultId: hatched ? player.bird_result_id : null,
      roleTitle: role ? ROLES[role].title : null,
      roleTagline: role ? ROLES[role].tagline : null,
      birdName: player.bird_name,
      coloring: player.coloring,
      coloringTitle: coloring?.title ?? 'Обычный',
      palette,
      hatchedAt: player.hatched_at ? iso(player.hatched_at) : null,
      wallet: Number(player.wallet),
      reputation: Number(player.reputation),
      signalCount: Number(signals?.n ?? 0),
    },
    give: {
      budget,
      left: Math.max(0, budget - Number(given?.n ?? 0)),
      valueWithReason: DEFAULT_BALANCE.WORM_VALUE_WITH_REASON * (doubleDay ? DEFAULT_BALANCE.WORM_DOUBLE_DAY_FACTOR : 1),
      valuePlain: DEFAULT_BALANCE.WORM_VALUE_PLAIN * (doubleDay ? DEFAULT_BALANCE.WORM_DOUBLE_DAY_FACTOR : 1),
    },
    egg: hatched ? {
      cost: DEFAULT_BALANCE.EGG_COST,
      affordable: Number(player.wallet) >= DEFAULT_BALANCE.EGG_COST,
      owned: Number(owned?.n ?? 0),
      total: Number(total?.n ?? 0),
    } : null,
    passive: hatched ? {
      available: passiveAvailable(player.passive_collected_day, day, DEFAULT_BALANCE),
      collectedToday: player.passive_collected_day === day,
    } : null,
  };
}

export function iso(value: string): string {
  return new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();
}
