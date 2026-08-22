import { createHmac } from 'node:crypto';

const origin = String(process.env.STAGING_ORIGIN || '').replace(/\/$/, '');
const botToken = 'staging-disabled-not-a-telegram-token';
const webhookSecret = 'staging-disabled-webhook-secret';
const mainChatId = -1000000000000;
const tgId = Number(process.env.STAGING_TG_ID || 987654321);

function fail(message, extra) {
  if (extra !== undefined) console.error(extra);
  throw new Error(message);
}

if (!origin.startsWith('https://kontur-igor-staging.')) fail('Refusing non-staging origin');
if (!Number.isSafeInteger(tgId) || tgId <= 0) fail('bad synthetic Telegram id');

function telegramInitData() {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', `release-staging-${tgId}`);
  params.set('user', JSON.stringify({ id: tgId, username: `release_staging_${tgId}` }));
  const checkString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

async function jsonFetch(path, init = {}) {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`, body);
  return body;
}

// Exercise the production-style Telegram boundary without contacting Telegram:
// the isolated staging Worker deliberately has an inert bot identity, while its
// fixed staging-only webhook secret can deliver synthetic /start + membership
// updates. This creates only a fresh synthetic staging profile and leaves the
// production Worker and production D1 unreachable from this script.
const webhookHeaders = {
  'content-type': 'application/json',
  'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
};
await jsonFetch('/telegram/webhook', {
  method: 'POST',
  headers: webhookHeaders,
  body: JSON.stringify({
    update_id: tgId,
    message: {
      message_id: tgId,
      from: { id: tgId, username: `release_staging_${tgId}` },
      chat: { id: tgId, type: 'private' },
      text: '/start',
    },
  }),
});
await jsonFetch('/telegram/webhook', {
  method: 'POST',
  headers: webhookHeaders,
  body: JSON.stringify({
    update_id: tgId + 1,
    chat_member: {
      chat: { id: mainChatId, type: 'supergroup' },
      from: { id: tgId, username: `release_staging_${tgId}` },
      new_chat_member: {
        user: { id: tgId, username: `release_staging_${tgId}` },
        status: 'member',
      },
    },
  }),
});

const auth = await jsonFetch('/api/v1/auth/telegram', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ initData: telegramInitData(), source: 'release-staging' }),
});
if (typeof auth?.token !== 'string' || !auth.token.includes('.')) fail('auth did not return JWT');
if (auth?.state?.hatched !== false) fail('fresh synthetic player is already hatched');

const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };
const questions = await jsonFetch('/api/v4/local/questions', { headers });
if (!Array.isArray(questions?.questions) || questions.questions.length !== 8) fail('current MVP must expose exactly eight questions');
if (questions.questions.some((q) => !Array.isArray(q?.options) || q.options.length !== 4)) fail('current MVP question shape mismatch');

const answers = questions.questions.map(() => 0);
const hatch = await jsonFetch('/api/v4/local/hatch', {
  method: 'POST',
  headers,
  body: JSON.stringify({ answers, clientRequestId: `release-hatch-${tgId}` }),
});
if (!hatch?.role || hatch?.state?.hatched !== true) fail('current MVP hatch failed');
if (hatch?.state?.egg?.cost !== 5) fail('current MVP egg cost must be 5');
if (hatch?.state?.player?.wallet !== 5) fail('synthetic proof wallet was not preserved');

const pull = await jsonFetch('/api/v4/local/egg/open', {
  method: 'POST',
  headers,
  body: JSON.stringify({ clientRequestId: `release-egg-${tgId}` }),
});
if (!pull?.coloring || pull.coloring === 'plain') fail('egg did not return a new cosmetic coloration');
if (pull?.duplicate !== false || pull?.refund !== 0) fail('current MVP egg must be guaranteed-new with no duplicate/refund');
if (pull?.state?.player?.wallet !== 0) fail('egg did not spend exactly five worms');

const equipped = await jsonFetch('/api/v4/local/coloring/equip', {
  method: 'POST',
  headers,
  body: JSON.stringify({ code: pull.coloring }),
});
if (equipped?.state?.player?.coloring !== pull.coloring) fail('new coloration did not equip');

const persisted = await jsonFetch('/api/v4/local/state', { headers });
if (persisted?.state?.hatched !== true) fail('hatch did not persist');
if (persisted?.state?.player?.coloring !== pull.coloring) fail('equipped coloration did not persist across reload state');
if (persisted?.state?.egg?.cost !== 5) fail('persisted current MVP egg cost changed');

console.log(JSON.stringify({
  ok: true,
  webhookBootstrap: true,
  questions: questions.questions.length,
  role: hatch.role,
  eggCost: persisted.state.egg.cost,
  newColoring: pull.coloring,
  equipped: persisted.state.player.coloring,
}));
console.log('STAGING_CURRENT_MVP_REMOTE_PASS');
