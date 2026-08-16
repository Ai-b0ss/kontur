import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { logEvent, type Sql } from '@kontur/db';
import { env, isDev, requireProdSecrets } from './env.js';
import { GameError } from './errors.js';
import { createCtx, type Ctx } from './ctx.js';
import { verifyToken } from './jwt.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerGameRoutes } from './routes/game.js';
import { registerDevRoutes } from './routes/dev.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: number;
    ctx: Ctx;
  }
}

requireProdSecrets();

// createCtx сам накатывает миграции и посев — до чтения конфига из БД
const ctx = await createCtx();

const app = Fastify({ logger: false });
await app.register(cors, {
  origin: isDev ? true : new URL(env.miniappUrl).origin,
});

// Действия не принимают тело, кроме явно описанных в §8.4. Штатный JSON-парсер
// отвечает 415/400 на пустое тело, поэтому разбираем сами.
app.removeAllContentTypeParsers();
app.addContentTypeParser('*', { parseAs: 'string' }, (_req, body: string, done) => {
  if (!body) return done(null, {});
  try {
    done(null, JSON.parse(body));
  } catch {
    done(new GameError('VALIDATION'), undefined);
  }
});

/* ─── rate limit: 30 запросов в минуту на пользователя (§8.1) ─── */

const buckets = new Map<number, { count: number; resetAt: number }>();
const requestedDevLimit = Number(process.env.KONTUR_DEV_RATE_LIMIT ?? 30);
const RATE_LIMIT =
  isDev && Number.isFinite(requestedDevLimit) && requestedDevLimit > 0
    ? Math.floor(requestedDevLimit)
    : 30;
const RATE_WINDOW_MS = 60_000;

function hitRateLimit(userId: number): boolean {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}, RATE_WINDOW_MS).unref();

/* ─── авторизация ──────────────────────────────────────────── */

const PUBLIC_PATHS = new Set(['/api/v1/auth/telegram', '/api/v1/health']);

app.addHook('onRequest', async (req: FastifyRequest) => {
  req.ctx = ctx;
  if (PUBLIC_PATHS.has(req.url.split('?')[0] ?? '')) return;

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new GameError('SESSION_EXPIRED');

  const userId = verifyToken(header.slice(7));

  if (hitRateLimit(userId)) throw new GameError('RATE_LIMITED');

  const user = await ctx.db.one<{ banned_at: Date | null; is_member: boolean }>(
    'select banned_at, is_member from users where id = $1',
    [userId],
  );
  if (!user) throw new GameError('SESSION_EXPIRED');
  if (user.banned_at) throw new GameError('BANNED');
  // Актуальность членства обновляется при логине; здесь только флаг (§4.2)
  if (!user.is_member && !isDev) throw new GameError('NOT_MEMBER');

  req.userId = userId;
});

/* ─── маршруты ─────────────────────────────────────────────── */

app.get('/api/v1/health', async () => {
  // Агрегаты без персональных данных — нужны, чтобы убедиться,
  // что /start и вылупления реально доходят
  const stats = await ctx.db.one<{
    started: string | number;
    hatched: string | number;
    grants: string | number;
  }>(
    `select (select count(1) from users where started_bot_at is not null) as started,
            (select count(1) from profiles where hatched_at is not null) as hatched,
            (select count(1) from worm_grants) as grants`,
  );

  return {
    ok: true,
    devMode: isDev,
    botInProcess: process.env.BOT_IN_PROCESS === '1',
    membershipChecked: Boolean(env.botToken && env.mainChatId),
    driver: ctx.db.driver,
    gameDay: ctx.gameDay(new Date()),
    configLoadedAt: ctx.config.loadedAt.toISOString(),
    startedBot: Number(stats?.started ?? 0),
    hatched: Number(stats?.hatched ?? 0),
    grants: Number(stats?.grants ?? 0),
  };
});

await registerAuthRoutes(app);
await registerGameRoutes(app);
await registerDevRoutes(app);

/* ─── обработка ошибок ─────────────────────────────────────── */

app.setErrorHandler(async (err, _req, reply) => {
  if (err instanceof GameError) {
    return reply.code(err.status).send(err.toBody());
  }
  // Всё, что сюда долетело, — баг: §14.2 требует кодов, а не 500
  console.error('[api] необработанная ошибка:', err);
  return reply.code(500).send({
    error: { code: 'INTERNAL', message: 'Внутренняя ошибка' },
  });
});

app.setNotFoundHandler(async (_req, reply) =>
  reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Нет такого метода' } }),
);

/*
 * Локально PGlite держит каталог БД эксклюзивно, поэтому бот отдельным
 * процессом не поднимется. BOT_IN_PROCESS=1 запускает его здесь же,
 * на том же соединении. На проде остаются два деплоя.
 */
if (process.env.BOT_IN_PROCESS === '1') {
  const { startBot } = await import('@kontur/bot');
  startBot({ db: ctx.db, config: ctx.config, epochMs: ctx.epochMs });
  console.log('[api] бот поднят внутри процесса (BOT_IN_PROCESS=1)');
}

await app.listen({ port: env.port, host: '0.0.0.0' });
console.log(
  `Контур · api на http://localhost:${env.port}  [${ctx.db.driver}]` +
    (isDev ? '  dev-режим: подпись Telegram и членство не проверяются' : ''),
);

export type { Sql };
export { logEvent };
