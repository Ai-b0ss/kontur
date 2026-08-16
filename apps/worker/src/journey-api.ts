import { Hono } from 'hono';
import {
  PARTICIPATION_INTENTS,
  isValidClientRequestId,
  type ParticipationIntent,
} from '@kontur/core';
import type { JourneyClient, JourneyOutcome, NestItemStatus } from '@kontur/contracts';
import { experienceV2Allowed } from './experience-access.js';
import { GameError } from './errors.js';
import {
  buildExperienceV2State,
  closeJourney,
  deleteNestItem,
  markJourneyOutcome,
  markJourneyPrepared,
  markJourneyPublished,
  saveNestItem,
  startJourney,
  updateNestNextStep,
  updateJourneyReminder,
} from './journey-db.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const journeyApi = new Hono<AppEnv>();

async function json(c: Parameters<typeof journeyApi.fetch>[0] extends never ? never : any) {
  try { return await c.req.json(); } catch { throw new GameError('VALIDATION'); }
}

function requestId(body: unknown): string {
  const value = (body as { clientRequestId?: unknown } | null)?.clientRequestId;
  if (!isValidClientRequestId(value)) {
    throw new GameError('VALIDATION', { field: 'clientRequestId' });
  }
  return value;
}

function client(value: unknown): JourneyClient {
  return ['desktop', 'ios', 'android', 'web'].includes(String(value))
    ? value as JourneyClient
    : 'unknown';
}

function chatCode(value: unknown, required = false): string | null {
  if (value === undefined && !required) return null;
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(value)) {
    throw new GameError('VALIDATION', { field: 'chatCode' });
  }
  return value;
}

function positiveId(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new GameError('VALIDATION', { field });
  return parsed;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new GameError('VALIDATION', { field });
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new GameError('VALIDATION', { field });
  return normalized;
}

function messageLink(value: unknown): string | null {
  const normalized = optionalText(value, 'messageLink', 500);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || url.hostname !== 't.me') throw new Error('not telegram');
  } catch {
    throw new GameError('VALIDATION', { field: 'messageLink' });
  }
  return normalized;
}

journeyApi.use('/api/v2/*', async (c, next) => {
  if (!await experienceV2Allowed(c.env, c.get('userId'))) {
    throw new GameError('EXPERIENCE_DISABLED');
  }
  await next();
});

journeyApi.get('/api/v2/state', async (c) => {
  return c.json(await buildExperienceV2State(c.env, c.get('userId')));
});

journeyApi.post('/api/v2/journey/start', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  if (!PARTICIPATION_INTENTS.includes(body.intent as ParticipationIntent)) {
    throw new GameError('VALIDATION', { field: 'intent' });
  }
  const selectedChat = chatCode(body.chatCode);
  if (body.intent === 'ask' && !selectedChat) {
    throw new GameError('VALIDATION', { field: 'chatCode' });
  }
  return c.json(await startJourney(c.env, c.get('userId'), {
    intent: body.intent as ParticipationIntent,
    chatCode: selectedChat,
    requestId: requestId(body),
    client: client(body.client),
  }));
});

journeyApi.post('/api/v2/journey/prepared', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  return c.json(await markJourneyPrepared(c.env, c.get('userId'), {
    requestId: requestId(body),
    client: client(body.client),
  }));
});

journeyApi.post('/api/v2/journey/published', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  const messageId = body.messageId === undefined
    ? null
    : positiveId(String(body.messageId), 'messageId');
  return c.json(await markJourneyPublished(c.env, c.get('userId'), {
    chatCode: chatCode(body.chatCode, true)!,
    messageId,
    requestId: requestId(body),
    client: client(body.client),
  }));
});

journeyApi.post('/api/v2/journey/outcome', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  // «Помогло» приходит только из явной Telegram-команды под конкретным ответом.
  if (!['clarify', 'saved'].includes(String(body.outcome))) {
    throw new GameError('VALIDATION', { field: 'outcome' });
  }
  return c.json(await markJourneyOutcome(c.env, c.get('userId'), {
    outcome: body.outcome as JourneyOutcome,
    requestId: requestId(body),
    client: client(body.client),
  }));
});

journeyApi.post('/api/v2/journey/close', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  return c.json(await closeJourney(c.env, c.get('userId'), requestId(body)));
});

journeyApi.post('/api/v2/nest/save', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  if (!['waiting', 'helped', 'clarify', 'done'].includes(String(body.status))) {
    throw new GameError('VALIDATION', { field: 'status' });
  }
  const label = optionalText(body.label, 'label', 120);
  if (!label) throw new GameError('VALIDATION', { field: 'label' });
  return c.json(await saveNestItem(c.env, c.get('userId'), {
    journeyId: positiveId(String(body.journeyId), 'journeyId'),
    label,
    status: body.status as NestItemStatus,
    messageLink: messageLink(body.messageLink),
    nextStep: optionalText(body.nextStep, 'nextStep', 240),
    requestId: requestId(body),
  }));
});

journeyApi.post('/api/v2/nest/:id/next-step', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  return c.json(await updateNestNextStep(
    c.env,
    c.get('userId'),
    positiveId(c.req.param('id'), 'id'),
    {
      nextStep: optionalText(body.nextStep, 'nextStep', 240),
      requestId: requestId(body),
    },
  ));
});

journeyApi.post('/api/v2/nest/:id/delete', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  return c.json(await deleteNestItem(
    c.env,
    c.get('userId'),
    positiveId(c.req.param('id'), 'id'),
    requestId(body),
  ));
});

journeyApi.post('/api/v2/nest/:id/reminder', async (c) => {
  const body = await json(c) as Record<string, unknown>;
  if (typeof body.enabled !== 'boolean') {
    throw new GameError('VALIDATION', { field: 'enabled' });
  }
  return c.json(await updateJourneyReminder(
    c.env,
    c.get('userId'),
    positiveId(c.req.param('id'), 'id'),
    { enabled: body.enabled, requestId: requestId(body) },
  ));
});
