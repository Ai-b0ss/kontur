#!/usr/bin/env bash
set -euo pipefail

# Minimal post-reset read-only diagnostic. Never writes production D1.
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm -F @kontur/miniapp build

pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync('/tmp/kontur-prod-d1-info.json', 'utf8');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if (raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
NODE

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles) AS profiles, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM onboarding_answers) AS onboarding, (SELECT COUNT(*) FROM wallets) AS wallets, (SELECT COUNT(*) FROM colorings) AS colorings" \
  > /tmp/kontur-reset-core-counts.json

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_reset_diagnostic=core" \
  > /tmp/kontur-reset-health.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync('/tmp/kontur-reset-core-counts.json', 'utf8'));
let counts = null;
const visit = (value) => {
  if (counts) return;
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (['users','profiles','hatched','onboarding','wallets','colorings'].every((k) => Number.isInteger(value[k]))) counts = value;
  Object.values(value).forEach(visit);
};
visit(raw);
if (!counts) throw new Error('core counts missing');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-reset-health.json', 'utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('production health mismatch');
fs.writeFileSync('apps/miniapp/dist/production-reset-status.json', JSON.stringify({
  mode: 'minimal-read-only-post-reset-diagnostic',
  ...counts,
  health: {ok: health.ok, devMode: health.devMode, driver: health.driver},
}, null, 2) + '\n');
console.log(`RESET_CORE_DIAGNOSTIC_READY users=${counts.users} onboarding=${counts.onboarding}`);
NODE

node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8').replace(/^\uFEFF/, ''));
if (c.name !== 'kontur-igor-staging') throw new Error(`unexpected staging Worker ${c.name}`);
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db || db.database_id !== '22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging D1 mismatch');
console.log('CLOUDFLARE_WORKERS_BUILD_STAGING_PREP_PASS');
NODE
