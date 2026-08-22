#!/usr/bin/env bash
set -euo pipefail

# Read-only proof that every table targeted by the one-time production reset is empty.
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
  --command "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" \
  > /tmp/kontur-reset-schema.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync('/tmp/kontur-reset-schema.json', 'utf8'));
const names = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (typeof value.name === 'string') names.push(value.name);
  Object.values(value).forEach(visit);
};
visit(raw);
const preserve = new Set(['d1_migrations','colorings','pilot_chats','restored_opportunities','v5_campaign_chats']);
const targets = [...new Set(names)]
  .filter((name) => !preserve.has(name))
  .filter((name) => !name.startsWith('_cf_'))
  .filter((name) => !/migration/i.test(name))
  .sort();
if (!targets.includes('users')) throw new Error('users table missing from reset target set');
const terms = targets.map((name) => `(SELECT COUNT(*) FROM "${name.replaceAll('"','""')}")`);
fs.writeFileSync('/tmp/kontur-reset-total.sql', `SELECT ${terms.join(' + ')} AS remaining_rows, ${targets.length} AS tables_checked;\n`);
NODE

RESET_TOTAL_SQL="$(cat /tmp/kontur-reset-total.sql)"
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json --command "$RESET_TOTAL_SQL" \
  > /tmp/kontur-reset-total.json

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities" \
  > /tmp/kontur-reset-static.json

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_reset_proof=all-runtime" \
  > /tmp/kontur-reset-health.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const findRecord = (raw, keys) => {
  let found = null;
  const visit = (value) => {
    if (found) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (keys.every((k) => Number.isInteger(value[k]))) found = value;
    Object.values(value).forEach(visit);
  };
  visit(raw);
  return found;
};
const total = findRecord(JSON.parse(fs.readFileSync('/tmp/kontur-reset-total.json','utf8')), ['remaining_rows','tables_checked']);
if (!total) throw new Error('runtime total missing');
if (total.remaining_rows !== 0) throw new Error(`runtime reset incomplete remaining_rows=${total.remaining_rows} tables=${total.tables_checked}`);
const statics = findRecord(JSON.parse(fs.readFileSync('/tmp/kontur-reset-static.json','utf8')), ['colorings','opportunities']);
if (!statics || statics.colorings <= 0 || statics.opportunities <= 0) throw new Error('required static catalog missing after reset');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-reset-health.json','utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('production health mismatch');
console.log(`PRODUCTION_RESET_ALL_RUNTIME_PASS tables=${total.tables_checked} remaining_rows=0 colorings=${statics.colorings} opportunities=${statics.opportunities}`);
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
