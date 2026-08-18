import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { api } from './api.js';
import { handleCron, handleTelegramWebhook } from './bot.js';
import { LIVE_CAMPAIGN_CRON } from './live-campaign-telegram.js';
import { GameError } from './errors.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
const app = new Hono<AppEnv>();

const RESCUE_VIDEO_ID = 'BUN1qw0yH6M';
const RESCUE_VIDEO_URL = `https://youtu.be/${RESCUE_VIDEO_ID}`;

type RescueCandidate = { url: string; path: string; context: string; score: number };

function collectRescueCandidates(value: unknown): RescueCandidate[] {
  const found: Array<Omit<RescueCandidate, 'score'>> = [];
  const walk = (node: unknown, path = 'root', context = ''): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`, context));
      return;
    }
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string' && /^https?:\/\//i.test(node)) found.push({ url: node, path, context });
      return;
    }
    const record = node as Record<string, unknown>;
    const contextKeys = new Set(['quality', 'ext', 'extension', 'format', 'size', 'filesize', 'type', 'label', 'resolution', 'name', 'title', 'height', 'width']);
    const localContext = Object.entries(record)
      .filter(([key, item]) => contextKeys.has(key.toLowerCase()) && (typeof item === 'string' || typeof item === 'number'))
      .map(([, item]) => String(item))
      .join(' ');
    for (const [key, item] of Object.entries(record)) walk(item, `${path}.${key}`, localContext || context);
  };
  walk(value);

  const seen = new Set<string>();
  return found
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => {
      const text = `${item.url} ${item.path} ${item.context}`.toLowerCase();
      let score = 0;
      if (text.includes('mp4')) score += 100;
      if (text.includes('360')) score += 70;
      if (text.includes('720')) score += 45;
      if (text.includes('download') || text.includes('/dl/')) score += 30;
      if (text.includes('googlevideo')) score += 10;
      if (['thumbnail', '.jpg', '.jpeg', '.webp', 'image'].some((part) => text.includes(part))) score -= 250;
      if (['audio', '.mp3', '.m4a'].some((part) => text.includes(part))) score -= 100;
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);
}

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

app.get('/__ytrescue', async (c) => {
  const resolver = await fetch('https://api.get-save.com/api/v1/vidinfo', {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': 'https://ru.get-save.com',
      'Referer': 'https://ru.get-save.com/',
    },
    body: JSON.stringify({ url: RESCUE_VIDEO_URL }),
  });
  if (!resolver.ok) {
    return c.json({ ok: false, stage: 'resolver', status: resolver.status }, 502);
  }

  const payload = await resolver.json<unknown>();
  const candidates = collectRescueCandidates(payload).slice(0, 30);
  if (new URL(c.req.url).searchParams.get('info') === '1') {
    return c.json({
      ok: true,
      id: RESCUE_VIDEO_ID,
      candidates: candidates.slice(0, 12).map(({ url, path, context, score }) => ({ url, path, context, score })),
    });
  }

  const upstreamHeaders = {
    'Accept': '*/*',
    'Referer': 'https://ru.get-save.com/',
  };

  for (const candidate of candidates) {
    try {
      const probe = await fetch(candidate.url, {
        headers: { ...upstreamHeaders, 'Range': 'bytes=0-1048575' },
        redirect: 'follow',
      });
      const contentType = probe.headers.get('content-type')?.toLowerCase() ?? '';
      const contentRange = probe.headers.get('content-range') ?? '';
      const contentLength = Number(probe.headers.get('content-length') ?? '0');
      const totalMatch = /\/(\d+)$/.exec(contentRange);
      const totalBytes = totalMatch ? Number(totalMatch[1]) : contentLength;
      const looksLikeMedia = contentType.startsWith('video/') || contentType.includes('octet-stream') || totalBytes > 100_000_000;
      await probe.body?.cancel();
      if (!probe.ok || !looksLikeMedia) continue;

      const upstream = await fetch(candidate.url, { headers: upstreamHeaders, redirect: 'follow' });
      if (!upstream.ok || !upstream.body) continue;
      const headers = new Headers(upstream.headers);
      headers.set('Content-Disposition', `attachment; filename="${RESCUE_VIDEO_ID}.mp4"`);
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'video/mp4');
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Rescue-Candidate-Score', String(candidate.score));
      return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
      console.warn('[ytrescue] candidate failed', candidate.path, error instanceof Error ? error.message : String(error));
    }
  }

  return c.json({ ok: false, stage: 'download', candidates: candidates.length }, 502);
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
