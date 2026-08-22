#!/usr/bin/env bash
set -euo pipefail

# Read-only owner identity probe after hatch deploy. No production writes.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export OWNER_USERNAME_NORM='igorekglukhovskii43'
export DIAGNOSTIC_JSON='cloudflare-owner-identity-771f908b.json'

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

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_identity_probe=771f908b" \
  > /tmp/kontur-prod-health.json
export LIVE_HTML="$(curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' "$CLOUDFLARE_PROD_ORIGIN/?kontur_identity_probe=771f908b")"

node --input-type=module <<'NODE'
import fs from 'node:fs';
const visit = (value, acc, pred) => {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, acc, pred));
  if (!value || typeof value !== 'object') return;
  if (pred(value)) acc.push(value);
  Object.values(value).forEach((item) => visit(item, acc, pred));
};
const rows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-user-identities.json', 'utf8')), rows, (row) => (
  Number.isInteger(Number(row.db_id)) && typeof row.username_norm === 'string'
));
const unique = [];
const seen = new Set();
for (const row of rows) {
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
const ownerMatches = unique.filter((row) => row.usernameNorm === process.env.OWNER_USERNAME_NORM);
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health.json', 'utf8'));
const html = process.env.LIVE_HTML || '';
const payload = {
  status: ownerMatches.length === 1 ? 'OWNER_UNIQUE' : 'OWNER_NOT_UNIQUE',
  releaseExpected: '771f908b6f2407102a04e2c1773ff97f1150a400',
  liveJs: (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [null])[0],
  liveCss: (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/) || [null])[0],
  health: { ok: health.ok, devMode: health.devMode, driver: health.driver, startedBot: health.startedBot, hatched: health.hatched, grants: health.grants },
  requestedOwnerUsername: process.env.OWNER_USERNAME_NORM,
  ownerMatchCount: ownerMatches.length,
  users: unique,
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
console.log(`OWNER_IDENTITY_PROBE_PASS count=${unique.length} ownerMatches=${ownerMatches.length}`);
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
echo 'CLOUDFLARE_OWNER_IDENTITY_PROBE_CONFIRMED'
