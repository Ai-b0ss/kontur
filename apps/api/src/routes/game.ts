import type { FastifyInstance } from 'fastify';
import {
  QUESTIONS,
  ROLES,
  passiveAvailable,
  resolveRole,
  rollEgg,
  validateAnswers,
  isAnnounceworthy,
  type Coloring,
} from '@kontur/core';
import {
  asDate,
  ensureWallet,
  listSignals,
  logEvent,
  lockWallet,
  num,
  type ColoringRow,
} from '@kontur/db';
import type {
  ColoringsResponse,
  CommunityResponse,
  EggOpenResponse,
  HatchResponse,
  NestEntry,
  NestResponse,
  PassiveCollectResponse,
  Palette,
  QuestionsResponse,
  SignalsResponse,
} from '@kontur/contracts';
import { GameError } from '../errors.js';
import { buildState, loadPlayer, weeklyReputation } from '../player.js';
import { remember, replayed, requireRequestId } from '../idempotency.js';

export async function registerGameRoutes(app: FastifyInstance): Promise<void> {
  /** GET /state */
  app.get('/api/v1/state', async (req) => {
    const now = new Date();
    const p = await loadPlayer(req.ctx.db, req.userId);
    return buildState(req.ctx, req.ctx.db, p, now);
  });

  /** GET /questions — тест онбординга */
  app.get('/api/v1/questions', async () => {
    const response: QuestionsResponse = {
      questions: QUESTIONS.map((q) => ({
        text: q.text,
        options: q.options.map((o) => o.text),
      })),
    };
    return response;
  });

  /**
   * POST /onboarding/hatch — вылупление.
   *
   * Роль считается на сервере из ответов и больше никогда не меняется.
   * Клиент не присылает роль, только ответы: иначе любой поставил бы себе
   * скрытую птицу одним запросом.
   */
  app.post('/api/v1/onboarding/hatch', async (req) => {
    const ctx = req.ctx;
    const reqId = requireRequestId(req.body);
    const body = req.body as { answers?: unknown; birdName?: unknown };
    const now = new Date();

    // Через локальную переменную: сужение типа по предикату не переживает
    // обращение к свойству объекта
    const answers = body.answers;
    if (!validateAnswers(answers)) {
      throw new GameError('VALIDATION', { field: 'answers' });
    }
    const birdName =
      typeof body.birdName === 'string' && body.birdName.trim()
        ? body.birdName.trim().slice(0, 24)
        : null;

    return ctx.db.transaction(async (tx) => {
      const prior = await replayed<HatchResponse>(tx, req.userId, reqId);
      if (prior) return prior;

      const p = await loadPlayer(tx, req.userId);
      if (p.profile.role && p.profile.hatched_at) {
        throw new GameError('ALREADY_HATCHED');
      }

      const { role, scores } = resolveRole(answers);

      // Стартовый окрас — самый обычный, редкие только из яиц
      const starter = (await tx.one<ColoringRow>(
        `select * from colorings order by weight desc limit 1`,
      ))!;

      await tx.query(
        `update profiles
            set role = $2, hatched_at = now(), bird_name = $3, coloring = $4
          where user_id = $1`,
        [req.userId, role, birdName, starter.code],
      );
      await tx.query(
        `insert into player_colorings (user_id, coloring_code) values ($1, $2)
         on conflict do nothing`,
        [req.userId, starter.code],
      );
      await tx.query(
        `insert into onboarding_answers (user_id, answers, role, scores)
         values ($1, $2, $3, $4)
         on conflict (user_id) do nothing`,
        [req.userId, JSON.stringify(answers), role, JSON.stringify(scores)],
      );

      await logEvent(tx, req.userId, 'hatched', { role, scores });

      const fresh = await loadPlayer(tx, req.userId);
      const meta = ROLES[role];
      const who = birdName ? `${birdName}` : meta.title;

      const response: HatchResponse = {
        role,
        roleTitle: meta.title,
        roleTagline: meta.tagline,
        coloring: starter.code,
        coloringTitle: starter.title,
        palette: starter.palette as unknown as Palette,
        shareText: `Вылупился ${meta.title}${birdName ? ` — ${who}` : ''}. ${meta.tagline}.`,
        state: await buildState(ctx, tx, fresh, now),
      };
      await remember(tx, req.userId, reqId, '/onboarding/hatch', response);
      return response;
    });
  });

  /** POST /passive/collect — тонкий ручеёк, страховка от мёртвого старта */
  app.post('/api/v1/passive/collect', async (req) => {
    const ctx = req.ctx;
    const cfg = ctx.config.balance;
    const reqId = requireRequestId(req.body);
    const now = new Date();
    const day = ctx.gameDay(now);

    return ctx.db.transaction(async (tx) => {
      const prior = await replayed<PassiveCollectResponse>(tx, req.userId, reqId);
      if (prior) return prior;

      const p = await loadPlayer(tx, req.userId);
      if (!p.profile.hatched_at) throw new GameError('NOT_HATCHED');
      if (!ctx.config.features.FEATURE_PASSIVE) throw new GameError('FEATURE_LOCKED');

      await lockWallet(tx, req.userId);
      const wallet = await ensureWallet(tx, req.userId);

      const amount = passiveAvailable(wallet.passive_collected_day, day, cfg);
      if (amount <= 0) throw new GameError('NOTHING_TO_COLLECT');

      // Пассив идёт только в кошелёк: репутация — это оценка людей,
      // её нельзя набрать простым присутствием
      await tx.query(
        `update wallets
            set wallet = wallet + $2, passive_collected_day = $3, updated_at = now()
          where user_id = $1`,
        [req.userId, amount, day],
      );
      await logEvent(tx, req.userId, 'passive_collect', { amount });

      const fresh = await loadPlayer(tx, req.userId);
      const response: PassiveCollectResponse = {
        collected: amount,
        state: await buildState(ctx, tx, fresh, now),
      };
      await remember(tx, req.userId, reqId, '/passive/collect', response);
      return response;
    });
  });

  /** POST /egg/open — гача на внешность */
  app.post('/api/v1/egg/open', async (req) => {
    const ctx = req.ctx;
    const cfg = ctx.config.balance;
    const reqId = requireRequestId(req.body);
    const now = new Date();

    return ctx.db.transaction(async (tx) => {
      const prior = await replayed<EggOpenResponse>(tx, req.userId, reqId);
      if (prior) return prior;

      const p = await loadPlayer(tx, req.userId);
      if (!p.profile.hatched_at) throw new GameError('NOT_HATCHED');
      if (!ctx.config.features.FEATURE_EGGS) throw new GameError('FEATURE_LOCKED');

      await lockWallet(tx, req.userId);
      const wallet = await ensureWallet(tx, req.userId);
      if (num(wallet.wallet) < cfg.EGG_COST) throw new GameError('NOT_ENOUGH_WORMS');

      const pool = (await tx.query<ColoringRow>('select * from colorings')).map(
        (c) =>
          ({
            code: c.code,
            title: c.title,
            rarity: c.rarity,
            weight: c.weight,
            palette: c.palette,
          }) as unknown as Coloring,
      );
      const ownedRows = await tx.query<{ coloring_code: string }>(
        'select coloring_code from player_colorings where user_id = $1',
        [req.userId],
      );
      const owned = new Set(ownedRows.map((r) => r.coloring_code));

      const result = rollEgg(pool, owned, cfg);
      const spend = cfg.EGG_COST - result.refund;

      await tx.query(
        'update wallets set wallet = wallet - $2, updated_at = now() where user_id = $1',
        [req.userId, spend],
      );
      if (!result.duplicate) {
        await tx.query(
          `insert into player_colorings (user_id, coloring_code) values ($1, $2)
           on conflict do nothing`,
          [req.userId, result.coloring.code],
        );
      }

      // Анонс редких выпадений в чат — бесплатный контент и главный
      // двигатель гачи. Бот заберёт непроанонсированные записи
      await tx.query(
        `insert into egg_pulls (user_id, coloring_code, duplicate, announced)
         values ($1, $2, $3, $4)`,
        [
          req.userId,
          result.coloring.code,
          result.duplicate,
          !(isAnnounceworthy(result.coloring.rarity) && !result.duplicate),
        ],
      );

      await logEvent(tx, req.userId, 'egg_open', {
        coloring: result.coloring.code,
        rarity: result.coloring.rarity,
        duplicate: result.duplicate,
        spend,
      });

      const fresh = await loadPlayer(tx, req.userId);
      const rare = isAnnounceworthy(result.coloring.rarity) && !result.duplicate;

      const response: EggOpenResponse = {
        coloring: result.coloring.code,
        coloringTitle: result.coloring.title,
        rarity: result.coloring.rarity,
        palette: result.coloring.palette as unknown as Palette,
        duplicate: result.duplicate,
        refund: result.refund,
        shareText: rare
          ? `Выбил окрас «${result.coloring.title}»`
          : null,
        state: await buildState(ctx, tx, fresh, now),
      };
      await remember(tx, req.userId, reqId, '/egg/open', response);
      return response;
    });
  });

  /** GET /colorings — коллекция */
  app.get('/api/v1/colorings', async (req) => {
    const p = await loadPlayer(req.ctx.db, req.userId);
    const rows = await req.ctx.db.query<ColoringRow & { owned: boolean }>(
      `select c.*, (pc.user_id is not null) as owned
         from colorings c
         left join player_colorings pc
                on pc.coloring_code = c.code and pc.user_id = $1
        order by case c.rarity when 'common' then 0 when 'rare' then 1 else 2 end,
                 c.weight desc`,
      [req.userId],
    );

    const response: ColoringsResponse = {
      colorings: rows.map((c) => ({
        code: c.code,
        title: c.title,
        rarity: c.rarity,
        palette: c.palette as unknown as Palette,
        owned: c.owned,
        equipped: c.code === p.profile.coloring,
      })),
    };
    return response;
  });

  /** GET /signals — проверенные реальные действия игрока. */
  app.get('/api/v1/signals', async (req) => {
    const cards = await listSignals(req.ctx.db, req.userId);
    const response: SignalsResponse = {
      feathers: cards.length,
      cards,
    };
    return response;
  });

  /** POST /coloring/equip — надеть окрас */
  app.post('/api/v1/coloring/equip', async (req) => {
    const ctx = req.ctx;
    const now = new Date();
    const code = (req.body as { code?: unknown }).code;
    if (typeof code !== 'string') throw new GameError('VALIDATION', { field: 'code' });

    const owned = await ctx.db.one(
      'select 1 from player_colorings where user_id = $1 and coloring_code = $2',
      [req.userId, code],
    );
    if (!owned) throw new GameError('COLORING_LOCKED');

    await ctx.db.query('update profiles set coloring = $2 where user_id = $1', [
      req.userId,
      code,
    ]);

    const p = await loadPlayer(ctx.db, req.userId);
    return { state: await buildState(ctx, ctx.db, p, now) };
  });

  /** GET /nest — лента: кто кидал червяков и кто заходил */
  app.get('/api/v1/nest', async (req) => {
    const ctx = req.ctx;
    const cfg = ctx.config.balance;

    const grants = await ctx.db.query<{
      created_at: Date | string;
      from_user_id: number;
      username: string | null;
      amount: number;
      reason: string | null;
    }>(
      `select g.created_at, g.from_user_id, u.username, g.amount, g.reason
         from worm_grants g join users u on u.id = g.from_user_id
        where g.to_user_id = $1
        order by g.created_at desc limit 30`,
      [req.userId],
    );

    const visits = await ctx.db.query<{
      created_at: Date | string;
      visitor_id: number;
      username: string | null;
    }>(
      `select v.created_at, v.visitor_id, u.username
         from nest_visits v join users u on u.id = v.visitor_id
        where v.host_id = $1
        order by v.created_at desc limit 30`,
      [req.userId],
    );

    const entries: NestEntry[] = [
      ...grants.map((g) => ({
        kind: 'grant' as const,
        at: asDate(g.created_at).toISOString(),
        fromUserId: g.from_user_id,
        fromUsername: g.username,
        amount: g.amount,
        reason: g.reason,
      })),
      ...visits.map((v) => ({
        kind: 'visit' as const,
        at: asDate(v.created_at).toISOString(),
        fromUserId: v.visitor_id,
        fromUsername: v.username,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const response: NestResponse = {
      entries: entries.slice(0, 40),
      weeklyReceived: await weeklyReputation(ctx.db, req.userId, cfg.RANK_WINDOW_DAYS),
    };
    return response;
  });

  /**
   * GET /community — рейтинг за неделю.
   *
   * Именно за окно, а не за всё время: при рейтинге за всё время первая
   * пятёрка заняла бы верх навсегда, и остальные забили бы на второй неделе.
   */
  app.get('/api/v1/community', async (req) => {
    const ctx = req.ctx;
    const cfg = ctx.config.balance;
    if (!ctx.config.features.FEATURE_COMMUNITY) throw new GameError('FEATURE_LOCKED');

    const rows = await ctx.db.query<{
      user_id: number;
      username: string | null;
      bird_name: string | null;
      role: string | null;
      coloring: string;
      palette: Record<string, string>;
      weekly: string | number | null;
      total: string | number;
      signals: string | number;
    }>(
      `select p.user_id, u.username, p.bird_name, p.role, p.coloring, c.palette,
              (select coalesce(sum(g.amount), 0) from worm_grants g
                where g.to_user_id = p.user_id
                  and g.created_at > now() - ($1 || ' days')::interval) as weekly,
              w.reputation as total,
              (select count(1) from signal_cards s
                where s.user_id = p.user_id) as signals
         from profiles p
         join users u on u.id = p.user_id
         join wallets w on w.user_id = p.user_id
         left join colorings c on c.code = p.coloring
        where p.hatched_at is not null and u.banned_at is null
        order by weekly desc, w.reputation desc, u.id asc`,
      [String(cfg.RANK_WINDOW_DAYS)],
    );

    const ranking = rows.map((r, index) => ({
      position: index + 1,
      userId: r.user_id,
      username: r.username,
      birdName: r.bird_name,
      role: (r.role ?? null) as never,
      roleTitle: r.role
        ? ({
            designer: 'Дизайнер',
            coder: 'Кодер',
            creative: 'Креативщик',
            manager: 'Менеджер',
            vibe: 'Вайбодел',
          }[r.role] ?? null)
        : null,
      coloring: r.coloring,
      palette: (r.palette ?? {}) as unknown as Palette,
      weekly: num(r.weekly),
      total: num(r.total),
      signals: num(r.signals),
      isMe: r.user_id === req.userId,
    }));

    const myIndex = ranking.findIndex((r) => r.isMe);
    const visible = ranking.slice(0, cfg.RANK_SIZE);
    if (myIndex >= cfg.RANK_SIZE) visible.push(ranking[myIndex]!);

    const response: CommunityResponse = {
      ranking: visible,
      myPosition: myIndex + 1,
      totalInFlock: ranking.length,
      windowDays: cfg.RANK_WINDOW_DAYS,
    };
    return response;
  });

  /** POST /visit/:id — отметиться в чужом гнезде */
  app.post<{ Params: { id: string } }>('/api/v1/visit/:id', async (req) => {
    const ctx = req.ctx;
    const hostId = Number(req.params.id);
    if (!Number.isFinite(hostId) || hostId === req.userId) {
      throw new GameError('VALIDATION');
    }
    const host = await ctx.db.one(
      `select 1
         from users u join profiles p on p.user_id = u.id
        where u.id = $1 and u.banned_at is null and p.hatched_at is not null`,
      [hostId],
    );
    if (!host) throw new GameError('PLAYER_NOT_FOUND');

    await ctx.db.query(
      `insert into nest_visits (visitor_id, host_id, game_day)
       values ($1, $2, $3) on conflict do nothing`,
      [req.userId, hostId, ctx.gameDay(new Date())],
    );
    return { ok: true };
  });
}
