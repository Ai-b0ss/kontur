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
const updateBase = tgId * 100;
const giverBase = tgId * 10;
if (!Number.isSafeInteger(updateBase + 99) || !Number.isSafeInteger(giverBase + 9)) {
  fail('synthetic staging id namespace exceeds safe integers');
}

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
  const maxAttempts = 4;
  const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    let text;
    try {
      response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(30_000) });
      text = await response.text();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.error(`STAGING_FETCH_RETRY path=${path} attempt=${attempt} reason=network`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      continue;
    }
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (response.ok) return body;
    if (!retryableStatus.has(response.status) || attempt === maxAttempts) {
      fail(`${path} returned HTTP ${response.status}`, body);
    }
    console.error(`STAGING_FETCH_RETRY path=${path} attempt=${attempt} status=${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  fail(`${path} exhausted retry policy`);
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
async function webhook(update) {
  return jsonFetch('/telegram/webhook', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify(update),
  });
}

await webhook({
  update_id: updateBase,
  message: {
    message_id: updateBase,
    from: { id: tgId, username: `release_staging_${tgId}` },
    chat: { id: tgId, type: 'private' },
    text: '/start',
  },
});
await webhook({
  update_id: updateBase + 1,
  chat_member: {
    chat: { id: mainChatId, type: 'supergroup' },
    from: { id: tgId, username: `release_staging_${tgId}` },
    new_chat_member: {
      user: { id: tgId, username: `release_staging_${tgId}` },
      status: 'member',
    },
  },
});

const auth = await jsonFetch('/api/v1/auth/telegram', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ initData: telegramInitData(), source: 'release-staging' }),
});
if (typeof auth?.token !== 'string' || !auth.token.includes('.')) fail('auth did not return JWT');
if (auth?.state?.hatched !== false) fail('fresh synthetic player is already hatched');
if (auth?.state?.player?.wallet !== 0) fail('fresh synthetic wallet is not zero', auth?.state);

const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };
async function localState() {
  return jsonFetch('/api/v4/local/state', { headers });
}

function wormUpdate(giverId, offset) {
  const messageId = updateBase + offset;
  return {
    update_id: messageId,
    message: {
      message_id: messageId,
      from: { id: giverId, username: `release_giver_${giverId}` },
      chat: { id: mainChatId, type: 'supergroup' },
      text: '/worm',
      reply_to_message: {
        message_id: tgId,
        from: { id: tgId, username: `release_staging_${tgId}` },
      },
    },
  };
}

// Self-reward and a repeated giver→receiver reward must not mint worms. Five
// distinct trusted webhook updates then fund the exact five-worm reward egg.
await webhook(wormUpdate(tgId, 10));
if ((await localState())?.state?.player?.wallet !== 0) fail('self /worm minted currency');
const givers = Array.from({ length: 5 }, (_, index) => giverBase + index + 1);
for (let index = 0; index < givers.length; index += 1) {
  await webhook(wormUpdate(givers[index], 20 + index));
}
await webhook(wormUpdate(givers[0], 30));
const funded = await localState();
if (funded?.state?.player?.wallet !== 5) fail('five unique /worm grants did not fund exactly five', funded?.state);

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
if (hatch?.state?.player?.wallet !== 5) fail('hatch did not preserve the five earned worms', hatch?.state);

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
  wormFunding: { distinctGivers: givers.length, selfRejected: true, repeatRejected: true, wallet: 5 },
  questions: questions.questions.length,
  role: hatch.role,
  eggCost: persisted.state.egg.cost,
  newColoring: pull.coloring,
  equipped: persisted.state.player.coloring,
}));
console.log('STAGING_CURRENT_MVP_REMOTE_PASS');
