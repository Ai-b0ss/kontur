#!/usr/bin/env bash
set -euo pipefail

# Post-reset read-only diagnostic. Never writes production D1.
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" != '22' ]; then
  echo "CLOUDFLARE_WORKERS_BUILD_FAIL unexpected_node=$(node --version) expected_major=22" >&2
  exit 1
fi

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
node tools/handoff-safety-check.mjs
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp build

pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync('/tmp/kontur-prod-d1-info.json', 'utf8');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if (raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('RESET_DIAGNOSTIC_IDENTITY_PASS');
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
if (!targets.includes('users')) throw new Error('users table missing from diagnostic targets');
const selects = targets.map((name) => {
  const q = '"' + name.replaceAll('"', '""') + '"';
  const lit = name.replaceAll("'", "''");
  return `SELECT '${lit}' AS table_name, COUNT(*) AS rows FROM ${q}`;
});
fs.writeFileSync('/tmp/kontur-reset-counts.sql', selects.join('\nUNION ALL\n') + ';\n');
fs.writeFileSync('/tmp/kontur-reset-targets.json', JSON.stringify(targets));
NODE

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json --file /tmp/kontur-reset-counts.sql \
  > /tmp/kontur-reset-counts.json

pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities, (SELECT COUNT(*) FROM pilot_chats) AS pilot_chats, (SELECT COUNT(*) FROM v5_campaign_chats) AS campaign_chats" \
  > /tmp/kontur-reset-static.json

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_reset_diagnostic=20260822" \
  > /tmp/kontur-reset-health.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const countsRaw = JSON.parse(fs.readFileSync('/tmp/kontur-reset-counts.json', 'utf8'));
const countRows = [];
const visitCounts = (value) => {
  if (Array.isArray(value)) return value.forEach(visitCounts);
  if (!value || typeof value !== 'object') return;
  if (typeof value.table_name === 'string' && Number.isInteger(value.rows)) countRows.push(value);
  Object.values(value).forEach(visitCounts);
};
visitCounts(countsRaw);
const counts = new Map(countRows.map((r) => [r.table_name, r.rows]));
const targets = JSON.parse(fs.readFileSync('/tmp/kontur-reset-targets.json', 'utf8'));
for (const table of targets) if (!counts.has(table)) throw new Error(`missing count for ${table}`);
const nonZero = targets.filter((table) => counts.get(table) !== 0).map((table) => ({table, rows: counts.get(table)}));

const staticRaw = JSON.parse(fs.readFileSync('/tmp/kontur-reset-static.json', 'utf8'));
let statics = null;
const visitStatic = (value) => {
  if (statics) return;
  if (Array.isArray(value)) return value.forEach(visitStatic);
  if (!value || typeof value !== 'object') return;
  if (Number.isInteger(value.colorings) && Number.isInteger(value.opportunities) && Number.isInteger(value.pilot_chats) && Number.isInteger(value.campaign_chats)) statics = value;
  Object.values(value).forEach(visitStatic);
};
visitStatic(staticRaw);
if (!statics) throw new Error('static counts missing');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-reset-health.json', 'utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('production health mismatch');

const marker = {
  mode: 'read-only-post-reset-diagnostic',
  users: counts.get('users'),
  profiles: counts.get('profiles') ?? null,
  onboarding_answers: counts.get('onboarding_answers') ?? null,
  mutable_tables_checked: targets.length,
  mutable_nonzero_count: nonZero.length,
  mutable_nonzero: nonZero,
  static: {
    colorings: statics.colorings,
    opportunities: statics.opportunities,
    pilot_chats: statics.pilot_chats,
    campaign_chats: statics.campaign_chats,
  },
  health: {ok: health.ok, devMode: health.devMode, driver: health.driver},
};
fs.writeFileSync('apps/miniapp/dist/production-reset-status.json', JSON.stringify(marker, null, 2) + '\n');
console.log(`RESET_DIAGNOSTIC_READY users=${marker.users} nonzero=${nonZero.length}/${targets.length}`);
NODE

# Normal isolated staging deployment only.
node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8').replace(/^\uFEFF/, ''));
if (c.name !== 'kontur-igor-staging') throw new Error(`unexpected staging Worker ${c.name}`);
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db || db.database_id !== '22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging D1 mismatch');
if ('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routing/cron leaked into staging config');
console.log('CLOUDFLARE_WORKERS_BUILD_STAGING_PREP_PASS');
NODE
