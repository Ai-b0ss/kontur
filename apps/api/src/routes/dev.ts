import type { FastifyInstance } from 'fastify';
import { isSignalKind, issueSignal, logEvent, num } from '@kontur/db';
import { isDev } from '../env.js';
import { GameError } from '../errors.js';

/**
 * Dev-команды для проверки механик без второго живого человека.
 *
 * Регистрируются ТОЛЬКО когда BOT_TOKEN не задан: на проде этих маршрутов
 * не существует — не «закрыты паролем», а физически отсутствуют.
 */
export async function registerDevRoutes(app: FastifyInstance): Promise<void> {
  if (!isDev) return;

  /** Начислить червяков в кошелёк */
  app.post('/api/v1/dev/grant-worms', async (req) => {
    const amount = Number((req.body as { amount?: number }).amount ?? 50);
    await req.ctx.db.query(
      'update wallets set wallet = wallet + $2 where user_id = $1',
      [req.userId, amount],
    );
    return { ok: true, amount };
  });

  /**
   * Смоделировать червяка от другого игрока — то, что в бою делает
   * команда /червяк в чате.
   */
  app.post('/api/v1/dev/receive', async (req) => {
    const ctx = req.ctx;
    const b = req.body as { fromUserId?: number; amount?: number; reason?: string };
    const from = Number(b.fromUserId);
    const amount = Number(b.amount ?? 2);
    if (!Number.isFinite(from) || from === req.userId) {
      throw new GameError('VALIDATION', { field: 'fromUserId' });
    }
    const day = ctx.gameDay(new Date());

    const created = await ctx.db.transaction(async (tx) => {
      const source = await tx.one('select 1 from users where id = $1', [from]);
      if (!source) throw new GameError('VALIDATION', { field: 'fromUserId' });

      const inserted = await tx.query(
        `insert into worm_grants (from_user_id, to_user_id, amount, reason, game_day)
         values ($1, $2, $3, $4, $5)
         on conflict (from_user_id, to_user_id, game_day) do nothing
         returning id`,
        [from, req.userId, amount, b.reason ?? null, day],
      );
      if (inserted.length === 0) return false;

      // Червяк от человека растит обе валюты: и репутацию, и кошелёк
      await tx.query(
        `update wallets set wallet = wallet + $2, reputation = reputation + $2,
                            updated_at = now()
          where user_id = $1`,
        [req.userId, amount],
      );
      await logEvent(tx, req.userId, 'worm_received', { from, amount });
      return true;
    });

    return { ok: true, created };
  });

  /** Сбросить сутки, чтобы снова собрать пассив и раздать червяков */
  app.post('/api/v1/dev/reset-day', async (req) => {
    const ctx = req.ctx;
    const day = ctx.gameDay(new Date());
    await ctx.db.query(
      'update wallets set passive_collected_day = null where user_id = $1',
      [req.userId],
    );
    await ctx.db.query(
      'delete from worm_grants where from_user_id = $1 and game_day = $2',
      [req.userId, day],
    );
    return { ok: true };
  });

  /** Сбросить вылупление, чтобы прогнать онбординг заново */
  app.post('/api/v1/dev/unhatch', async (req) => {
    await req.ctx.db.transaction(async (tx) => {
      await tx.query(
        `update profiles set role = null, hatched_at = null, bird_name = null,
                             coloring = 'plain'
          where user_id = $1`,
        [req.userId],
      );
      await tx.query('delete from onboarding_answers where user_id = $1', [req.userId]);
      await tx.query('delete from player_colorings where user_id = $1', [req.userId]);
      await tx.query('delete from idempotency where key like $1', [`${req.userId}:%`]);
    });
    return { ok: true };
  });

  /** Выдать подтверждённую сигнал-карту без админского CLI. Только dev. */
  app.post('/api/v1/dev/grant-signal', async (req) => {
    const body = req.body as {
      kind?: unknown;
      title?: unknown;
      referenceCode?: unknown;
    };
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const referenceCode =
      typeof body.referenceCode === 'string' ? body.referenceCode.trim() : '';
    if (!isSignalKind(kind) || !title || !referenceCode) {
      throw new GameError('VALIDATION');
    }

    const result = await req.ctx.db.transaction((tx) =>
      issueSignal(tx, {
        userId: req.userId,
        kind,
        title: title.slice(0, 120),
        referenceCode: referenceCode.slice(0, 120),
      }),
    );
    return { ok: true, created: result.created };
  });

  /** Текущее состояние кошелька — для быстрой проверки */
  app.get('/api/v1/dev/peek', async (req) => {
    const w = await req.ctx.db.one<{
      wallet: string | number;
      reputation: string | number;
    }>('select wallet, reputation from wallets where user_id = $1', [req.userId]);
    return { wallet: num(w?.wallet), reputation: num(w?.reputation) };
  });
}
