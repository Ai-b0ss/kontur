import type { FastifyInstance } from 'fastify';
import { logEvent } from '@kontur/db';
import { GameError } from '../errors.js';
import { checkMembership, verifyInitData } from '../telegram.js';
import { issueToken } from '../jwt.js';
import { buildState, ensureUser, loadPlayer } from '../player.js';
import { isDev } from '../env.js';

const MEMBER_CACHE_MS = 6 * 3_600_000;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/telegram
   *
   * Привязка чата и апки бесплатная: Mini App отдаёт initData с user_id,
   * подписанный ключом бота, и это тот же user_id, который бот видит в чате.
   * Никакой регистрации и логина не нужно.
   */
  app.post('/api/v1/auth/telegram', async (req) => {
    const ctx = req.ctx;
    const body = req.body as { initData?: string; source?: string } | null;
    if (typeof body?.initData !== 'string') {
      throw new GameError('INVALID_INIT_DATA', { reason: 'no initData' });
    }

    const tg = verifyInitData(body.initData);
    const now = new Date();

    const { user, isNew } = await ensureUser(ctx.db, tg.tgId, tg.username);

    // Кэш членства — 6 часов: дёргать getChatMember на каждый запрос нельзя,
    // упрёмся в лимиты Telegram
    const checkedAt = user.member_checked_at
      ? new Date(user.member_checked_at).getTime()
      : 0;
    let isMember = user.is_member;

    if (Date.now() - checkedAt > MEMBER_CACHE_MS) {
      isMember = await checkMembership(tg.tgId);
      await ctx.db.query(
        'update users set is_member = $2, member_checked_at = now() where id = $1',
        [user.id, isMember],
      );
    }

    if (!isMember && !isDev) throw new GameError('NOT_MEMBER');
    if (user.banned_at) throw new GameError('BANNED');

    // Вход строго через /start: иначе не будет канала в личку и пушей.
    // В dev-режиме бота нет, поэтому отметку ставим сами
    const started = await ctx.db.one<{ started_bot_at: Date | null }>(
      'select started_bot_at from users where id = $1',
      [user.id],
    );
    if (!started?.started_bot_at) {
      if (isDev) {
        await ctx.db.query(
          'update users set started_bot_at = now() where id = $1',
          [user.id],
        );
      } else {
        throw new GameError('NOT_STARTED');
      }
    }

    await logEvent(ctx.db, user.id, 'link_open', { source: body.source ?? 'direct' });
    await logEvent(ctx.db, user.id, 'auth_done', { isNew });

    const { token, expiresAt } = issueToken(user.id);
    const p = await loadPlayer(ctx.db, user.id);

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      state: await buildState(ctx, ctx.db, p, now),
    };
  });
}
