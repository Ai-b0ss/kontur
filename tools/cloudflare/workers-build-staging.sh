#!/usr/bin/env bash
set -euo pipefail

# Read-only proof that username fff6pm was removed. No production writes.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export OWNER_USERNAME_NORM='fff6pm'
export DIAGNOSTIC_JSON='cloudflare-one-user-reset-fff6pm.json'

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" != '22' ]; then
  echo "CLOUDFLARE_WORKERS_BUILD_FAIL unexpected_node=$(node --version) expected_major=22" >&2
  exit 1
fi
echo "CLOUDFLARE_WORKERS_BUILD_NODE_PASS version=$(node --version)"

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

node tools/handoff-safety-check.mjs
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp build

pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw=fs.readFileSync('/tmp/kontur-prod-d1-info.json','utf8');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if(raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('CLOUDFLARE_PROD_D1_READONLY_AUTH_PASS');
NODE

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json --command \
  "SELECT u.id AS db_id, CASE WHEN u.username IS NULL OR trim(u.username)='' THEN 'EMPTY' ELSE lower(replace(u.username,'@','')) END AS username_norm, CASE WHEN u.started_bot_at IS NULL THEN 0 ELSE 1 END AS started, CASE WHEN p.hatched_at IS NULL THEN 0 ELSE 1 END AS hatched FROM users u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.id" \
  > /tmp/kontur-user-identities.json

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json --command \
  "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities, (SELECT COUNT(*) FROM d1_migrations) AS migrations, (SELECT COUNT(*) FROM users WHERE id = 37) AS owner_db_id_remaining, (SELECT COUNT(*) FROM users WHERE lower(replace(coalesce(username,''),'@','')) = 'fff6pm') AS owner_username_remaining" \
  > /tmp/kontur-counts.json

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_fff6pm_proof=1" \
  > /tmp/kontur-prod-health.json
export LIVE_HTML="$(curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' "$CLOUDFLARE_PROD_ORIGIN/?kontur_fff6pm_proof=1")"
api_code="$(curl -sS -o /tmp/kontur-prod-unauth.json -w '%{http_code}' "$CLOUDFLARE_PROD_ORIGIN/api/v4/local/state")"
test "$api_code" = '401'
webhook_code="$(curl -sS -o /tmp/kontur-prod-webhook.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{"update_id":1}' "$CLOUDFLARE_PROD_ORIGIN/telegram/webhook")"
test "$webhook_code" = '403'

node --input-type=module <<'NODE'
import fs from 'node:fs';
const visit = (value, acc, pred) => {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, acc, pred));
  if (!value || typeof value !== 'object') return;
  if (pred(value)) acc.push(value);
  Object.values(value).forEach((item) => visit(item, acc, pred));
};
const users = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-user-identities.json', 'utf8')), users, (row) => (
  Number.isInteger(Number(row.db_id)) && typeof row.username_norm === 'string'
));
const unique = [];
const seen = new Set();
for (const row of users) {
  const id = Number(row.db_id);
  if (seen.has(id)) continue;
  seen.add(id);
  unique.push({
    dbId: id,
    usernameNorm: row.username_norm,
    started: Number(row.started || 0),
    hatched: Number(row.hatched || 0),
  });
}
unique.sort((a, b) => a.dbId - b.dbId);
const countsRows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-counts.json', 'utf8')), countsRows, (row) => row.users != null && row.hatched != null);
const counts = countsRows[0] || {};
const num = (value) => Number(value);
if (num(counts.owner_username_remaining) !== 0) throw new Error('fff6pm username still present');
if (num(counts.owner_db_id_remaining) !== 0) throw new Error('owner db id 37 still present');
if (unique.some((row) => row.usernameNorm === process.env.OWNER_USERNAME_NORM || row.dbId === 37)) {
  throw new Error('fff6pm still listed in users');
}
if (unique.length !== 3) throw new Error(`expected 3 remaining users, got ${unique.length}`);
const remaining = unique.map((row) => row.usernameNorm).sort();
if (JSON.stringify(remaining) !== JSON.stringify(['belasblesov', 'fff6dm', 'fff999o'])) {
  throw new Error(`unexpected remaining usernames ${remaining.join(',')}`);
}
if (num(counts.users) !== 3 || num(counts.hatched) !== 3) throw new Error('aggregate isolation failed');
if (!(num(counts.colorings) > 0) || !(num(counts.opportunities) > 0)) throw new Error('static seeds missing');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health.json', 'utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('health mismatch');
if (Number(health.startedBot) !== 3 || Number(health.hatched) !== 3) throw new Error('health counts mismatch');
const html = process.env.LIVE_HTML || '';
if (!html.includes('/assets/index-DuA7dhZw.js') || !html.includes('/assets/index-C64rrWW-.css')) {
  throw new Error('hatch assets missing from live HTML');
}
const payload = {
  status: 'PASS',
  stage: 'one-user-reset-fff6pm-proof',
  release: '771f908b6f2407102a04e2c1773ff97f1150a400',
  resetPerformed: true,
  ownerUsername: 'fff6pm',
  ownerDbId: 37,
  exactAsset: true,
  assets: { js: '/assets/index-DuA7dhZw.js', css: '/assets/index-C64rrWW-.css' },
  usersBefore: 4,
  usersAfter: num(counts.users),
  hatchedBefore: 4,
  hatchedAfter: num(counts.hatched),
  grantsAfter: num(counts.grants),
  colorings: num(counts.colorings),
  opportunities: num(counts.opportunities),
  migrations: num(counts.migrations),
  remainingUsers: unique,
  health,
  apiBoundary: true,
  telegramWebhookBoundary: true,
  globalResetPerformed: false,
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
console.log('ONE_USER_RESET_FFF6PM_PROOF_PASS');
NODE

node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8'));
if (c.name !== 'kontur-igor-staging') throw new Error(`unexpected staging Worker ${c.name}`);
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db || db.database_id !== '22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging D1 mismatch');
if ('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routing/cron leaked into staging config');
console.log('CLOUDFLARE_WORKERS_BUILD_STAGING_PREP_PASS');
NODE

pnpm -F @kontur/worker exec wrangler deploy --keep-vars --config wrangler.staging.generated.jsonc
echo 'CLOUDFLARE_ONE_USER_RESET_PROOF_CONFIRMED'
