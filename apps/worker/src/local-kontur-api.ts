import { Hono } from 'hono';
import {
  ROLES,
  rollEgg,
  resolveRole,
  validateAnswers,
  type Coloring,
  type Role,
} from '@kontur/core';
import type { Palette } from '@kontur/contracts';
import { buildState, logEvent } from './db.js';
import { GameError, sqliteError } from './errors.js';
import { zeroSeasonAllowed } from './experience-access.js';
import type { ColoringRow, Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const localKonturApi = new Hono<AppEnv>();

/**
 * Local Kontur is the narrow product surface for the first community pilot.
 * It deliberately reuses the proven V1 identity/wallet/coloring tables while
 * keeping V2–V5 experiments on the shelf.
 */
const LOCAL_EGG_COST = 5;

/**
 * Только presentation-copy для первого локального пилота.
 * Порядок вопросов и вариантов намеренно совпадает с core QUESTIONS,
 * поэтому серверный scoring, веса и resolveRole не меняются.
 */
const LOCAL_QUESTIONS = [
  {
    text: 'тебе кинули идею. что первым делом?',
    options: ['пойму, в чем вообще суть', 'попробую сразу собрать', 'накидаю еще вариантов', 'позову кого-нибудь обсудить'],
  },
  {
    text: 'что бесит сильнее?',
    options: ['когда ничего не понятно', 'когда что-то не работает', 'когда всё скучно', 'когда все тупят на месте'],
  },
  {
    text: 'освободился вечер. что скорее сделаешь?',
    options: ['допилю старую штуку', 'начну что-то новое', 'разберусь с накопившимся', 'пойду к людям'],
  },
  {
    text: 'в чате уже полчаса спорят. ты где?',
    options: ['пытаюсь понять, кто о чем', 'кидаю конкретный пример', 'приношу еще одну версию', 'пытаюсь всех собрать'],
  },
  {
    text: 'какой момент самый кайфовый?',
    options: ['когда стало понятно', 'когда заработало', 'когда получилось необычно', 'когда все наконец совпали'],
  },
  {
    text: 'штука уже работает, но кривовато',
    options: ['еще посижу над ней', 'норм, можно двигаться', 'покажу кому-нибудь', 'вернусь потом свежим'],
  },
  {
    text: 'что тебе обычно проще?',
    options: ['разобраться', 'собрать', 'придумать', 'договориться'],
  },
  {
    text: 'завтра дедлайн. готова половина',
    options: ['оставлю только главное', 'дожму сколько успею', 'придумаю обходной путь', 'соберу всех и разрулим'],
  },
] as const;

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

function parsePalette(row: ColoringRow): Palette {
  return JSON.parse(row.palette) as Palette;
}

async function colorings(env: Env, userId: number) {
  const player = await env.DB.prepare('SELECT coloring FROM profiles WHERE user_id = ?')
    .bind(userId).first<{ coloring: string }>();
  if (!player) throw new GameError('SESSION_EXPIRED');
  const rows = (await env.DB.prepare(
    `SELECT c.*, CASE WHEN pc.user_id IS NULL THEN 0 ELSE 1 END AS owned
       FROM colorings c LEFT JOIN player_colorings pc
         ON pc.coloring_code = c.code AND pc.user_id = ?
      ORDER BY CASE c.rarity WHEN 'common' THEN 0 WHEN 'rare' THEN 1 ELSE 2 END,
               c.weight DESC, c.code ASC`,
  ).bind(userId).all<ColoringRow & { owned: number }>()).results;
  return rows.map((row) => ({
    code: row.code,
    title: row.title,
    rarity: row.rarity,
    palette: parsePalette(row),
    owned: Boolean(row.owned),
    equipped: row.code === player.coloring,
  }));
}

localKonturApi.use('/api/v4/local/*', async (c, next) => {
  if (!zeroSeasonAllowed(c.env)) throw new GameError('EXPERIENCE_DISABLED');
  await next();
});

localKonturApi.get('/api/v4/local/state', async (c) => {
  const userId = c.get('userId');
  const state = await buildState(c.env, userId);
  return c.json({
    state: {
      ...state,
      // The local MVP intentionally has no passive wallet faucet, leaderboard
      // or separate community tab. Keep the legacy tables intact, hide the
      // features at this product surface.
      features: { eggs: true, community: false, passive: false },
      passive: null,
      egg: state.hatched ? {
        cost: LOCAL_EGG_COST,
        affordable: state.player.wallet >= LOCAL_EGG_COST,
        owned: state.egg?.owned ?? 0,
        total: state.egg?.total ?? 0,
      } : null,
    },
    colorings: state.hatched ? await colorings(c.env, userId) : [],
  });
});

localKonturApi.get('/api/v4/local/questions', (c) => c.json({
  questions: LOCAL_QUESTIONS,
}));

localKonturApi.post('/api/v4/local/hatch', async (c) => {
  const body = await json(c);
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');

  const replay = await c.env.DB.prepare(
    'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ? AND client_request_id = ?',
  ).bind(userId, clientRequestId).first<{ role: Role; bird_name: string | null }>();

  if (!replay) {
    if (!validateAnswers(body.answers)) throw new GameError('VALIDATION', { field: 'answers' });
    const { role, scores } = resolveRole(body.answers);
    try {
      await c.env.DB.prepare(
        `INSERT INTO onboarding_answers
          (user_id, client_request_id, answers, role, scores, bird_name)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      ).bind(userId, clientRequestId, JSON.stringify(body.answers), role, JSON.stringify(scores)).run();
      await logEvent(c.env.DB, userId, 'local_kontur_hatched', { role, scores });
    } catch (error) {
      // A user who already hatched in an older product surface keeps the
      // identity they already own. Fresh duplicate attempts still fail closed.
      const existing = await c.env.DB.prepare(
        'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ?',
      ).bind(userId).first<{ role: Role; bird_name: string | null }>();
      if (!existing) sqliteError(error);
    }
  }

  const saved = replay ?? await c.env.DB.prepare(
    'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ?',
  ).bind(userId).first<{ role: Role; bird_name: string | null }>();
  if (!saved) throw new Error('local hatch missing');
  const coloring = await c.env.DB.prepare("SELECT * FROM colorings WHERE code='plain'").first<ColoringRow>();
  if (!coloring) throw new Error('plain coloring missing');
  const meta = ROLES[saved.role];
  const state = await buildState(c.env, userId);
  return c.json({
    role: saved.role,
    roleTitle: meta.title,
    roleTagline: meta.tagline,
    coloring: coloring.code,
    coloringTitle: coloring.title,
    palette: parsePalette(coloring),
    shareText: `Я в «Контуре»: ${meta.title}.`,
    state: {
      ...state,
      features: { eggs: true, community: false, passive: false },
      passive: null,
      egg: {
        cost: LOCAL_EGG_COST,
        affordable: state.player.wallet >= LOCAL_EGG_COST,
        owned: state.egg?.owned ?? 1,
        total: state.egg?.total ?? 1,
      },
    },
  });
});

localKonturApi.post('/api/v4/local/egg/open', async (c) => {
  const body = await json(c);
  const clientRequestId = requestId(body.clientRequestId);
  const userId = c.get('userId');
  const profile = await c.env.DB.prepare('SELECT hatched_at FROM profiles WHERE user_id = ?')
    .bind(userId).first<{ hatched_at: string | null }>();
  if (!profile?.hatched_at) throw new GameError('NOT_HATCHED');

  let pull = await c.env.DB.prepare(
    `SELECT e.*, c.title, c.rarity, c.palette
       FROM egg_pulls e JOIN colorings c ON c.code=e.coloring_code
      WHERE e.user_id=? AND e.client_request_id=?`,
  ).bind(userId, clientRequestId).first<Record<string, string | number>>();

  if (!pull) {
    const rows = (await c.env.DB.prepare(
      `SELECT c.* FROM colorings c
        WHERE c.code <> 'plain'
          AND NOT EXISTS (
            SELECT 1 FROM player_colorings pc
             WHERE pc.user_id=? AND pc.coloring_code=c.code
          )
        ORDER BY c.code`,
    ).bind(userId).all<ColoringRow>()).results;
    if (!rows.length) throw new GameError('INVALID_TRANSITION', { reason: 'local_collection_complete' });

    // Reuse the battle-tested weighted selector, but only over unowned colors.
    // That keeps the first pilot simple: every paid egg visibly changes the collection.
    const pool = rows.map((row) => ({ ...row, palette: parsePalette(row) })) as Coloring[];
    const result = rollEgg(pool, new Set<string>(), {
      // Only EGG_COST/refund matter to rollEgg; keep the rest structurally valid.
      WORM_GIVE_PER_DAY: 3,
      WORM_VALUE_WITH_REASON: 1,
      WORM_VALUE_PLAIN: 1,
      WORM_DOUBLE_DAY_FACTOR: 1,
      WORM_REPEAT_FACTORS: [1],
      WORM_REPEAT_WINDOW_DAYS: 7,
      PASSIVE_WORMS_PER_DAY: 0,
      EGG_COST: LOCAL_EGG_COST,
      EGG_DUPLICATE_REFUND: 0,
      RANK_WINDOW_DAYS: 7,
      RANK_SIZE: 20,
      GAME_DAY_START_UTC: 1,
    });

    try {
      pull = await c.env.DB.prepare(
        `INSERT INTO egg_pulls
          (user_id,coloring_code,duplicate,spend,announced,client_request_id)
         SELECT ?, ?, 0, ?, 1, ?
          WHERE (SELECT wallet FROM wallets WHERE user_id=?) >= ?
            AND NOT EXISTS (
              SELECT 1 FROM player_colorings WHERE user_id=? AND coloring_code=?
            )
         RETURNING *`,
      ).bind(
        userId, result.coloring.code, LOCAL_EGG_COST, clientRequestId,
        userId, LOCAL_EGG_COST, userId, result.coloring.code,
      )
        .first<Record<string, string | number>>();
    } catch (error) {
      pull = await c.env.DB.prepare(
        `SELECT e.*, c.title, c.rarity, c.palette
           FROM egg_pulls e JOIN colorings c ON c.code=e.coloring_code
          WHERE e.user_id=? AND e.client_request_id=?`,
      ).bind(userId, clientRequestId).first<Record<string, string | number>>();
      if (!pull) throw error;
    }
    if (!pull) {
      const wallet = await c.env.DB.prepare('SELECT wallet FROM wallets WHERE user_id=?')
        .bind(userId).first<{ wallet: number }>();
      if (Number(wallet?.wallet ?? 0) < LOCAL_EGG_COST) throw new GameError('NOT_ENOUGH_WORMS');
      // Another concurrent pull can win the same unowned color between our
      // selection and INSERT. Nothing was charged; ask the client to retry.
      throw new GameError('INVALID_TRANSITION', { reason: 'local_egg_retry' });
    }
    const coloring = await c.env.DB.prepare('SELECT * FROM colorings WHERE code=?')
      .bind(pull.coloring_code).first<ColoringRow>();
    if (!coloring) throw new Error('local coloring missing');
    pull = { ...pull, title: coloring.title, rarity: coloring.rarity, palette: coloring.palette };
    await logEvent(c.env.DB, userId, 'local_egg_open', { coloring: coloring.code, spend: LOCAL_EGG_COST });
  }

  const state = await buildState(c.env, userId);
  return c.json({
    coloring: String(pull.coloring_code),
    coloringTitle: String(pull.title),
    rarity: pull.rarity,
    palette: typeof pull.palette === 'string' ? JSON.parse(pull.palette) : pull.palette,
    duplicate: false,
    refund: 0,
    shareText: null,
    state: {
      ...state,
      features: { eggs: true, community: false, passive: false },
      passive: null,
      egg: {
        cost: LOCAL_EGG_COST,
        affordable: state.player.wallet >= LOCAL_EGG_COST,
        owned: state.egg?.owned ?? 0,
        total: state.egg?.total ?? 0,
      },
    },
  });
});

localKonturApi.get('/api/v4/local/colorings', async (c) => {
  return c.json({ colorings: await colorings(c.env, c.get('userId')) });
});

localKonturApi.post('/api/v4/local/coloring/equip', async (c) => {
  const body = await json(c);
  if (typeof body.code !== 'string') throw new GameError('VALIDATION', { field: 'code' });
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    `UPDATE profiles SET coloring=? WHERE user_id=?
       AND EXISTS(
         SELECT 1 FROM player_colorings
          WHERE user_id=? AND coloring_code=?
       )`,
  ).bind(body.code, userId, userId, body.code).run();
  if (!result.meta.changes) throw new GameError('COLORING_LOCKED');
  await logEvent(c.env.DB, userId, 'local_coloring_equip', { coloring: body.code });
  const state = await buildState(c.env, userId);
  return c.json({
    state: {
      ...state,
      features: { eggs: true, community: false, passive: false },
      passive: null,
      egg: state.hatched ? {
        cost: LOCAL_EGG_COST,
        affordable: state.player.wallet >= LOCAL_EGG_COST,
        owned: state.egg?.owned ?? 0,
        total: state.egg?.total ?? 0,
      } : null,
    },
  });
});
