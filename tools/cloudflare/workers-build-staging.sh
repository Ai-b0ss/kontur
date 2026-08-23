#!/usr/bin/env bash
set -euo pipefail

# Self-contained one-shot 2026-08-23. Proven 67ce harness inlined (not fetched).
# Deploy exact 289ef82f to existing Worker kontur-igor with --keep-vars.
# Then fail-closed FK-safe reset of username fff6pm only.
# No global D1 wipe, no schema/migration/secret/webhook/main mutation.
# NONCE=20260823-289ef82f-fff6pm-inline-harness


# Owner-authorized one-shot 2026-08-22:
# 1) deploy exact PR #21 head to production kontur-igor (--keep-vars)
# 2) prove exact asset convergence + health
# 3) FK-safe ONE-USER reset of username igorekglukhovskii43 only
# No global D1 reset, no schema/migration/secret/webhook/main changes.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_WORKER_NAME='kontur-igor'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export RELEASE_SHA='289ef82f76536aa05b2efab59400e80bcb94d50a'
export OWNER_USERNAME_NORM='fff6pm'
export DIAGNOSTIC_JSON='cloudflare-production-hatch-289ef82f.json'
release_dir='/tmp/kontur-production-289ef82f'

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

write_diagnostic() {
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const payload = JSON.parse(fs.readFileSync('/tmp/kontur-diagnostic-payload.json', 'utf8'));
const path = `apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`;
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(path, JSON.stringify(payload, null, 2) + '\n');
console.log(`DIAGNOSTIC_JSON_READY path=${path} status=${payload.status || 'UNKNOWN'}`);
NODE
}

sanitize_log() {
  local src="$1"
  SANITIZE_SRC="$src" node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.SANITIZE_SRC, 'utf8')
  .replace(/\u001b\[[0-9;]*m/g, '')
  .replace(/(authorization|bearer|token|secret)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]');
const lines = raw.split(/\r?\n/).filter(Boolean);
const relevant = lines.filter((line) => /error|code|permission|auth|forbidden|unauthorized|failed|fail|blocked/i.test(line));
const text = (relevant.length ? relevant : lines.slice(-40)).slice(-40).join('\n').slice(-6000);
fs.writeFileSync('/tmp/kontur-sanitized-error.txt', text);
process.stdout.write(text);
NODE
}

run_production_hatch_release_and_owner_reset() {
  pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw=fs.readFileSync('/tmp/kontur-prod-d1-info.json','utf8');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if(raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('CLOUDFLARE_PROD_D1_READONLY_AUTH_PASS');
NODE

  rm -rf "$release_dir"
  mkdir -p "$release_dir"
  git fetch --no-tags --depth=1 origin "cursor/hatch-product-289ef82f-1021"
  test "$(git rev-parse --verify 'FETCH_HEAD^{commit}')" = "$RELEASE_SHA"
  git archive "$RELEASE_SHA" | tar -x -C "$release_dir"

  (
    cd "$release_dir"
    pnpm install --frozen-lockfile
    pnpm -F @kontur/miniapp test
    pnpm -F @kontur/worker test
    pnpm typecheck
    pnpm build
  )

  node --input-type=module <<'NODE'
import fs from 'node:fs';
const configText = fs.readFileSync('/tmp/kontur-production-289ef82f/apps/worker/wrangler.jsonc', 'utf8').replace(/^\uFEFF/, '');
const config = JSON.parse(configText);
if (config.name !== process.env.CLOUDFLARE_PROD_WORKER_NAME) throw new Error('production Worker identity mismatch');
const db = (config.d1_databases || []).find((item) => item?.binding === 'DB');
if (!db || db.database_name !== process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME || db.database_id !== process.env.CLOUDFLARE_PROD_D1_DATABASE_ID) {
  throw new Error('production D1 binding mismatch');
}
if (db.database_id === process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID) throw new Error('staging D1 leaked into production config');
if (config.assets?.directory !== '../miniapp/dist') throw new Error('production assets directory mismatch');
const html = fs.readFileSync('/tmp/kontur-production-289ef82f/apps/miniapp/dist/index.html', 'utf8');
const js = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
const css = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
if (!js || !css) throw new Error('release dist index.html missing hashed assets');
fs.writeFileSync('/tmp/kontur-release-expected-assets.json', JSON.stringify({ js: js[0], css: css[0] }));
console.log(`CLOUDFLARE_PRODUCTION_TARGET_PASS js=${js[0]} css=${css[0]}`);
NODE

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants" \
      > /tmp/kontur-prod-counts-before-deploy.json
  )

  set +e
  (
    cd "$release_dir/apps/worker"
    env -u WRANGLER_CI_OVERRIDE_NAME -u WRANGLER_CI_MATCH_TAG -u CLOUDFLARE_WORKER_NAME -u CLOUDFLARE_ENV \
      pnpm exec wrangler deploy \
        --name "$CLOUDFLARE_PROD_WORKER_NAME" \
        --keep-vars \
        --config wrangler.jsonc
  ) > /tmp/kontur-production-deploy.log 2>&1
  deploy_status=$?
  set -e

  if [ "$deploy_status" -ne 0 ]; then
    cat /tmp/kontur-production-deploy.log >&2
    sanitize_log /tmp/kontur-production-deploy.log >/dev/null
    ERROR_TEXT="$(cat /tmp/kontur-sanitized-error.txt)" \
    node --input-type=module <<'NODE'
import fs from 'node:fs';
fs.writeFileSync('/tmp/kontur-diagnostic-payload.json', JSON.stringify({
  status: 'BLOCKED',
  stage: 'production-deploy',
  release: process.env.RELEASE_SHA,
  error: process.env.ERROR_TEXT,
}, null, 2) + '\n');
NODE
    write_diagnostic
    return "$deploy_status"
  fi

  cat /tmp/kontur-production-deploy.log
  (
    cd "$release_dir"
    RELEASE_ORIGIN="$CLOUDFLARE_PROD_ORIGIN" \
    RELEASE_PROPAGATION_TIMEOUT_MS='180000' \
      node tools/cloudflare/wait-for-deployed-assets.mjs \
      | tee /tmp/kontur-asset-wait.log
  )

  curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_release_probe=$RELEASE_SHA" \
    > /tmp/kontur-prod-health-deploy.json
  api_code="$(curl -sS -o /tmp/kontur-prod-unauth.json -w '%{http_code}' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v4/local/state?kontur_release_probe=$RELEASE_SHA")"
  test "$api_code" = '401'
  webhook_code="$(curl -sS -o /tmp/kontur-prod-webhook-boundary.txt -w '%{http_code}' \
    -X POST -H 'content-type: application/json' \
    --data '{"update_id":1}' \
    "$CLOUDFLARE_PROD_ORIGIN/telegram/webhook")"
  test "$webhook_code" = '403'

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants" \
      > /tmp/kontur-prod-counts-after-deploy.json
  )

  node --input-type=module <<'NODE'
import fs from 'node:fs';
const firstCounts = (path) => {
  const records = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (Number.isInteger(value.users) && Number.isInteger(value.hatched)) records.push(value);
      Object.values(value).forEach(visit);
    }
  };
  visit(JSON.parse(fs.readFileSync(path, 'utf8')));
  if (!records[0]) throw new Error(`aggregate D1 counts missing: ${path}`);
  return records[0];
};
const before = firstCounts('/tmp/kontur-prod-counts-before-deploy.json');
const after = firstCounts('/tmp/kontur-prod-counts-after-deploy.json');
if (after.users < before.users || after.hatched < before.hatched) throw new Error('production user data count decreased during deploy');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-deploy.json', 'utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('production health mismatch after deploy');
const liveHtml = await fetch(`${process.env.CLOUDFLARE_PROD_ORIGIN}/?kontur_release_probe=${process.env.RELEASE_SHA}`, {
  headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
  cache: 'no-store',
}).then((r) => r.text());
const expected = JSON.parse(fs.readFileSync('/tmp/kontur-release-expected-assets.json', 'utf8'));
if (!liveHtml.includes(expected.js) || !liveHtml.includes(expected.css)) {
  throw new Error(`live HTML missing expected assets ${expected.js} ${expected.css}`);
}
fs.writeFileSync('/tmp/kontur-deploy-proof.json', JSON.stringify({
  status: 'PASS',
  users: after.users,
  hatched: after.hatched,
  grants: after.grants ?? null,
  js: expected.js,
  css: expected.css,
}));
console.log(`PRODUCTION_DEPLOY_PASS release=${process.env.RELEASE_SHA}`);
console.log(`EXACT_ASSET_PASS js=${expected.js} css=${expected.css}`);
console.log('HEALTH_PASS');
console.log(`DATA_PRESERVED_PASS users=${after.users} hatched=${after.hatched}`);
console.log('API_BOUNDARY_PASS');
console.log('TELEGRAM_WEBHOOK_BOUNDARY_PASS');
NODE

  echo 'PRODUCTION_DEPLOY_CONFIRMED_BEGIN_ONE_USER_RESET'

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" \
      > /tmp/kontur-live-schema.json
  )

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT id, lower(replace(coalesce(username,''),'@','')) AS username_norm, CASE WHEN started_bot_at IS NULL THEN 0 ELSE 1 END AS started FROM users WHERE lower(replace(coalesce(username,''),'@','')) = '${OWNER_USERNAME_NORM}'" \
      > /tmp/kontur-owner-match.json
  )

  node --input-type=module <<'NODE'
import fs from 'node:fs';

const visit = (value, acc, pred) => {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, acc, pred));
  if (!value || typeof value !== 'object') return;
  if (pred(value)) acc.push(value);
  Object.values(value).forEach((item) => visit(item, acc, pred));
};

const ownerRows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-owner-match.json', 'utf8')), ownerRows, (row) => {
  const id = Number(row.id);
  return Number.isInteger(id) && id > 0 && row.username_norm === process.env.OWNER_USERNAME_NORM;
});
if (ownerRows.length !== 1) {
  fs.writeFileSync('/tmp/kontur-owner-identity.json', JSON.stringify({
    status: 'BLOCKED',
    reason: 'owner_username_not_unique',
    matchCount: ownerRows.length,
  }));
  throw new Error(`owner identity fail-closed: expected 1 row for ${process.env.OWNER_USERNAME_NORM}, got ${ownerRows.length}`);
}
const owner = ownerRows[0];
const ownerId = Number(owner.id);
fs.writeFileSync('/tmp/kontur-owner-identity.json', JSON.stringify({
  id: ownerId,
  username: owner.username_norm,
  started: Number(owner.started ?? 0),
}));
console.log(`OWNER_IDENTITY_PASS username=${owner.username_norm} db_id=${ownerId}`);
NODE

  owner_id="$(node -p "JSON.parse(require('fs').readFileSync('/tmp/kontur-owner-identity.json','utf8')).id")"
  test "$owner_id" -gt 0

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT CASE WHEN hatched_at IS NULL THEN 0 ELSE 1 END AS owner_hatched FROM profiles WHERE user_id = ${owner_id}" \
      > /tmp/kontur-owner-hatched.json
  )

  node --input-type=module <<'NODE'
import fs from 'node:fs';

const owner = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8'));
const ownerId = owner.id;
const preserve = new Set([
  'd1_migrations',
  'colorings',
  'pilot_chats',
  'restored_opportunities',
  'v5_campaign_chats',
]);
const namedUserCols = new Set([
  'user_id',
  'from_user_id',
  'to_user_id',
  'visitor_id',
  'host_id',
  'requester_user_id',
  'helper_user_id',
]);

const schemaRows = [];
const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (typeof value.name === 'string' && typeof value.sql === 'string') schemaRows.push({ name: value.name, sql: value.sql });
  Object.values(value).forEach(visit);
};
visit(JSON.parse(fs.readFileSync('/tmp/kontur-live-schema.json', 'utf8')));
const byName = new Map(schemaRows.map((row) => [row.name, row.sql]));
if (!byName.has('users')) throw new Error('users table missing');

function tableColumns(sql) {
  const open = sql.indexOf('(');
  if (open < 0) return [];
  let depth = 0;
  let current = '';
  const parts = [];
  for (let i = open; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === '(') {
      depth += 1;
      if (depth === 1) continue;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        parts.push(current);
        break;
      }
    } else if (ch === ',' && depth === 1) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  const cols = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)/i.test(trimmed)) continue;
    const m = trimmed.match(/^["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/);
    if (m) cols.push({ name: m[1], def: trimmed });
  }
  return cols;
}

function qIdent(name) {
  return '"' + String(name).replaceAll('"', '""') + '"';
}

const targets = [];
for (const [name, sql] of byName) {
  if (preserve.has(name) || name.startsWith('_cf_') || /migration/i.test(name)) continue;
  const cols = tableColumns(sql);
  const bound = cols
    .filter((col) => namedUserCols.has(col.name.toLowerCase()) || /REFERENCES\s+(?:["'`]users["'`]|users)\b/i.test(col.def))
    .map((col) => col.name);
  const uniqueBound = [...new Set(bound)];
  if (name === 'users') {
    targets.push({ name, columns: ['id'] });
    continue;
  }
  if (uniqueBound.length) targets.push({ name, columns: uniqueBound });
}

if (!targets.some((t) => t.name === 'users')) throw new Error('users missing from one-user plan');

const targetNames = new Set(targets.map((t) => t.name));
const refs = new Map(targets.map((t) => [t.name, new Set()]));
for (const t of targets) {
  const sql = byName.get(t.name) || '';
  const re = /REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/gi;
  for (const m of sql.matchAll(re)) {
    const parent = m[1] || m[2] || m[3] || m[4];
    if (targetNames.has(parent) && parent !== t.name) refs.get(t.name).add(parent);
  }
}

const indegree = new Map([...targetNames].map((name) => [name, 0]));
for (const parents of refs.values()) {
  for (const parent of parents) indegree.set(parent, (indegree.get(parent) || 0) + 1);
}
const queue = [...targetNames].filter((name) => indegree.get(name) === 0).sort();
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
for (const name of [...targetNames].sort()) if (!order.includes(name)) order.push(name);
const usersIdx = order.indexOf('users');
if (usersIdx < 0) throw new Error('users missing from delete order');
order.splice(usersIdx, 1);
order.push('users');

const byTarget = new Map(targets.map((t) => [t.name, t]));
let sql = 'PRAGMA foreign_keys=ON;\n';
const countSelects = [];
for (const name of order) {
  const target = byTarget.get(name);
  const ident = qIdent(name);
  if (name === 'users') {
    sql += `DELETE FROM ${ident} WHERE id = ${ownerId};\n`;
    countSelects.push(`SELECT 'users' AS table_name, COUNT(*) AS rows FROM ${ident} WHERE id = ${ownerId}`);
    continue;
  }
  const where = target.columns.map((col) => `${qIdent(col)} = ${ownerId}`).join(' OR ');
  sql += `DELETE FROM ${ident} WHERE ${where};\n`;
  countSelects.push(`SELECT '${name.replaceAll("'", "''")}' AS table_name, COUNT(*) AS rows FROM ${ident} WHERE ${where}`);
}

if (/DELETE FROM\s+"?users"?\s*;/i.test(sql)) throw new Error('refusing unfiltered users delete');
if (!sql.includes(`DELETE FROM "users" WHERE id = ${ownerId};`) && !sql.includes(`DELETE FROM users WHERE id = ${ownerId};`)) {
  throw new Error('users delete is not scoped to owner id');
}
if (/DROP\s+TABLE/i.test(sql)) throw new Error('refusing DROP TABLE');
for (const name of preserve) {
  if (new RegExp(`DELETE FROM\\s+"?${name}"?`, 'i').test(sql)) throw new Error(`refusing delete from preserved table ${name}`);
}
if (/DELETE FROM\s+"?cron_log"?\s*;/i.test(sql)) throw new Error('refusing global cron_log wipe');

fs.writeFileSync('/tmp/kontur-one-user-reset.sql', sql);
fs.writeFileSync('/tmp/kontur-one-user-reset-verify.sql', countSelects.join('\nUNION ALL\n') + ';\n');
fs.writeFileSync('/tmp/kontur-one-user-reset-targets.json', JSON.stringify({ ownerId, username: owner.username, order, targets }));
console.log(`ONE_USER_RESET_PLAN_PASS tables=${order.length} owner_db_id=${ownerId}`);
NODE

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --file /tmp/kontur-one-user-reset-verify.sql \
      > /tmp/kontur-one-user-related-before.json
  )

  set +e
  (
    cd "$release_dir/apps/worker"
    if command -v timeout >/dev/null 2>&1; then
      timeout 120 pnpm exec wrangler d1 export "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
        --remote --output /tmp/kontur-pre-one-user-reset.sql --skip-confirmation --config wrangler.jsonc
    else
      pnpm exec wrangler d1 export "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
        --remote --output /tmp/kontur-pre-one-user-reset.sql --skip-confirmation --config wrangler.jsonc
    fi
  ) > /tmp/kontur-d1-export.log 2>&1
  export EXPORT_STATUS=$?
  set -e
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
let backup = { status: 'UNKNOWN', bytes: 0, sha256: null, exportExit: Number(process.env.EXPORT_STATUS || 1) };
try {
  const bytes = fs.readFileSync('/tmp/kontur-pre-one-user-reset.sql');
  if (bytes.length > 0) {
    backup = {
      status: 'PASS',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      exportExit: 0,
    };
  }
} catch {
  backup.status = 'UNKNOWN_export_missing';
}
fs.writeFileSync('/tmp/kontur-backup-meta.json', JSON.stringify(backup));
console.log(`D1_BACKUP_STATUS ${JSON.stringify(backup)}`);
NODE

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --file /tmp/kontur-one-user-reset.sql
  )

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --file /tmp/kontur-one-user-reset-verify.sql \
      > /tmp/kontur-one-user-related-after.json
  )

  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities, (SELECT COUNT(*) FROM d1_migrations) AS migrations, (SELECT COUNT(*) FROM users WHERE lower(replace(coalesce(username,''),'@','')) = '${OWNER_USERNAME_NORM}') AS owner_remaining" \
      > /tmp/kontur-prod-counts-after-reset.json
  )

  curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_one_user_reset=$RELEASE_SHA" \
    > /tmp/kontur-prod-health-reset.json
  api_code="$(curl -sS -o /tmp/kontur-prod-unauth-reset.json -w '%{http_code}' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v4/local/state?kontur_one_user_reset=$RELEASE_SHA")"
  test "$api_code" = '401'
  webhook_code="$(curl -sS -o /tmp/kontur-prod-webhook-reset.txt -w '%{http_code}' \
    -X POST -H 'content-type: application/json' \
    --data '{"update_id":1}' \
    "$CLOUDFLARE_PROD_ORIGIN/telegram/webhook")"
  test "$webhook_code" = '403'

  node --input-type=module <<'NODE'
import fs from 'node:fs';

const visit = (value, acc, pred) => {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, acc, pred));
  if (!value || typeof value !== 'object') return;
  if (pred(value)) acc.push(value);
  Object.values(value).forEach((item) => visit(item, acc, pred));
};
const firstCounts = (path) => {
  const records = [];
  visit(JSON.parse(fs.readFileSync(path, 'utf8')), records, (row) => (
    Number.isInteger(Number(row.users)) && Number.isInteger(Number(row.hatched)) && row.users != null && row.hatched != null
  ));
  if (!records[0]) throw new Error(`aggregate missing ${path}`);
  const row = records[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' || (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) ? Number(v) : v]));
};
const relatedMap = (path) => {
  const found = [];
  visit(JSON.parse(fs.readFileSync(path, 'utf8')), found, (row) => typeof row.table_name === 'string' && Number.isInteger(Number(row.rows)));
  return Object.fromEntries(found.map((row) => [row.table_name, Number(row.rows)]));
};

const beforeDeploy = firstCounts('/tmp/kontur-prod-counts-before-deploy.json');
const afterDeploy = firstCounts('/tmp/kontur-prod-counts-after-deploy.json');
const afterReset = firstCounts('/tmp/kontur-prod-counts-after-reset.json');
const relatedBefore = relatedMap('/tmp/kontur-one-user-related-before.json');
const relatedAfter = relatedMap('/tmp/kontur-one-user-related-after.json');
const owner = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8'));
const ownerHatchedRows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-owner-hatched.json', 'utf8')), ownerHatchedRows, (row) => row.owner_hatched != null && Number.isInteger(Number(row.owner_hatched)));
const ownerWasHatched = ownerHatchedRows.length ? Number(ownerHatchedRows[0].owner_hatched) : 0;
const plan = JSON.parse(fs.readFileSync('/tmp/kontur-one-user-reset-targets.json', 'utf8'));
const backup = JSON.parse(fs.readFileSync('/tmp/kontur-backup-meta.json', 'utf8'));
const expected = JSON.parse(fs.readFileSync('/tmp/kontur-release-expected-assets.json', 'utf8'));
const healthDeploy = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-deploy.json', 'utf8'));
const healthReset = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-reset.json', 'utf8'));
const assetWait = fs.readFileSync('/tmp/kontur-asset-wait.log', 'utf8');
const assetMatch = assetWait.match(/DEPLOYED_ASSET_GENERATION_EXACT_PASS ({.*})/);
const assetProof = assetMatch ? JSON.parse(assetMatch[1]) : null;

if (afterReset.owner_remaining !== 0) throw new Error(`owner row still present: ${afterReset.owner_remaining}`);
for (const table of plan.order) {
  if (!Object.hasOwn(relatedAfter, table)) throw new Error(`owner-related after count missing for ${table}`);
  if (relatedAfter[table] !== 0) throw new Error(`owner-related rows remain in ${table}=${relatedAfter[table]}`);
}
if (afterReset.users !== beforeDeploy.users - 1) {
  throw new Error(`users after reset ${afterReset.users} != before ${beforeDeploy.users} minus owner`);
}
if (afterReset.hatched !== beforeDeploy.hatched - ownerWasHatched) {
  throw new Error(`hatched after reset ${afterReset.hatched} != before ${beforeDeploy.hatched} minus owner_hatched ${ownerWasHatched}`);
}
if (!(afterReset.colorings > 0)) throw new Error('coloring catalog was erased');
if (!(afterReset.opportunities > 0)) throw new Error('opportunity catalog was erased');
if (healthReset.ok !== true || healthReset.devMode !== false || healthReset.driver !== 'd1') {
  throw new Error('production health mismatch after one-user reset');
}

const payload = {
  status: 'PASS',
  stage: 'deploy-and-one-user-reset',
  release: process.env.RELEASE_SHA,
  worker: process.env.CLOUDFLARE_PROD_WORKER_NAME,
  origin: process.env.CLOUDFLARE_PROD_ORIGIN,
  exactAsset: true,
  assets: expected,
  assetProof,
  healthDeploy: { ok: healthDeploy.ok, devMode: healthDeploy.devMode, driver: healthDeploy.driver, startedBot: healthDeploy.startedBot, hatched: healthDeploy.hatched, grants: healthDeploy.grants },
  healthReset: { ok: healthReset.ok, devMode: healthReset.devMode, driver: healthReset.driver, startedBot: healthReset.startedBot, hatched: healthReset.hatched, grants: healthReset.grants },
  apiBoundary: true,
  telegramWebhookBoundary: true,
  d1PreservedExceptOwner: true,
  ownerUsername: owner.username,
  ownerDbId: owner.id,
  tablesScoped: plan.order,
  relatedCountsBefore: relatedBefore,
  relatedCountsAfter: relatedAfter,
  usersBefore: beforeDeploy.users,
  usersAfter: afterReset.users,
  hatchedBefore: beforeDeploy.hatched,
  hatchedAfter: afterReset.hatched,
  grantsBefore: beforeDeploy.grants ?? null,
  grantsAfter: afterReset.grants ?? null,
  colorings: afterReset.colorings,
  opportunities: afterReset.opportunities,
  migrations: afterReset.migrations,
  backup,
  ownerHatchedDelta: ownerWasHatched,
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
fs.writeFileSync('/tmp/kontur-final-proof.json', JSON.stringify(payload, null, 2) + '\n');
console.log('ONE_USER_RESET_PASS');
console.log(`REMAINING_USERS=${afterReset.users} REMAINING_HATCHED=${afterReset.hatched}`);
console.log('STATIC_SEEDS_PRESERVED_PASS');
console.log('POST_RESET_HEALTH_PASS');
console.log('POST_RESET_API_BOUNDARY_PASS');
console.log('POST_RESET_TELEGRAM_WEBHOOK_BOUNDARY_PASS');
NODE
}

set +e
(
  set -e
  run_production_hatch_release_and_owner_reset
) > /tmp/kontur-production-hatch-reset.log 2>&1
release_status=$?
set -e
cat /tmp/kontur-production-hatch-reset.log

if [ "$release_status" -ne 0 ]; then
  sanitize_log /tmp/kontur-production-hatch-reset.log >/dev/null
  ERROR_TEXT="$(cat /tmp/kontur-sanitized-error.txt)" node --input-type=module <<'NODE'
import fs from 'node:fs';
const extra = {};
for (const path of ['/tmp/kontur-deploy-proof.json', '/tmp/kontur-owner-identity.json', '/tmp/kontur-backup-meta.json']) {
  try { extra[path.replace('/tmp/', '')] = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
}
fs.writeFileSync('/tmp/kontur-diagnostic-payload.json', JSON.stringify({
  status: 'BLOCKED',
  stage: 'production-hatch-deploy-or-one-user-reset',
  release: process.env.RELEASE_SHA,
  error: process.env.ERROR_TEXT,
  partial: extra,
}, null, 2) + '\n');
NODE
  write_diagnostic
fi

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

pnpm -F @kontur/worker exec wrangler deploy \
  --keep-vars \
  --config wrangler.staging.generated.jsonc

if [ "$release_status" -ne 0 ]; then
  echo "CLOUDFLARE_PRODUCTION_HATCH_RESET_FAIL_CLOSED status=$release_status" >&2
  exit "$release_status"
fi

echo "CLOUDFLARE_PRODUCTION_HATCH_RESET_CONFIRMED release=$RELEASE_SHA"
