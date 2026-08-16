import { Hono } from 'hono';
import {
  ROLES,
  ZERO_SEASON_BIRDS,
  ZERO_SEASON_INTENTS,
  selectZeroSeasonVote,
  resolveZeroSeasonAction,
  zeroSeasonQuestionSeries,
  zeroSeasonDifficulty,
  zeroSeasonRank,
  zeroSeasonSchedule,
  zeroSeasonEffect,
  type Role,
  type ZeroSeasonBird,
  type ZeroSeasonBoard,
  type ZeroSeasonIntent,
} from '@kontur/core';
import { currentGameDay } from './db.js';
import { GameError } from './errors.js';
import { zeroSeasonAllowed, zeroSeasonGloballyEnabled } from './experience-access.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const zeroSeasonApi = new Hono<AppEnv>();

type Scores = Record<ZeroSeasonBird, number>;
interface ProfileRow { user_id: number; bird: ZeroSeasonBird; scores_json: string; joined_at: string }
interface VoteRow { bird: ZeroSeasonBird; intent: ZeroSeasonIntent; effect: ReturnType<typeof zeroSeasonEffect>; nest: number }
interface BranchRow { nests_json: string; shields_json: string; marks_json: string; season_number: number }
interface ClosureRow { result_json: string }
interface ForecastRow { user_id: number; bird: ZeroSeasonBird; status: 'pending' | 'won' | 'lost' | 'void' }
interface SeriesStartRow { intent: ZeroSeasonIntent; nest: number; started_at: string }
interface PathRow { bird: ZeroSeasonBird; mastery: number }
interface ActiveBirdRow { bird: ZeroSeasonBird; client_request_id: string }
type FlightStatus = 'open' | 'ready';
interface FlightRow { id: number; intent: ZeroSeasonIntent; nest: number; status: FlightStatus; members: number }
interface FlightChoiceRow { status: 'active' | 'left' }
interface ClosureResult {
  gameDay: number;
  board: ZeroSeasonBoard;
  actions: Partial<Record<ZeroSeasonBird, { intent: ZeroSeasonIntent; nest: number; votes: number }>>;
}
type LastClosedRound = Pick<ClosureResult, 'gameDay' | 'actions'>;

const birds = new Set<string>(ZERO_SEASON_BIRDS);
const intents = new Set<string>(ZERO_SEASON_INTENTS);
const classicRoles = new Set<string>(Object.keys(ROLES));

/** Classic V1 core snapshot surfaced on the V4 home screen. */
export interface ClassicCoreSnapshot {
  hatched: boolean;
  wallet: number;
  reputation: number;
  coloringTitle: string | null;
  birdName: string | null;
  roleTitle: string | null;
}

const EMPTY_CORE: ClassicCoreSnapshot = {
  hatched: false,
  wallet: 0,
  reputation: 0,
  coloringTitle: null,
  birdName: null,
  roleTitle: null,
};

interface ClassicCoreRow {
  role: string | null;
  hatched_at: string | null;
  bird_name: string | null;
  wallet: number | null;
  reputation: number | null;
  coloring_title: string | null;
}

/** Maps wallets+profiles(+colorings) into the optional V4 `core` payload. */
export function mapClassicCore(row: ClassicCoreRow | null | undefined): ClassicCoreSnapshot {
  if (!row) return { ...EMPTY_CORE };
  const role = row.role && classicRoles.has(row.role) ? (row.role as Role) : null;
  const hatched = Boolean(role && row.hatched_at);
  return {
    hatched,
    wallet: Number(row.wallet ?? 0),
    reputation: Number(row.reputation ?? 0),
    coloringTitle: row.coloring_title,
    birdName: row.bird_name,
    roleTitle: role ? ROLES[role].title : null,
  };
}

async function classicCore(env: Env, userId: number): Promise<ClassicCoreSnapshot> {
  const row = await env.DB.prepare(
    `SELECT p.role, p.hatched_at, p.bird_name, w.wallet, w.reputation, c.title AS coloring_title
       FROM profiles p
       JOIN wallets w ON w.user_id = p.user_id
       LEFT JOIN colorings c ON c.code = p.coloring
      WHERE p.user_id = ?`,
  ).bind(userId).first<ClassicCoreRow>();
  return mapClassicCore(row);
}

async function json(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const value = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value as Record<string, unknown>;
  } catch { throw new GameError('VALIDATION'); }
}

function requestId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new GameError('VALIDATION', { field: 'clientRequestId' });
  }
  return value;
}

function scores(value: unknown): Scores {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GameError('VALIDATION', { field: 'scores' });
  const source = value as Record<string, unknown>;
  const output = {} as Scores;
  for (const bird of ZERO_SEASON_BIRDS) {
    const score = source[bird];
    if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 10) {
      throw new GameError('VALIDATION', { field: `scores.${bird}` });
    }
    output[bird] = score as number;
  }
  return output;
}

async function profile(env: Env, userId: number): Promise<ProfileRow | null> {
  return env.DB.prepare(
    'SELECT user_id, bird, scores_json, joined_at FROM zero_season_profiles WHERE user_id = ?',
  ).bind(userId).first<ProfileRow>();
}

async function eggs(env: Env, userId: number): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT eggs FROM zero_season_egg_wallets WHERE user_id = ?',
  ).bind(userId).first<{ eggs: number }>();
  return Number(row?.eggs ?? 0);
}

async function paths(env: Env, userId: number): Promise<Array<{ bird: ZeroSeasonBird; mastery: number; rank: ReturnType<typeof zeroSeasonRank> }>> {
  const rows = (await env.DB.prepare(
    'SELECT bird, mastery FROM zero_season_path_progress WHERE user_id = ? ORDER BY mastery DESC, bird ASC',
  ).bind(userId).all<PathRow>()).results;
  return rows.map((row) => ({ bird: row.bird, mastery: row.mastery, rank: zeroSeasonRank(row.mastery) }));
}

async function activeBird(env: Env, userId: number, gameDay: number, initialBird: ZeroSeasonBird): Promise<ZeroSeasonBird | null> {
  const seasonNumber = zeroSeasonSchedule(gameDay).number;
  const row = await env.DB.prepare(
    'SELECT bird, client_request_id FROM zero_season_active_birds WHERE user_id = ? AND season_number = ?',
  ).bind(userId, seasonNumber).first<ActiveBirdRow>();
  if (row) return row.bird;
  return seasonNumber === 0 ? initialBird : null;
}

async function mastery(env: Env, userId: number, bird: ZeroSeasonBird): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT mastery FROM zero_season_path_progress WHERE user_id = ? AND bird = ?',
  ).bind(userId, bird).first<{ mastery: number }>();
  return Number(row?.mastery ?? 0);
}

function flightDto(row: FlightRow): FlightRow {
  return { ...row, id: Number(row.id), nest: Number(row.nest), members: Number(row.members) };
}

/** Полёт скрывает состав команды: игрок видит только общую цель и размер группы. */
async function playerFlight(env: Env, userId: number, gameDay: number): Promise<FlightRow | null> {
  const row = await env.DB.prepare(
    `SELECT f.id, f.intent, f.nest, f.status, COUNT(m.user_id) AS members
       FROM zero_season_flights f
       JOIN zero_season_flight_members mine ON mine.flight_id = f.id AND mine.status = 'active'
       LEFT JOIN zero_season_flight_members m ON m.flight_id = f.id AND m.status = 'active'
      WHERE mine.user_id = ? AND mine.game_day = ? AND f.game_day = ?
      GROUP BY f.id, f.intent, f.nest, f.status`,
  ).bind(userId, gameDay, gameDay).first<FlightRow>();
  return row ? flightDto(row) : null;
}

async function joinFlight(
  env: Env,
  userId: number,
  gameDay: number,
  intent: ZeroSeasonIntent,
  nest: number,
  clientRequestId: string,
): Promise<FlightRow> {
  const current = await playerFlight(env, userId, gameDay);
  if (current) return current;
  const priorChoice = await env.DB.prepare(
    'SELECT status FROM zero_season_flight_members WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first<FlightChoiceRow>();
  if (priorChoice?.status === 'left') throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_flight_choice_locked' });

  const candidate = await env.DB.prepare(
    `SELECT f.id, f.intent, f.nest, f.status, COUNT(m.user_id) AS members
       FROM zero_season_flights f
       LEFT JOIN zero_season_flight_members m ON m.flight_id = f.id AND m.status = 'active'
      WHERE f.game_day = ? AND f.intent = ? AND f.nest = ? AND f.status IN ('open', 'ready')
      GROUP BY f.id, f.intent, f.nest, f.status
     HAVING COUNT(m.user_id) BETWEEN 1 AND 5
      ORDER BY CASE f.status WHEN 'ready' THEN 0 ELSE 1 END, f.id ASC
      LIMIT 1`,
  ).bind(gameDay, intent, nest).first<FlightRow>();

  if (candidate) {
    const flight = flightDto(candidate);
    // Вместимость проверяется в самом INSERT: параллельные клики не могут переполнить полёт.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO zero_season_flight_members
           (flight_id, user_id, game_day, status, client_request_id)
         SELECT ?, ?, ?, 'active', ?
          WHERE NOT EXISTS (
            SELECT 1 FROM zero_season_flight_members WHERE user_id = ? AND game_day = ?
          ) AND (
            SELECT COUNT(*) FROM zero_season_flight_members WHERE flight_id = ? AND status = 'active'
          ) < 6`,
      ).bind(flight.id, userId, gameDay, clientRequestId, userId, gameDay, flight.id),
      env.DB.prepare(
        `UPDATE zero_season_flights
            SET status = CASE WHEN (
              SELECT COUNT(*) FROM zero_season_flight_members
               WHERE flight_id = ? AND status = 'active'
            ) >= 4 THEN 'ready' ELSE 'open' END
          WHERE id = ?`,
      ).bind(flight.id, flight.id),
    ]);
    const joined = await playerFlight(env, userId, gameDay);
    if (joined) return joined;
  }

  const created = await env.DB.prepare(
    'INSERT INTO zero_season_flights (game_day, intent, nest) VALUES (?, ?, ?)',
  ).bind(gameDay, intent, nest).run();
  const flightId = Number(created.meta.last_row_id);
  if (!Number.isInteger(flightId) || flightId < 1) throw new Error('zero season flight missing');
  await env.DB.prepare(
    `INSERT OR IGNORE INTO zero_season_flight_members
       (flight_id, user_id, game_day, status, client_request_id)
     VALUES (?, ?, ?, 'active', ?)`,
  ).bind(flightId, userId, gameDay, clientRequestId).run();
  const joined = await playerFlight(env, userId, gameDay);
  if (!joined) {
    const choice = await env.DB.prepare(
      'SELECT status FROM zero_season_flight_members WHERE user_id = ? AND game_day = ?',
    ).bind(userId, gameDay).first<FlightChoiceRow>();
    if (choice?.status === 'left') throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_flight_choice_locked' });
    throw new Error('zero season flight join missing');
  }
  return joined;
}

async function leaveFlight(env: Env, userId: number, gameDay: number): Promise<void> {
  const current = await playerFlight(env, userId, gameDay);
  if (!current) return;
  if (current.status === 'ready') throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_flight_ready_locked' });
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE zero_season_flight_members
          SET status = 'left', left_at = datetime('now')
        WHERE flight_id = ? AND user_id = ? AND game_day = ? AND status = 'active'`,
    ).bind(current.id, userId, gameDay),
    env.DB.prepare(
      `UPDATE zero_season_flights
          SET status = CASE WHEN (
            SELECT COUNT(*) FROM zero_season_flight_members
             WHERE flight_id = ? AND status = 'active'
          ) >= 4 THEN 'ready' ELSE 'open' END
        WHERE id = ?`,
    ).bind(current.id, current.id),
  ]);
}

async function leadingVotes(env: Env, gameDay: number): Promise<Record<ZeroSeasonBird, { intent: ZeroSeasonIntent; nest: number; votes: number } | null>> {
  const rows = (await env.DB.prepare(
    `SELECT a.bird, s.intent, s.effect, s.nest
       FROM zero_season_series s JOIN zero_season_active_birds a ON a.user_id = s.user_id
      WHERE s.game_day = ? AND a.season_number = ? AND s.effect != 'none'`,
  ).bind(gameDay, zeroSeasonSchedule(gameDay).number).all<VoteRow>()).results;
  const result = {} as Record<ZeroSeasonBird, { intent: ZeroSeasonIntent; nest: number; votes: number } | null>;
  for (const bird of ZERO_SEASON_BIRDS) {
    const own = rows.filter((row) => row.bird === bird).map((row) => ({
      bird, intent: row.effect as ZeroSeasonIntent, nest: row.nest,
    }));
    const selected = selectZeroSeasonVote(own, bird);
    result[bird] = selected
      ? { ...selected, votes: own.filter((vote) => vote.intent === selected.intent && vote.nest === selected.nest).length }
      : null;
  }
  return result;
}

function emptyBoard(): ZeroSeasonBoard {
  return { nests: Array(7).fill(null), shields: [], marks: [] };
}

async function branchBoard(env: Env, gameDay: number): Promise<ZeroSeasonBoard> {
  const row = await env.DB.prepare(
    'SELECT nests_json, shields_json, marks_json, season_number FROM zero_season_branch_state WHERE singleton = 1',
  ).first<BranchRow>();
  if (!row || row.season_number !== zeroSeasonSchedule(gameDay).number) return emptyBoard();
  const nests = JSON.parse(row.nests_json) as ZeroSeasonBoard['nests'];
  const shields = JSON.parse(row.shields_json) as number[];
  const marks = JSON.parse(row.marks_json) as number[];
  if (!Array.isArray(nests) || nests.length !== 7 || !Array.isArray(shields) || !Array.isArray(marks)) {
    throw new Error('zero season board shape');
  }
  return { nests, shields, marks };
}

/** Только уже записанный итог; незакрытые голоса никогда не попадают в состояние игрока. */
async function lastClosedRound(env: Env, gameDay: number): Promise<LastClosedRound | null> {
  const season = zeroSeasonSchedule(gameDay);
  const seasonStartDay = gameDay - season.day + 1;
  const row = await env.DB.prepare(
    `SELECT result_json FROM zero_season_closures
      WHERE game_day BETWEEN ? AND ?
      ORDER BY game_day DESC LIMIT 1`,
  ).bind(seasonStartDay, gameDay).first<ClosureRow>();
  if (!row) return null;
  const result = JSON.parse(row.result_json) as ClosureResult;
  return { gameDay: result.gameDay, actions: result.actions };
}

function birdOrder(gameDay: number): ZeroSeasonBird[] {
  const offset = ((gameDay % ZERO_SEASON_BIRDS.length) + ZERO_SEASON_BIRDS.length) % ZERO_SEASON_BIRDS.length;
  return [...ZERO_SEASON_BIRDS.slice(offset), ...ZERO_SEASON_BIRDS.slice(0, offset)];
}

/** Закрывает уже завершившийся игровой день. Повтор безопасно возвращает итог. */
export async function closeZeroSeasonDay(env: Env, gameDay: number): Promise<ClosureResult | null> {
  if (!zeroSeasonGloballyEnabled(env)) return null;
  const prior = await env.DB.prepare(
    'SELECT result_json FROM zero_season_closures WHERE game_day = ?',
  ).bind(gameDay).first<ClosureRow>();
  if (prior) {
    const result = JSON.parse(prior.result_json) as ClosureResult;
    await resolveForecasts(env, gameDay, result.board);
    return result;
  }
  const leading = await leadingVotes(env, gameDay);
  if (!Object.values(leading).some(Boolean)) return null;
  let board = await branchBoard(env, gameDay);
  // Эффекты прошлого дня не копятся. Новые выставляются действиями текущего.
  board = { ...board, shields: [], marks: [] };
  const actions: ClosureResult['actions'] = {};
  for (const bird of birdOrder(gameDay)) {
    const action = leading[bird];
    if (!action) continue;
    actions[bird] = action;
    board = resolveZeroSeasonAction(board, bird, action.intent, action.nest).board;
  }
  const result: ClosureResult = { gameDay, board, actions };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO zero_season_closures (game_day, result_json) VALUES (?, ?)`,
    ).bind(gameDay, JSON.stringify(result)),
    env.DB.prepare(
      `INSERT INTO zero_season_branch_state (singleton, nests_json, shields_json, marks_json, updated_game_day, season_number)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(singleton) DO UPDATE SET nests_json=excluded.nests_json,
         shields_json=excluded.shields_json, marks_json=excluded.marks_json,
         updated_game_day=excluded.updated_game_day, season_number=excluded.season_number`,
    ).bind(JSON.stringify(board.nests), JSON.stringify(board.shields), JSON.stringify(board.marks), gameDay, zeroSeasonSchedule(gameDay).number),
  ]);
  const stored = await env.DB.prepare(
    'SELECT result_json FROM zero_season_closures WHERE game_day = ?',
  ).bind(gameDay).first<ClosureRow>();
  if (!stored) throw new Error('zero season closure missing');
  const persisted = JSON.parse(stored.result_json) as ClosureResult;
  await resolveForecasts(env, gameDay, persisted.board);
  return persisted;
}

async function resolveForecasts(env: Env, gameDay: number, board: ZeroSeasonBoard): Promise<void> {
  const pending = (await env.DB.prepare(
    `SELECT user_id, bird, status FROM zero_season_forecasts WHERE game_day = ? AND status = 'pending'`,
  ).bind(gameDay).all<ForecastRow>()).results;
  if (!pending.length) return;
  const counts = new Map<ZeroSeasonBird, number>(ZERO_SEASON_BIRDS.map((bird) => [bird, 0]));
  for (const bird of board.nests) if (bird) counts.set(bird, (counts.get(bird) ?? 0) + 1);
  const maximum = Math.max(...ZERO_SEASON_BIRDS.map((bird) => counts.get(bird) ?? 0));
  const leaders = ZERO_SEASON_BIRDS.filter((bird) => (counts.get(bird) ?? 0) === maximum);
  const statements: D1PreparedStatement[] = [];
  for (const forecast of pending) {
    const status = leaders.length !== 1 ? 'void' : forecast.bird === leaders[0] ? 'won' : 'lost';
    statements.push(env.DB.prepare(
      `UPDATE zero_season_forecasts SET status = ?
        WHERE user_id = ? AND game_day = ? AND status = 'pending'`,
    ).bind(status, forecast.user_id, gameDay));
    if (status === 'won' || status === 'void') {
      const reward = status === 'won' ? 2 : 1;
      statements.push(env.DB.prepare(
        `INSERT INTO zero_season_egg_wallets (user_id, eggs, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET eggs=eggs+excluded.eggs, updated_at=datetime('now')`,
      ).bind(forecast.user_id, reward));
    }
  }
  await env.DB.batch(statements);
}

zeroSeasonApi.use('/api/v4/*', async (c, next) => {
  if (!zeroSeasonAllowed(c.env)) throw new GameError('EXPERIENCE_DISABLED');
  await next();
});

zeroSeasonApi.get('/api/v4/state', async (c) => {
  const gameDay = currentGameDay(c.env);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  const currentBird = saved ? await activeBird(c.env, userId, gameDay, saved.bird) : null;
  const actionTaken = Boolean(await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first());
  return c.json({
    serverTime: new Date().toISOString(),
    gameDay,
    profile: saved ? { bird: saved.bird, scores: JSON.parse(saved.scores_json) as Scores, joinedAt: `${saved.joined_at}Z` } : null,
    activeBird: currentBird,
    paths: await paths(c.env, userId),
    season: zeroSeasonSchedule(gameDay),
    board: await branchBoard(c.env, gameDay),
    eggs: await eggs(c.env, userId),
    actionTaken,
    flight: await playerFlight(c.env, userId, gameDay),
    lastRound: await lastClosedRound(c.env, gameDay),
    forecast: await c.env.DB.prepare(
      'SELECT bird, status FROM zero_season_forecasts WHERE user_id = ? AND game_day = ?',
    ).bind(userId, gameDay).first<{ bird: ZeroSeasonBird; status: ForecastRow['status'] }>(),
    core: await classicCore(c.env, userId),
  });
});

zeroSeasonApi.post('/api/v4/dev/close', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await json(c);
  const gameDay = body.gameDay === undefined ? currentGameDay(c.env) : body.gameDay;
  if (!Number.isInteger(gameDay)) throw new GameError('VALIDATION', { field: 'gameDay' });
  return c.json({ closure: await closeZeroSeasonDay(c.env, gameDay as number) });
});

zeroSeasonApi.post('/api/v4/dev/eggs', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await json(c);
  if (!Number.isInteger(body.amount) || (body.amount as number) < 1 || (body.amount as number) > 10) {
    throw new GameError('VALIDATION', { field: 'amount' });
  }
  await c.env.DB.prepare(
    `INSERT INTO zero_season_egg_wallets (user_id, eggs, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET eggs=eggs+excluded.eggs, updated_at=datetime('now')`,
  ).bind(c.get('userId'), body.amount).run();
  return c.json({ eggs: await eggs(c.env, c.get('userId')) });
});

zeroSeasonApi.post('/api/v4/profile', async (c) => {
  const body = await json(c);
  if (typeof body.bird !== 'string' || !birds.has(body.bird)) throw new GameError('VALIDATION', { field: 'bird' });
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const existing = await profile(c.env, userId);
  if (existing) {
    const replay = await c.env.DB.prepare(
      'SELECT 1 FROM zero_season_profiles WHERE user_id = ? AND client_request_id = ?',
    ).bind(userId, clientRequestId).first();
    if (!replay) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_locked' });
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO zero_season_path_progress (user_id, bird) VALUES (?, ?)',
    ).bind(userId, existing.bird).run();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO zero_season_active_birds (user_id, season_number, bird, client_request_id)
       VALUES (?, ?, ?, ?)`,
    ).bind(userId, zeroSeasonSchedule(currentGameDay(c.env)).number, existing.bird, clientRequestId).run();
    return c.json({ profile: { bird: existing.bird, scores: JSON.parse(existing.scores_json) as Scores, joinedAt: `${existing.joined_at}Z` } });
  }
  const value = scores(body.scores);
  await c.env.DB.prepare(
    `INSERT INTO zero_season_profiles (user_id, bird, scores_json, client_request_id)
     VALUES (?, ?, ?, ?)`,
  ).bind(userId, body.bird, JSON.stringify(value), clientRequestId).run();
  const saved = await profile(c.env, userId);
  if (!saved) throw new Error('zero season profile missing');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT OR IGNORE INTO zero_season_path_progress (user_id, bird) VALUES (?, ?)',
    ).bind(userId, saved.bird),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO zero_season_active_birds (user_id, season_number, bird, client_request_id)
       VALUES (?, ?, ?, ?)`,
    ).bind(userId, zeroSeasonSchedule(currentGameDay(c.env)).number, saved.bird, clientRequestId),
  ]);
  return c.json({ profile: { bird: saved.bird, scores: value, joinedAt: `${saved.joined_at}Z` } });
});

zeroSeasonApi.post('/api/v4/season/bird', async (c) => {
  const body = await json(c);
  if (typeof body.bird !== 'string' || !birds.has(body.bird)) throw new GameError('VALIDATION', { field: 'bird' });
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  const seasonNumber = zeroSeasonSchedule(gameDay).number;
  const existing = await c.env.DB.prepare(
    'SELECT bird, client_request_id FROM zero_season_active_birds WHERE user_id = ? AND season_number = ?',
  ).bind(userId, seasonNumber).first<ActiveBirdRow>();
  if (existing) {
    if (existing.client_request_id !== clientRequestId) throw new GameError('INVALID_TRANSITION', { reason: 'season_active_bird_locked' });
    return c.json({ activeBird: existing.bird });
  }
  const chosen = body.bird as ZeroSeasonBird;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO zero_season_active_birds (user_id, season_number, bird, client_request_id)
       VALUES (?, ?, ?, ?)`,
    ).bind(userId, seasonNumber, chosen, clientRequestId),
    c.env.DB.prepare(
      'INSERT OR IGNORE INTO zero_season_path_progress (user_id, bird) VALUES (?, ?)',
    ).bind(userId, chosen),
  ]);
  return c.json({ activeBird: chosen });
});

zeroSeasonApi.post('/api/v4/flight/join', async (c) => {
  const body = await json(c);
  if (typeof body.intent !== 'string' || !intents.has(body.intent)) throw new GameError('VALIDATION', { field: 'intent' });
  if (!Number.isInteger(body.nest) || (body.nest as number) < 0 || (body.nest as number) > 6) throw new GameError('VALIDATION', { field: 'nest' });
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  if (!await activeBird(c.env, userId, gameDay, saved.bird)) {
    throw new GameError('INVALID_TRANSITION', { reason: 'season_active_bird_required' });
  }
  const moved = await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first();
  const started = await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series_starts WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first();
  if (moved || started) throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_flight_before_move' });
  const flight = await joinFlight(c.env, userId, gameDay, body.intent as ZeroSeasonIntent, body.nest as number, clientRequestId);
  return c.json({ gameDay, flight });
});

zeroSeasonApi.post('/api/v4/flight/leave', async (c) => {
  const body = await json(c);
  requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  await leaveFlight(c.env, userId, gameDay);
  return c.json({ gameDay, flight: null });
});

zeroSeasonApi.post('/api/v4/series/start', async (c) => {
  const body = await json(c);
  if (typeof body.intent !== 'string' || !intents.has(body.intent)) throw new GameError('VALIDATION', { field: 'intent' });
  if (!Number.isInteger(body.nest) || (body.nest as number) < 0 || (body.nest as number) > 6) throw new GameError('VALIDATION', { field: 'nest' });
  requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  const currentBird = await activeBird(c.env, userId, gameDay, saved.bird);
  if (!currentBird) throw new GameError('INVALID_TRANSITION', { reason: 'season_active_bird_required' });
  const existing = await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first();
  if (existing) throw new GameError('RATE_LIMITED', { reason: 'zero_season_daily_move' });
  const flight = await playerFlight(c.env, userId, gameDay);
  if (flight?.status === 'open') throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_flight_waiting' });
  const intent = flight?.intent ?? body.intent as ZeroSeasonIntent;
  const nest = flight?.nest ?? body.nest as number;
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO zero_season_series_starts (user_id, game_day, intent, nest)
     VALUES (?, ?, ?, ?)`,
  ).bind(userId, gameDay, intent, nest).run();
  const start = await c.env.DB.prepare(
    'SELECT intent, nest, started_at FROM zero_season_series_starts WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first<SeriesStartRow>();
  if (!start) throw new Error('zero season start missing');
  const currentMastery = await mastery(c.env, userId, currentBird);
  const questions = zeroSeasonQuestionSeries(gameDay, userId, currentBird, currentMastery).map(({ id, prompt, options }) => ({ id, prompt, options }));
  return c.json({ gameDay, seconds: 75, difficulty: zeroSeasonDifficulty(currentMastery), startedAt: `${start.started_at}Z`, intent: start.intent, nest: start.nest, flight, questions });
});

zeroSeasonApi.post('/api/v4/series', async (c) => {
  const body = await json(c);
  if (!Array.isArray(body.answers) || body.answers.length !== 5 || !body.answers.every((answer) => Number.isInteger(answer) && answer >= -1 && answer <= 3)) {
    throw new GameError('VALIDATION', { field: 'answers' });
  }
  const answers = body.answers as number[];
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  const currentBird = await activeBird(c.env, userId, gameDay, saved.bird);
  if (!currentBird) throw new GameError('INVALID_TRANSITION', { reason: 'season_active_bird_required' });
  const existing = await c.env.DB.prepare(
    `SELECT intent, nest, correct, effect FROM zero_season_series
      WHERE user_id = ? AND game_day = ?`,
  ).bind(userId, gameDay).first<{ intent: ZeroSeasonIntent; nest: number; correct: number; effect: ReturnType<typeof zeroSeasonEffect> }>();
  if (existing) {
    const replay = await c.env.DB.prepare(
      `SELECT 1 FROM zero_season_series WHERE user_id = ? AND game_day = ? AND client_request_id = ?`,
    ).bind(userId, gameDay, clientRequestId).first();
    if (!replay) throw new GameError('RATE_LIMITED', { reason: 'zero_season_daily_move' });
    return c.json({ gameDay, ...existing });
  }
  const start = await c.env.DB.prepare(
    'SELECT intent, nest, started_at FROM zero_season_series_starts WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first<SeriesStartRow>();
  if (!start) throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_series_not_started' });
  const timedOut = Date.now() > Date.parse(`${start.started_at}Z`) + 75_000;
  const intent = start.intent;
  const questions = zeroSeasonQuestionSeries(gameDay, userId, currentBird, await mastery(c.env, userId, currentBird));
  const correct = timedOut ? 0 : questions.filter((question, index) => question.answer === answers[index]).length;
  const effect = zeroSeasonEffect(correct, intent);
  await c.env.DB.prepare(
    `INSERT INTO zero_season_series (user_id, game_day, intent, nest, correct, effect, client_request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(userId, gameDay, intent, start.nest, correct, effect, clientRequestId).run();
  if (correct >= 4) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO zero_season_egg_wallets (user_id, eggs, updated_at) VALUES (?, 1, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET eggs=eggs+1, updated_at=datetime('now')`,
      ).bind(userId),
      c.env.DB.prepare(
        `INSERT INTO zero_season_path_progress (user_id, bird, mastery, updated_at) VALUES (?, ?, 1, datetime('now'))
         ON CONFLICT(user_id, bird) DO UPDATE SET mastery=mastery+1, updated_at=datetime('now')`,
      ).bind(userId, currentBird),
    ]);
  }
  return c.json({
    gameDay, intent, nest: start.nest, correct, effect, timedOut,
    review: questions.map((question, index) => ({ id: question.id, correct: question.answer === answers[index], answer: question.answer })),
    eggs: await eggs(c.env, userId), paths: await paths(c.env, userId),
  });
});

zeroSeasonApi.post('/api/v4/forecast', async (c) => {
  const body = await json(c);
  if (typeof body.bird !== 'string' || !birds.has(body.bird)) throw new GameError('VALIDATION', { field: 'bird' });
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const saved = await profile(c.env, userId);
  if (!saved) throw new GameError('INVALID_TRANSITION', { reason: 'season_profile_required' });
  const gameDay = currentGameDay(c.env);
  const currentBird = await activeBird(c.env, userId, gameDay, saved.bird);
  if (!currentBird) throw new GameError('INVALID_TRANSITION', { reason: 'season_active_bird_required' });
  const bird = body.bird as ZeroSeasonBird;
  if (bird === currentBird) throw new GameError('VALIDATION', { field: 'bird', reason: 'forecast_own_bird' });
  const moved = await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first();
  const started = await c.env.DB.prepare(
    'SELECT 1 FROM zero_season_series_starts WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first();
  if (moved || started) throw new GameError('INVALID_TRANSITION', { reason: 'forecast_before_move' });
  const existing = await c.env.DB.prepare(
    'SELECT bird, status, client_request_id FROM zero_season_forecasts WHERE user_id = ? AND game_day = ?',
  ).bind(userId, gameDay).first<ForecastRow & { client_request_id: string }>();
  if (existing) {
    if (existing.client_request_id !== clientRequestId) throw new GameError('RATE_LIMITED', { reason: 'zero_season_daily_forecast' });
    return c.json({ gameDay, forecast: { bird: existing.bird, status: existing.status }, eggs: await eggs(c.env, userId) });
  }
  const wallet = await eggs(c.env, userId);
  if (wallet < 1) throw new GameError('INVALID_TRANSITION', { reason: 'zero_season_no_eggs' });
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO zero_season_forecasts (user_id, game_day, bird, client_request_id)
       VALUES (?, ?, ?, ?)`,
    ).bind(userId, gameDay, bird, clientRequestId),
    c.env.DB.prepare(
      `UPDATE zero_season_egg_wallets SET eggs=eggs-1, updated_at=datetime('now')
        WHERE user_id = ? AND eggs >= 1`,
    ).bind(userId),
  ]);
  return c.json({ gameDay, forecast: { bird, status: 'pending' }, eggs: await eggs(c.env, userId) });
});
