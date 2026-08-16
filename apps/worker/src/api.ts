import { Hono, type MiddlewareHandler } from 'hono';
import {
  DEFAULT_BALANCE,
  QUESTIONS,
  ROLES,
  decideGrant,
  isAnnounceworthy,
  isDoubleDay,
  resolveRole,
  rollEgg,
  validateAnswers,
  type Coloring,
  type Role,
} from '@kontur/core';
import type { Palette, SignalKind } from '@kontur/contracts';
import { issueToken, verifyInitData, verifyToken } from './crypto.js';
import { buildState, currentGameDay, ensureUser, iso, loadPlayer, logEvent } from './db.js';
import { GameError, sqliteError } from './errors.js';
import { checkMembership, sendMessage } from './telegram-api.js';
import type { ColoringRow, Env } from './types.js';
import { journeyApi } from './journey-api.js';
import { experienceV2Allowed, zeroSeasonGloballyEnabled } from './experience-access.js';
import { restoredApi } from './restored-api.js';
import { zeroSeasonApi } from './zero-season-api.js';
import { liveCampaignApi } from './live-campaign-api.js';
import { localKonturApi } from './local-kontur-api.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const api = new Hono<AppEnv>();

function requestId(body: unknown): string {
  const value = (body as { clientRequestId?: unknown } | null)?.clientRequestId;
  if (typeof value !== 'string' || value.length < 8 || value.length > 100) {
    throw new GameError('VALIDATION', { field: 'clientRequestId' });
  }
  return value;
}

async function json(c: Parameters<typeof api.fetch>[0] extends never ? never : any) {
  try { return await c.req.json(); } catch { throw new GameError('VALIDATION'); }
}

async function authenticateBase(
  c: Parameters<MiddlewareHandler<AppEnv>>[0],
  next: Parameters<MiddlewareHandler<AppEnv>>[1],
  requireMainChatMembership: boolean,
) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) throw new GameError('SESSION_EXPIRED');
  const userId = await verifyToken(c.env.JWT_SECRET, header.slice(7));

  if (c.env.DEV_MODE !== 'true') {
    const window = Math.floor(Date.now() / 60_000);
    const rate = await c.env.DB.prepare(
      `INSERT INTO rate_limits (user_id, window, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, window) DO UPDATE SET count = count + 1
       RETURNING count`,
    ).bind(userId, window).first<{ count: number }>();
    if (Number(rate?.count ?? 99) > 30) throw new GameError('RATE_LIMITED');
  }

  const user = await c.env.DB.prepare('SELECT banned_at, is_member FROM users WHERE id = ?')
    .bind(userId).first<{ banned_at: string | null; is_member: number }>();
  if (!user) throw new GameError('SESSION_EXPIRED');
  if (user.banned_at) throw new GameError('BANNED');
  if (requireMainChatMembership && !user.is_member && c.env.DEV_MODE !== 'true') throw new GameError('NOT_MEMBER');
  c.set('userId', userId);
  await next();
}

const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => authenticateBase(c, next, true);
/** V5 checks membership in the dynamically registered campaign chat inside its own router. */
const authenticateV5: MiddlewareHandler<AppEnv> = async (c, next) => authenticateBase(c, next, false);

api.use('/api/v1/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === '/api/v1/auth/telegram' || path === '/api/v1/health' || path === '/api/v1/admin/signal') return next();
  return authenticate(c, next);
});
api.use('/api/v2/*', authenticate);
api.use('/api/v3/*', authenticate);
api.use('/api/v4/*', authenticate);
api.use('/api/v5/*', authenticateV5);

const legacyWriteGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (await experienceV2Allowed(c.env, c.get('userId'))) {
    throw new GameError('INVALID_TRANSITION', { reason: 'legacy_archive_read_only' });
  }
  await next();
};
api.use('/api/v1/onboarding/*', legacyWriteGuard);
api.use('/api/v1/passive/*', legacyWriteGuard);
api.use('/api/v1/egg/*', legacyWriteGuard);
api.use('/api/v1/coloring/*', legacyWriteGuard);
api.use('/api/v1/visit/*', legacyWriteGuard);

api.get('/api/v1/health', async (c) => {
  const stats = await c.env.DB.prepare(
    `SELECT
      (SELECT count(*) FROM users WHERE started_bot_at IS NOT NULL) AS started,
      (SELECT count(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched,
      (SELECT count(*) FROM worm_grants) AS grants`,
  ).first<{ started: number; hatched: number; grants: number }>();
  return c.json({
    ok: true,
    devMode: c.env.DEV_MODE === 'true',
    driver: 'd1',
    gameDay: currentGameDay(c.env),
    startedBot: Number(stats?.started ?? 0),
    hatched: Number(stats?.hatched ?? 0),
    grants: Number(stats?.grants ?? 0),
  });
});

api.post('/api/v1/auth/telegram', async (c) => {
  const body = await json(c) as { initData?: unknown; source?: unknown };
  if (typeof body.initData !== 'string') throw new GameError('INVALID_INIT_DATA');
  const identity = await verifyInitData(c.env, body.initData);
  const { user, isNew } = await ensureUser(c.env.DB, identity.tgId, identity.username);
  const campaignV5 = body.source === 'campaign-v5';
  let member = Boolean(user.is_member);
  const checked = user.member_checked_at ? Date.parse(`${user.member_checked_at}Z`) : 0;
  if (c.env.DEV_MODE === 'true') {
    member = true;
    await c.env.DB.prepare(
      `UPDATE users SET is_member = 1, member_checked_at = datetime('now'),
                        started_bot_at = coalesce(started_bot_at, datetime('now'))
        WHERE id = ?`,
    ).bind(user.id).run();
  } else if (!campaignV5 && Date.now() - checked > 6 * 3_600_000) {
    member = await checkMembership(c.env, identity.tgId);
    await c.env.DB.prepare(
      `UPDATE users SET is_member = ?, member_checked_at = datetime('now') WHERE id = ?`,
    ).bind(member ? 1 : 0, user.id).run();
  }
  if (!campaignV5 && !member) throw new GameError('NOT_MEMBER');
  const started = await c.env.DB.prepare('SELECT started_bot_at FROM users WHERE id = ?')
    .bind(user.id).first<{ started_bot_at: string | null }>();
  if (!started?.started_bot_at) throw new GameError('NOT_STARTED');
  const source = typeof body.source === 'string' && body.source.length <= 48 ? body.source : 'direct';
  await logEvent(c.env.DB, user.id, 'link_open', { source });
  await logEvent(c.env.DB, user.id, 'auth_done', { isNew });
  const session = await issueToken(c.env.JWT_SECRET, user.id);
  return c.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    state: await buildState(c.env, user.id),
  });
});

api.get('/api/v1/state', (c) => buildState(c.env, c.get('userId')).then((v) => c.json(v)));

api.get('/api/v1/questions', (c) => c.json({
  questions: QUESTIONS.map((q) => ({ text: q.text, options: q.options.map((o) => o.text) })),
}));

api.post('/api/v1/onboarding/hatch', async (c) => {
  const body = await json(c) as { answers?: unknown; birdName?: unknown; clientRequestId?: unknown };
  const reqId = requestId(body);
  const prior = await c.env.DB.prepare(
    'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ? AND client_request_id = ?',
  ).bind(c.get('userId'), reqId).first<{ role: Role; bird_name: string | null }>();
  if (!prior) {
    if (!validateAnswers(body.answers)) throw new GameError('VALIDATION', { field: 'answers' });
    const { role, scores } = resolveRole(body.answers);
    const birdName = typeof body.birdName === 'string' && body.birdName.trim()
      ? body.birdName.trim().slice(0, 24) : null;
    try {
      await c.env.DB.prepare(
        `INSERT INTO onboarding_answers
          (user_id, client_request_id, answers, role, scores, bird_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(c.get('userId'), reqId, JSON.stringify(body.answers), role, JSON.stringify(scores), birdName).run();
      await logEvent(c.env.DB, c.get('userId'), 'hatched', { role, scores });
    } catch (error) { sqliteError(error); }
  }
  const saved = prior ?? await c.env.DB.prepare(
    'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ?',
  ).bind(c.get('userId')).first<{ role: Role; bird_name: string | null }>();
  if (!saved) throw new Error('hatch missing');
  const coloring = await c.env.DB.prepare("SELECT * FROM colorings WHERE code = 'plain'").first<ColoringRow>();
  if (!coloring) throw new Error('plain coloring missing');
  const meta = ROLES[saved.role];
  return c.json({
    role: saved.role,
    roleTitle: meta.title,
    roleTagline: meta.tagline,
    coloring: coloring.code,
    coloringTitle: coloring.title,
    palette: JSON.parse(coloring.palette),
    shareText: `Вылупился ${meta.title}${saved.bird_name ? ` — ${saved.bird_name}` : ''}. ${meta.tagline}.`,
    state: await buildState(c.env, c.get('userId')),
  });
});

api.post('/api/v1/passive/collect', async (c) => {
  if (zeroSeasonGloballyEnabled(c.env)) {
    throw new GameError('INVALID_TRANSITION', { reason: 'local_passive_disabled' });
  }
  const body = await json(c);
  const reqId = requestId(body);
  const userId = c.get('userId');
  const player = await loadPlayer(c.env.DB, userId);
  if (!player.hatched_at) throw new GameError('NOT_HATCHED');
  const day = currentGameDay(c.env);
  const prior = await c.env.DB.prepare(
    'SELECT amount FROM passive_claims WHERE user_id = ? AND client_request_id = ?',
  ).bind(userId, reqId).first<{ amount: number }>();
  let amount = prior?.amount;
  if (amount === undefined) {
    try {
      await c.env.DB.prepare(
        'INSERT INTO passive_claims (user_id, game_day, amount, client_request_id) VALUES (?, ?, ?, ?)',
      ).bind(userId, day, DEFAULT_BALANCE.PASSIVE_WORMS_PER_DAY, reqId).run();
      amount = DEFAULT_BALANCE.PASSIVE_WORMS_PER_DAY;
      await logEvent(c.env.DB, userId, 'passive_collect', { amount });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed: passive_claims.user_id, passive_claims.game_day')) {
        throw new GameError('NOTHING_TO_COLLECT');
      }
      const replay = await c.env.DB.prepare(
        'SELECT amount FROM passive_claims WHERE user_id = ? AND client_request_id = ?',
      ).bind(userId, reqId).first<{ amount: number }>();
      if (!replay) throw error;
      amount = replay.amount;
    }
  }
  return c.json({ collected: amount, state: await buildState(c.env, userId) });
});

api.post('/api/v1/egg/open', async (c) => {
  const body = await json(c);
  const reqId = requestId(body);
  const userId = c.get('userId');
  const player = await loadPlayer(c.env.DB, userId);
  if (!player.hatched_at) throw new GameError('NOT_HATCHED');

  let pull = await c.env.DB.prepare(
    `SELECT e.*, c.title, c.rarity, c.palette FROM egg_pulls e
      JOIN colorings c ON c.code = e.coloring_code
     WHERE e.user_id = ? AND e.client_request_id = ?`,
  ).bind(userId, reqId).first<Record<string, string | number>>();

  if (!pull) {
    const poolRows = (await c.env.DB.prepare('SELECT * FROM colorings').all<ColoringRow>()).results;
    const ownedRows = (await c.env.DB.prepare(
      'SELECT coloring_code FROM player_colorings WHERE user_id = ?',
    ).bind(userId).all<{ coloring_code: string }>()).results;
    const pool = poolRows.map((row) => ({ ...row, palette: JSON.parse(row.palette) })) as Coloring[];
    const result = rollEgg(pool, new Set(ownedRows.map((r) => r.coloring_code)), DEFAULT_BALANCE);
    const announce = isAnnounceworthy(result.coloring.rarity) && !result.duplicate;
    try {
      pull = await c.env.DB.prepare(
        `INSERT INTO egg_pulls
          (user_id, coloring_code, duplicate, spend, announced, client_request_id)
         SELECT ?, ?,
                EXISTS(SELECT 1 FROM player_colorings WHERE user_id = ? AND coloring_code = ?),
                ? - CASE WHEN EXISTS(SELECT 1 FROM player_colorings WHERE user_id = ? AND coloring_code = ?)
                         THEN ? ELSE 0 END,
                ?, ?
          WHERE (SELECT wallet FROM wallets WHERE user_id = ?) >=
                (? - CASE WHEN EXISTS(SELECT 1 FROM player_colorings WHERE user_id = ? AND coloring_code = ?)
                          THEN ? ELSE 0 END)
         RETURNING *`,
      ).bind(
        userId, result.coloring.code, userId, result.coloring.code,
        DEFAULT_BALANCE.EGG_COST, userId, result.coloring.code, DEFAULT_BALANCE.EGG_DUPLICATE_REFUND,
        announce ? 0 : 1, reqId, userId,
        DEFAULT_BALANCE.EGG_COST, userId, result.coloring.code, DEFAULT_BALANCE.EGG_DUPLICATE_REFUND,
      ).first<Record<string, string | number>>();
    } catch (error) {
      pull = await c.env.DB.prepare(
        `SELECT e.*, c.title, c.rarity, c.palette FROM egg_pulls e
          JOIN colorings c ON c.code = e.coloring_code
         WHERE e.user_id = ? AND e.client_request_id = ?`,
      ).bind(userId, reqId).first<Record<string, string | number>>();
      if (!pull) throw error;
    }
    if (!pull) throw new GameError('NOT_ENOUGH_WORMS');
    const coloring = await c.env.DB.prepare('SELECT * FROM colorings WHERE code = ?')
      .bind(pull.coloring_code).first<ColoringRow>();
    if (!coloring) throw new Error('coloring missing');
    pull = { ...pull, title: coloring.title, rarity: coloring.rarity, palette: coloring.palette };
    await logEvent(c.env.DB, userId, 'egg_open', { coloring: coloring.code, duplicate: Boolean(pull.duplicate) });
  }

  const rare = (pull.rarity === 'rare' || pull.rarity === 'legendary') && !pull.duplicate;
  if (rare) c.executionCtx.waitUntil(announceRarePull(c.env, userId));
  return c.json({
    coloring: pull.coloring_code,
    coloringTitle: pull.title,
    rarity: pull.rarity,
    palette: typeof pull.palette === 'string' ? JSON.parse(pull.palette) : pull.palette,
    duplicate: Boolean(pull.duplicate),
    refund: DEFAULT_BALANCE.EGG_COST - Number(pull.spend),
    shareText: rare ? `Выбил окрас «${pull.title}»` : null,
    state: await buildState(c.env, userId),
  });
});

api.get('/api/v1/colorings', async (c) => {
  const userId = c.get('userId');
  const player = await loadPlayer(c.env.DB, userId);
  const rows = (await c.env.DB.prepare(
    `SELECT c.*, CASE WHEN pc.user_id IS NULL THEN 0 ELSE 1 END AS owned
       FROM colorings c LEFT JOIN player_colorings pc
         ON pc.coloring_code = c.code AND pc.user_id = ?
      ORDER BY CASE c.rarity WHEN 'common' THEN 0 WHEN 'rare' THEN 1 ELSE 2 END, c.weight DESC`,
  ).bind(userId).all<ColoringRow & { owned: number }>()).results;
  return c.json({ colorings: rows.map((row) => ({
    code: row.code, title: row.title, rarity: row.rarity,
    palette: JSON.parse(row.palette), owned: Boolean(row.owned), equipped: row.code === player.coloring,
  })) });
});

api.post('/api/v1/coloring/equip', async (c) => {
  const body = await json(c) as { code?: unknown };
  if (typeof body.code !== 'string') throw new GameError('VALIDATION', { field: 'code' });
  const result = await c.env.DB.prepare(
    `UPDATE profiles SET coloring = ? WHERE user_id = ?
       AND EXISTS(SELECT 1 FROM player_colorings WHERE user_id = ? AND coloring_code = ?)`,
  ).bind(body.code, c.get('userId'), c.get('userId'), body.code).run();
  if (!result.meta.changes) throw new GameError('COLORING_LOCKED');
  return c.json({ state: await buildState(c.env, c.get('userId')) });
});

api.get('/api/v1/signals', async (c) => {
  const rows = (await c.env.DB.prepare(
    'SELECT id, kind, title, issued_at FROM signal_cards WHERE user_id = ? ORDER BY issued_at DESC',
  ).bind(c.get('userId')).all<{ id: number; kind: SignalKind; title: string; issued_at: string }>()).results;
  const cards = rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, issuedAt: iso(r.issued_at) }));
  return c.json({ feathers: cards.length, cards });
});

api.get('/api/v1/nest', async (c) => {
  const userId = c.get('userId');
  const grants = (await c.env.DB.prepare(
    `SELECT g.created_at, g.from_user_id, u.username, g.amount, g.reason
       FROM worm_grants g JOIN users u ON u.id = g.from_user_id
      WHERE g.to_user_id = ? ORDER BY g.created_at DESC LIMIT 30`,
  ).bind(userId).all<Record<string, string | number | null>>()).results;
  const visits = (await c.env.DB.prepare(
    `SELECT v.created_at, v.visitor_id, u.username
       FROM nest_visits v JOIN users u ON u.id = v.visitor_id
      WHERE v.host_id = ? ORDER BY v.created_at DESC LIMIT 30`,
  ).bind(userId).all<Record<string, string | number | null>>()).results;
  const entries = [
    ...grants.map((g) => ({ kind: 'grant', at: iso(String(g.created_at)), fromUserId: Number(g.from_user_id), fromUsername: g.username, amount: Number(g.amount), reason: g.reason })),
    ...visits.map((v) => ({ kind: 'visit', at: iso(String(v.created_at)), fromUserId: Number(v.visitor_id), fromUsername: v.username })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  const weekly = await c.env.DB.prepare(
    `SELECT coalesce(sum(amount),0) AS total FROM worm_grants
      WHERE to_user_id = ? AND created_at > datetime('now', '-7 days')`,
  ).bind(userId).first<{ total: number }>();
  return c.json({ entries, weeklyReceived: Number(weekly?.total ?? 0) });
});

api.get('/api/v1/community', async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT p.user_id, u.username, p.bird_name, p.role, p.coloring, c.palette,
            coalesce((SELECT sum(g.amount) FROM worm_grants g WHERE g.to_user_id = p.user_id
              AND g.created_at > datetime('now', '-7 days')),0) AS weekly,
            w.reputation AS total,
            (SELECT count(*) FROM signal_cards s WHERE s.user_id = p.user_id) AS signals
       FROM profiles p JOIN users u ON u.id = p.user_id JOIN wallets w ON w.user_id = p.user_id
       JOIN colorings c ON c.code = p.coloring
      WHERE p.hatched_at IS NOT NULL AND u.banned_at IS NULL
      ORDER BY weekly DESC, total DESC, u.id ASC`,
  ).all<Record<string, string | number | null>>()).results;
  const userId = c.get('userId');
  const ranking = rows.map((r, i) => ({
    position: i + 1, userId: Number(r.user_id), username: r.username, birdName: r.bird_name,
    role: r.role, roleTitle: r.role ? ROLES[r.role as Role].title : null,
    coloring: r.coloring, palette: JSON.parse(String(r.palette)), weekly: Number(r.weekly),
    total: Number(r.total), signals: Number(r.signals), isMe: Number(r.user_id) === userId,
  }));
  const myIndex = ranking.findIndex((r) => r.isMe);
  const visible = ranking.slice(0, DEFAULT_BALANCE.RANK_SIZE);
  if (myIndex >= DEFAULT_BALANCE.RANK_SIZE) visible.push(ranking[myIndex]!);
  return c.json({ ranking: visible, myPosition: myIndex + 1, totalInFlock: ranking.length, windowDays: 7 });
});

api.post('/api/v1/visit/:id', async (c) => {
  const hostId = Number(c.req.param('id'));
  const userId = c.get('userId');
  if (!Number.isFinite(hostId) || hostId === userId) throw new GameError('VALIDATION');
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO nest_visits (visitor_id, host_id, game_day)
     SELECT ?, u.id, ? FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ? AND u.banned_at IS NULL AND p.hatched_at IS NOT NULL`,
  ).bind(userId, currentGameDay(c.env), hostId).run();
  if (!result.meta.changes) {
    const host = await c.env.DB.prepare(
      'SELECT 1 FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.id=? AND p.hatched_at IS NOT NULL AND u.banned_at IS NULL',
    ).bind(hostId).first();
    if (!host) throw new GameError('PLAYER_NOT_FOUND');
  }
  return c.json({ ok: true });
});

api.post('/api/v1/dev/receive', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await json(c) as { fromUserId?: number; amount?: number; reason?: string };
  const userId = c.get('userId');
  const day = currentGameDay(c.env);
  try {
    const result = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO worm_grants
       (from_user_id,to_user_id,amount,reason,game_day,daily_budget)
       VALUES (?,?,?,?,?,?)`,
    ).bind(body.fromUserId, userId, body.amount ?? 1, body.reason ?? null, day, 1000).run();
    return c.json({ ok: true, created: Boolean(result.meta.changes) });
  } catch (error) { sqliteError(error); }
});

api.post('/api/v1/dev/grant-worms', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await json(c) as { amount?: number };
  await c.env.DB.prepare('UPDATE wallets SET wallet = wallet + ? WHERE user_id = ?')
    .bind(Math.max(0, Number(body.amount ?? 0)), c.get('userId')).run();
  return c.json({ ok: true });
});

api.post('/api/v1/dev/grant-signal', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await json(c) as { kind?: SignalKind; title?: string; referenceCode?: string };
  if (!body.kind || !['cu_event', 'agency_case', 'own_project'].includes(body.kind) || !body.title || !body.referenceCode) {
    throw new GameError('VALIDATION');
  }
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO signal_cards (user_id,kind,title,reference_code) VALUES (?,?,?,?)`,
  ).bind(c.get('userId'), body.kind, body.title, body.referenceCode).run();
  return c.json({ ok: true, created: Boolean(result.meta.changes) });
});

api.post('/api/v1/admin/signal', async (c) => {
  if (!c.env.ADMIN_SECRET || c.req.header('X-Kontur-Admin') !== c.env.ADMIN_SECRET) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Доступ закрыт' } }, 403);
  }
  const body = await json(c) as { tgId?: number; kind?: SignalKind; title?: string; referenceCode?: string; dryRun?: boolean };
  if (!Number.isSafeInteger(body.tgId) || Number(body.tgId) <= 0 ||
      !body.kind || !['cu_event', 'agency_case', 'own_project'].includes(body.kind) ||
      !body.title || body.title.length > 160 ||
      !body.referenceCode || body.referenceCode.length > 160) {
    throw new GameError('VALIDATION');
  }
  const target = await c.env.DB.prepare('SELECT id, username FROM users WHERE tg_id = ?')
    .bind(body.tgId).first<{ id: number; username: string | null }>();
  if (!target) throw new GameError('PLAYER_NOT_FOUND');
  const existing = await c.env.DB.prepare('SELECT id FROM signal_cards WHERE reference_code = ?')
    .bind(body.referenceCode).first<{ id: number }>();
  if (body.dryRun) {
    return c.json({
      ok: true,
      dryRun: true,
      wouldCreate: !existing,
      target: { tgId: body.tgId, username: target.username },
    });
  }
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO signal_cards (user_id,kind,title,reference_code) VALUES (?,?,?,?)`,
  ).bind(target.id, body.kind, body.title, body.referenceCode).run();
  return c.json({ ok: true, created: Boolean(result.meta.changes) });
});

export async function grantLocalWorm(
  env: Env,
  fromUserId: number,
  toUserId: number,
  reason: string | null,
  chatMessageId: number | null,
) {
  if (fromUserId === toUserId) return { ok: false, rejection: 'self', value: 0, leftToday: 0 } as const;
  const day = currentGameDay(env, new Date());
  const dailyBudget = 3;
  const pairWeekLimit = 2;
  const [today, pairToday, pairWeek] = await Promise.all([
    env.DB.prepare('SELECT count(*) AS n FROM worm_grants WHERE from_user_id=? AND game_day=?')
      .bind(fromUserId, day).first<{ n: number }>(),
    env.DB.prepare('SELECT count(*) AS n FROM worm_grants WHERE from_user_id=? AND to_user_id=? AND game_day=?')
      .bind(fromUserId, toUserId, day).first<{ n: number }>(),
    env.DB.prepare(`SELECT count(*) AS n FROM worm_grants
      WHERE from_user_id=? AND to_user_id=? AND created_at > datetime('now','-7 days')`)
      .bind(fromUserId, toUserId).first<{ n: number }>(),
  ]);
  const givenToday = Number(today?.n ?? 0);
  const leftBefore = Math.max(0, dailyBudget - givenToday);
  if (Number(pairToday?.n ?? 0) > 0) {
    return { ok: false, rejection: 'same_person_today', value: 0, leftToday: leftBefore } as const;
  }
  if (leftBefore <= 0) {
    return { ok: false, rejection: 'daily_limit', value: 0, leftToday: 0 } as const;
  }
  if (Number(pairWeek?.n ?? 0) >= pairWeekLimit) {
    return { ok: false, rejection: 'exhausted', value: 0, leftToday: leftBefore } as const;
  }
  try {
    await env.DB.prepare(
      `INSERT INTO worm_grants
       (from_user_id,to_user_id,amount,reason,chat_message_id,game_day,daily_budget)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(fromUserId, toUserId, 1, reason, chatMessageId, day, dailyBudget).run();
    return { ok: true, value: 1, leftToday: leftBefore - 1 } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('DAILY_LIMIT')) return { ok: false, value: 0, rejection: 'daily_limit', leftToday: 0 } as const;
    if (message.includes('UNIQUE constraint failed')) {
      return { ok: false, value: 0, rejection: 'same_person_today', leftToday: leftBefore } as const;
    }
    throw error;
  }
}

export async function grantWorm(
  env: Env,
  fromUserId: number,
  toUserId: number,
  reason: string | null,
  chatMessageId: number | null,
) {
  if (fromUserId === toUserId) return { ok: false, rejection: 'self', value: 0, leftToday: 0 } as const;
  const now = new Date();
  const day = currentGameDay(env, now);
  const doubleDay = isDoubleDay(now, DEFAULT_BALANCE.GAME_DAY_START_UTC);
  const [today, pairToday, prior] = await Promise.all([
    env.DB.prepare('SELECT count(*) AS n FROM worm_grants WHERE from_user_id=? AND game_day=?').bind(fromUserId, day).first<{ n: number }>(),
    env.DB.prepare('SELECT count(*) AS n FROM worm_grants WHERE from_user_id=? AND to_user_id=? AND game_day=?').bind(fromUserId, toUserId, day).first<{ n: number }>(),
    env.DB.prepare(`SELECT count(*) AS n FROM worm_grants WHERE from_user_id=? AND to_user_id=? AND created_at > datetime('now','-7 days')`).bind(fromUserId, toUserId).first<{ n: number }>(),
  ]);
  const decision = decideGrant({
    givenToday: Number(today?.n ?? 0), gaveToThisPersonToday: Number(pairToday?.n ?? 0) > 0,
    priorGrantsToPerson: Number(prior?.n ?? 0), withReason: Boolean(reason), isDoubleDay: doubleDay,
  }, DEFAULT_BALANCE);
  if (!decision.ok) return decision;
  try {
    await env.DB.prepare(
      `INSERT INTO worm_grants
       (from_user_id,to_user_id,amount,reason,chat_message_id,game_day,daily_budget)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(fromUserId, toUserId, decision.value, reason, chatMessageId, day,
      doubleDay ? DEFAULT_BALANCE.WORM_GIVE_PER_DAY * DEFAULT_BALANCE.WORM_DOUBLE_DAY_FACTOR : DEFAULT_BALANCE.WORM_GIVE_PER_DAY).run();
    return decision;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('DAILY_LIMIT')) return { ok: false, value: 0, rejection: 'daily_limit', leftToday: 0 } as const;
    if (message.includes('UNIQUE constraint failed')) return { ok: false, value: 0, rejection: 'same_person_today', leftToday: decision.leftToday + 1 } as const;
    throw error;
  }
}

export async function announceRarePull(env: Env, userId: number): Promise<void> {
  if (!env.MAIN_CHAT_ID) return;
  const pull = await env.DB.prepare(
    `SELECT e.id, c.title, u.username FROM egg_pulls e
      JOIN colorings c ON c.code=e.coloring_code JOIN users u ON u.id=e.user_id
     WHERE e.user_id=? AND e.announced=0 ORDER BY e.id DESC LIMIT 1`,
  ).bind(userId).first<{ id: number; title: string; username: string | null }>();
  if (!pull) return;
  const ok = await sendMessage(env, env.MAIN_CHAT_ID, `Редкий окрас «${pull.title}» выпал у @${pull.username ?? 'участника'}.`);
  if (ok) await env.DB.prepare('UPDATE egg_pulls SET announced=1 WHERE id=?').bind(pull.id).run();
}

api.route('/', journeyApi);
api.route('/', restoredApi);
api.route('/', localKonturApi);
api.route('/', zeroSeasonApi);
api.route('/', liveCampaignApi);
