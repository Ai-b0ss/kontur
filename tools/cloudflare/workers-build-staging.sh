#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-time production data reset (2026-08-22).
# Preserve schema/migrations and static configuration; erase participant/runtime state.
export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
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

# Fail closed on the exact production D1 identity before any write.
pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync('/tmp/kontur-prod-d1-info.json', 'utf8');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if (!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if (raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('PRODUCTION_RESET_IDENTITY_PASS');
NODE

# Snapshot aggregate counts only; no user rows are printed.
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM onboarding_answers) AS onboarding" \
  > /tmp/kontur-reset-before.json

# Read the live schema and derive every mutable table. Static catalog/config and
# migration metadata are intentionally preserved so the bot remains runnable.
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" \
  > /tmp/kontur-reset-schema.json

node --input-type=module <<'NODE'
import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync('/tmp/kontur-reset-schema.json', 'utf8'));
const rows = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (typeof value.name === 'string' && typeof value.sql === 'string') rows.push({name: value.name, sql: value.sql});
  Object.values(value).forEach(visit);
};
visit(raw);

const byName = new Map(rows.map((row) => [row.name, row.sql]));
if (!byName.has('users')) throw new Error('users table missing');

const preserve = new Set([
  'd1_migrations',
  'colorings',
  'pilot_chats',
  'restored_opportunities',
  'v5_campaign_chats',
]);

const targets = new Set(
  rows
    .map((row) => row.name)
    .filter((name) => !preserve.has(name))
    .filter((name) => !name.startsWith('_cf_'))
    .filter((name) => !/migration/i.test(name))
);

if (!targets.has('users')) throw new Error('users unexpectedly excluded from reset');

const refs = new Map();
for (const [name, sql] of byName) {
  if (!targets.has(name)) continue;
  const parents = new Set();
  const re = /REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/gi;
  for (const m of sql.matchAll(re)) {
    const parent = m[1] || m[2] || m[3] || m[4];
    if (targets.has(parent) && parent !== name) parents.add(parent);
  }
  refs.set(name, parents);
}

const indegree = new Map([...targets].map((name) => [name, 0]));
for (const parents of refs.values()) {
  for (const parent of parents) indegree.set(parent, (indegree.get(parent) || 0) + 1);
}
const queue = [...targets].filter((name) => indegree.get(name) === 0).sort();
const order = [];
while (queue.length) {
  const child = queue.shift();
  order.push(child);
  for (const parent of refs.get(child) || []) {
    indegree.set(parent, indegree.get(parent) - 1);
    if (indegree.get(parent) === 0) {
      queue.push(parent);
      queue.sort();
    }
  }
}
for (const name of [...targets].sort()) if (!order.includes(name)) order.push(name);

let sql = "PRAGMA foreign_keys=ON;\n";
if (byName.has('v5_campaign_chats') && targets.has('v5_campaigns')) {
  sql += "UPDATE v5_campaign_chats SET campaign_id=NULL, status='draft', next_event_at=NULL, armed_at=NULL, paused_at=NULL, updated_at=datetime('now');\n";
}
for (const name of order) {
  const q = '"' + name.replaceAll('"', '""') + '"';
  sql += `DELETE FROM ${q};\n`;
}
fs.writeFileSync('/tmp/kontur-production-reset.sql', sql);

const selects = order.map((name) => {
  const q = '"' + name.replaceAll('"', '""') + '"';
  const lit = name.replaceAll("'", "''");
  return `SELECT '${lit}' AS table_name, COUNT(*) AS rows FROM ${q}`;
});
fs.writeFileSync('/tmp/kontur-production-reset-verify.sql', selects.join('\nUNION ALL\n') + ';\n');
fs.writeFileSync('/tmp/kontur-production-reset-targets.json', JSON.stringify(order));
console.log(`PRODUCTION_RESET_PLAN_PASS tables=${order.length}`);
NODE

# This is the single owner-authorized destructive production write.
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --file /tmp/kontur-production-reset.sql

# Prove every mutable table selected above is now empty.
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json --file /tmp/kontur-production-reset-verify.sql \
  > /tmp/kontur-production-reset-verify.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync('/tmp/kontur-production-reset-verify.json', 'utf8'));
const found = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (typeof value.table_name === 'string' && Number.isInteger(value.rows)) found.push(value);
  Object.values(value).forEach(visit);
};
visit(raw);
const targets = JSON.parse(fs.readFileSync('/tmp/kontur-production-reset-targets.json', 'utf8'));
const counts = new Map(found.map((row) => [row.table_name, row.rows]));
for (const table of targets) {
  if (!counts.has(table)) throw new Error(`reset verification missing table ${table}`);
  if (counts.get(table) !== 0) throw new Error(`reset verification nonzero ${table}=${counts.get(table)}`);
}
console.log(`PRODUCTION_RESET_EMPTY_PASS tables=${targets.length}`);
NODE

# Static seeds/config must survive.
pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
  --remote --config wrangler.jsonc --json \
  --command "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities" \
  > /tmp/kontur-reset-after.json

node --input-type=module <<'NODE'
import fs from 'node:fs';
const records = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (Number.isInteger(value.users) && Number.isInteger(value.colorings) && Number.isInteger(value.opportunities)) records.push(value);
  Object.values(value).forEach(visit);
};
visit(JSON.parse(fs.readFileSync('/tmp/kontur-reset-after.json', 'utf8')));
const r = records[0];
if (!r) throw new Error('post-reset aggregate result missing');
if (r.users !== 0) throw new Error(`users remain after reset: ${r.users}`);
if (r.colorings <= 0) throw new Error('coloring catalog was erased');
if (r.opportunities <= 0) throw new Error('opportunity catalog was erased');
console.log(`PRODUCTION_RESET_SEEDS_PASS colorings=${r.colorings} opportunities=${r.opportunities}`);
NODE

# Live production must still serve normally after the reset.
curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_reset_probe=20260822" \
  > /tmp/kontur-reset-health.json
node --input-type=module <<'NODE'
import fs from 'node:fs';
const h = JSON.parse(fs.readFileSync('/tmp/kontur-reset-health.json', 'utf8'));
if (h.ok !== true || h.devMode !== false || h.driver !== 'd1') throw new Error('production health mismatch after reset');
console.log('PRODUCTION_RESET_HEALTH_PASS');
NODE

api_code="$(curl -sS -o /tmp/kontur-reset-api.txt -w '%{http_code}' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v4/local/state?kontur_reset_probe=20260822")"
test "$api_code" = '401'
webhook_code="$(curl -sS -o /tmp/kontur-reset-webhook.txt -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{"update_id":1}' \
  "$CLOUDFLARE_PROD_ORIGIN/telegram/webhook")"
test "$webhook_code" = '403'

echo 'PRODUCTION_USER_DATA_RESET_PASS users=0'
echo 'PRODUCTION_RESET_API_BOUNDARY_PASS'
echo 'PRODUCTION_RESET_TELEGRAM_BOUNDARY_PASS'

# Preserve the normal isolated staging build output expected by Workers Builds.
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
