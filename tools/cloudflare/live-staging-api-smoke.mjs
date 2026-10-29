import { createHmac } from 'node:crypto';

const origin = String(process.env.STAGING_ORIGIN || '').replace(/\/$/, '');
const botToken = String(process.env.STAGING_BOT_TOKEN || '');
const tgId = Number(process.env.STAGING_TG_ID || 0);

function fail(message, extra) {
  if (extra !== undefined) console.error(extra);
  throw new Error(message);
}

if (!origin.startsWith('https://')) fail('STAGING_ORIGIN must be https');
if (!origin.includes('kontur-igor-staging.')) fail('Refusing non-staging origin');
if (!botToken.startsWith('staging-disabled-')) fail('Refusing non-inert staging BOT token');
if (!Number.isSafeInteger(tgId) || tgId <= 0) fail('STAGING_TG_ID must be a positive integer');

function telegramInitData() {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', `staging-smoke-${tgId}`);
  params.set('user', JSON.stringify({ id: tgId, username: `staging_smoke_${tgId}` }));
  const checkString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function jsonFetch(path, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`, body);
  return body;
}

const auth = await jsonFetch('/api/v1/auth/telegram', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ initData: telegramInitData(), source: 'campaign-v5' }),
});
if (typeof auth?.token !== 'string' || !auth.token.includes('.')) fail('Auth did not return a JWT');
if (auth?.state?.hatched !== false) fail('Synthetic user must start unhatched');

const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };
const questions = await jsonFetch('/api/v1/questions', { headers });
if (!Array.isArray(questions?.questions) || questions.questions.length !== 8) {
  fail('Expected exactly eight onboarding questions');
}
if (questions.questions.some((q) => !Array.isArray(q?.options) || q.options.length < 3)) {
  fail('Question options contract is invalid');
}

const answers = questions.questions.map(() => 0);
const hatch = await jsonFetch('/api/v1/onboarding/hatch', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    answers,
    birdName: 'Staging Smoke',
    clientRequestId: `staging-hatch-${tgId}`,
  }),
});
if (!hatch?.role || hatch?.state?.hatched !== true) fail('Hatch did not complete');
if (hatch?.state?.player?.birdName !== 'Staging Smoke') fail('Bird name did not persist');

const state = await jsonFetch('/api/v1/state', { headers });
if (state?.hatched !== true) fail('State did not persist hatched=true');
if (state?.player?.birdName !== 'Staging Smoke') fail('State lost bird name');
if (state?.player?.role !== hatch.role) fail('State role differs from hatch role');
if (state?.player?.wallet !== 0 || state?.player?.reputation !== 0) fail('Synthetic user started with non-zero economy');

console.log(JSON.stringify({
  ok: true,
  tgId,
  questions: questions.questions.length,
  hatched: state.hatched,
  role: state.player.role,
  wallet: state.player.wallet,
  reputation: state.player.reputation,
}));
console.log('STAGING_PRODUCT_API_SMOKE_PASS');
