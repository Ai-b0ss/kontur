import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { api } from './api.js';
import { handleCron, handleTelegramWebhook } from './bot.js';
import { LIVE_CAMPAIGN_CRON } from './live-campaign-telegram.js';
import { GameError } from './errors.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  if (c.env.DEV_MODE !== 'true') {
    const required: Array<keyof Env> = [
      'BOT_TOKEN', 'MAIN_CHAT_ID', 'JWT_SECRET', 'MINIAPP_URL', 'WEBHOOK_SECRET', 'ADMIN_SECRET',
    ];
    const missing = required.filter((key) => !c.env[key]);
    const v5UrlIsValid = !c.env.V5_MINIAPP_URL || c.env.V5_MINIAPP_URL.startsWith('https://');
    if (missing.length || !c.env.MINIAPP_URL.startsWith('https://') || !v5UrlIsValid) {
      console.error('[worker] production configuration is incomplete');
      return c.json({ error: { code: 'CONFIGURATION_ERROR', message: 'Сервис ещё настраивается' } }, 503);
    }
  }
  await next();
});

app.use('/api/*', cors({
  origin: (origin, c) => {
    if (c.env.DEV_MODE === 'true') return origin || '*';
    try {
      const allowed = new Set([c.env.MINIAPP_URL, c.env.V5_MINIAPP_URL]
        .filter((value): value is string => Boolean(value))
        .map((value) => new URL(value).origin));
      return allowed.has(origin) ? origin : '';
    } catch { return ''; }
  },
  allowHeaders: ['Authorization', 'Content-Type', 'X-Kontur-Admin'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

app.post('/telegram/webhook', (c) => handleTelegramWebhook(c.env, c.req.raw));
app.post('/api/v1/dev/cron', async (c) => {
  if (c.env.DEV_MODE !== 'true') return c.notFound();
  const body = await c.req.json<{ cron?: string; dueJourneyReminders?: boolean }>();
  const allowed = new Set(['30 4 * * *', '0 6-10 * * *', '0 15 * * *', LIVE_CAMPAIGN_CRON]);
  if (!body.cron || !allowed.has(body.cron)) return c.json({ error: { code: 'VALIDATION' } }, 400);
  if (body.dueJourneyReminders === true) {
    await c.env.DB.prepare(
      `UPDATE journey_reminders SET due_at=datetime('now') WHERE status='pending'`,
    ).run();
  }
  await handleCron(c.env, body.cron);
  const rows = (await c.env.DB.prepare(
    `SELECT job,status,attempts FROM cron_log
      WHERE job IN ('cleanup','daily_summary') ORDER BY job`,
  ).all<{ job: string; status: string; attempts: number }>()).results;
  const reminders = (await c.env.DB.prepare(
    `SELECT status,count(*) AS count FROM journey_reminders GROUP BY status ORDER BY status`,
  ).all<{ status: string; count: number }>()).results;
  return c.json({ ok: true, rows, reminders });
});
app.route('/', api);

app.onError((error, c) => {
  if (error instanceof GameError) return c.json(error.body(), error.status as 400);
  console.error('[worker] unhandled', error);
  return c.json({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка' } }, 500);
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Нет такого метода' } }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env, controller.cron));
  },
} satisfies ExportedHandler<Env>;
