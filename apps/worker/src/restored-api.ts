import { Hono } from 'hono';
import type {
  RestoredActionStatus,
  RestoredMotion,
  RestoredNestItemDto,
  RestoredPathKind,
  RestoredVisibility,
  SaveRestoredActionRequest,
  SaveRestoredNestRequest,
} from '@kontur/contracts';
import { buildState } from './db.js';
import { GameError } from './errors.js';
import { experienceV3Allowed } from './experience-access.js';
import {
  buildRestoredState,
  saveRestoredAction,
  saveRestoredNest,
  updateRestoredAction,
  updateRestoredMotion,
  updateRestoredNest,
} from './restored-db.js';
import type { Env } from './types.js';

type AppEnv = { Bindings: Env; Variables: { userId: number } };
export const restoredApi = new Hono<AppEnv>();

const PATHS = new Set<RestoredPathKind>([
  'ask', 'help', 'connect', 'orient', 'opportunity', 'contribution', 'save', 'progress',
]);
const ACTION_STATUSES = new Set<RestoredActionStatus>(['planned', 'active', 'done']);
const NEST_STATUSES = new Set<RestoredNestItemDto['status']>(['active', 'done']);
const VISIBILITIES = new Set<RestoredVisibility>(['private', 'flock']);
const MOTIONS = new Set<RestoredMotion>(['system', 'reduced']);
const SOURCE_KINDS = new Set<RestoredNestItemDto['sourceKind']>([
  'action', 'opportunity', 'signal', 'note',
]);

async function body(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const value = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value as Record<string, unknown>;
  } catch {
    throw new GameError('VALIDATION');
  }
}

function text(value: unknown, field: string, max: number, required = true): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new GameError('VALIDATION', { field });
    return undefined;
  }
  if (typeof value !== 'string') throw new GameError('VALIDATION', { field });
  const clean = value.trim();
  if (!clean || clean.length > max) throw new GameError('VALIDATION', { field });
  return clean;
}

function requestId(value: unknown): string {
  const id = text(value, 'clientRequestId', 128);
  if (!id || id.length < 8) throw new GameError('VALIDATION', { field: 'clientRequestId' });
  return id;
}

function idParam(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new GameError('VALIDATION', { field: 'id' });
  return id;
}

restoredApi.use('/api/v3/*', async (c, next) => {
  if (!await experienceV3Allowed(c.env, c.get('userId'))) {
    throw new GameError('EXPERIENCE_DISABLED');
  }
  await next();
});

restoredApi.get('/api/v3/state', (c) => buildRestoredState(c.env, c.get('userId')).then((v) => c.json(v)));

restoredApi.use('/api/v3/*', async (c, next) => {
  if (c.req.method === 'GET') return next();
  const game = await buildState(c.env, c.get('userId'));
  if (!game.hatched) throw new GameError('NOT_HATCHED');
  await next();
});

restoredApi.post('/api/v3/actions', async (c) => {
  const raw = await body(c);
  if (!PATHS.has(raw.kind as RestoredPathKind)) throw new GameError('VALIDATION', { field: 'kind' });
  if (!ACTION_STATUSES.has(raw.status as RestoredActionStatus)) {
    throw new GameError('VALIDATION', { field: 'status' });
  }
  const visibility = (raw.visibility ?? 'private') as RestoredVisibility;
  if (!VISIBILITIES.has(visibility)) throw new GameError('VALIDATION', { field: 'visibility' });
  const input: SaveRestoredActionRequest = {
    kind: raw.kind as RestoredPathKind,
    status: raw.status as RestoredActionStatus,
    title: text(raw.title, 'title', 100)!,
    note: text(raw.note, 'note', 500, false),
    chatCode: text(raw.chatCode, 'chatCode', 40, false),
    visibility,
    clientRequestId: requestId(raw.clientRequestId),
  };
  return c.json(await saveRestoredAction(c.env, c.get('userId'), input));
});

restoredApi.post('/api/v3/actions/:id/status', async (c) => {
  const raw = await body(c);
  const status = raw.status as RestoredActionStatus;
  if (!ACTION_STATUSES.has(status)) throw new GameError('VALIDATION', { field: 'status' });
  return c.json(await updateRestoredAction(
    c.env, c.get('userId'), idParam(c.req.param('id')), status,
    requestId(raw.clientRequestId),
  ));
});

restoredApi.post('/api/v3/nest', async (c) => {
  const raw = await body(c);
  if (!SOURCE_KINDS.has(raw.sourceKind as RestoredNestItemDto['sourceKind'])) {
    throw new GameError('VALIDATION', { field: 'sourceKind' });
  }
  const input: SaveRestoredNestRequest = {
    sourceKind: raw.sourceKind as RestoredNestItemDto['sourceKind'],
    sourceId: text(raw.sourceId, 'sourceId', 100, false),
    title: text(raw.title, 'title', 100)!,
    note: text(raw.note, 'note', 500, false),
    nextStep: text(raw.nextStep, 'nextStep', 240, false),
    clientRequestId: requestId(raw.clientRequestId),
  };
  return c.json(await saveRestoredNest(c.env, c.get('userId'), input));
});

restoredApi.post('/api/v3/nest/:id/status', async (c) => {
  const raw = await body(c);
  const status = raw.status as RestoredNestItemDto['status'];
  if (!NEST_STATUSES.has(status)) throw new GameError('VALIDATION', { field: 'status' });
  return c.json(await updateRestoredNest(
    c.env, c.get('userId'), idParam(c.req.param('id')), status,
    text(raw.nextStep, 'nextStep', 240, false), requestId(raw.clientRequestId),
  ));
});

restoredApi.post('/api/v3/preferences/motion', async (c) => {
  const raw = await body(c);
  const motion = raw.motion as RestoredMotion;
  if (!MOTIONS.has(motion)) throw new GameError('VALIDATION', { field: 'motion' });
  return c.json(await updateRestoredMotion(c.env, c.get('userId'), motion));
});
