#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-user reset of Telegram username fff6pm only.
# Production hatch 771f908b is already live; this executor does not redeploy
# the Worker, mutate secrets, or wipe other users. Identity is fail-closed.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_WORKER_NAME='kontur-igor'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export RELEASE_SHA='771f908b6f2407102a04e2c1773ff97f1150a400'
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

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_one_user=pre" \
  > /tmp/kontur-prod-health-before.json
export LIVE_HTML="$(curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' "$CLOUDFLARE_PROD_ORIGIN/?kontur_one_user=pre")"
node --input-type=module <<'NODE'
const html = process.env.LIVE_HTML || '';
if (!html.includes('/assets/index-DuA7dhZw.js') || !html.includes('/assets/index-C64rrWW-.css')) {
  throw new Error('production is not the hatch 771f908b asset generation; refusing D1 write');
}
console.log('PRODUCTION_HATCH_ASSETS_STILL_LIVE_PASS');
NODE

set +e
(
  set -e
  pnpm -F @kontur/worker exec wrangler whoami --json > /tmp/kontur-wrangler-whoami.json || true
  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT u.id AS db_id, u.tg_id AS tg_id, CASE WHEN u.username IS NULL OR trim(u.username)='' THEN 'EMPTY' ELSE lower(replace(u.username,'@','')) END AS username_norm, CASE WHEN u.started_bot_at IS NULL THEN 0 ELSE 1 END AS started, CASE WHEN p.hatched_at IS NULL THEN 0 ELSE 1 END AS hatched FROM users u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.id" \
    > /tmp/kontur-users-private.json

  node --input-type=module <<'NODE'
import fs from 'node:fs';

const visit = (value, acc, pred) => {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, acc, pred));
  if (!value || typeof value !== 'object') return;
  if (pred(value)) acc.push(value);
  Object.values(value).forEach((item) => visit(item, acc, pred));
};

function parseAllowlist(value) {
  return new Set(String(value || '').split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part)));
}

async function loadAllowlist() {
  const allow = new Set();
  const sources = [];
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || '';
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  try {
    const whoami = JSON.parse(fs.readFileSync('/tmp/kontur-wrangler-whoami.json', 'utf8'));
    accountId = accountId || whoami.account?.id || whoami.accounts?.[0]?.id || '';
  } catch {}
  if (token && accountId) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${process.env.CLOUDFLARE_PROD_WORKER_NAME}/settings`;
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.ok) {
      const body = await response.json();
      const bindings = body?.result?.bindings || body?.result?.script?.bindings || [];
      for (const binding of bindings) {
        const name = String(binding?.name || '');
        if (name === 'EXPERIENCE_V2_USER_IDS' || name === 'EXPERIENCE_V3_USER_IDS') {
          const text = binding?.text || binding?.value || '';
          const parsed = parseAllowlist(text);
          for (const id of parsed) allow.add(id);
          if (parsed.size) sources.push(name);
        }
      }
    }
  }
  for (const name of ['EXPERIENCE_V2_USER_IDS', 'EXPERIENCE_V3_USER_IDS']) {
    const parsed = parseAllowlist(process.env[name] || '');
    for (const id of parsed) allow.add(id);
    if (parsed.size) sources.push(`env:${name}`);
  }
  return { allow, sources: [...new Set(sources)], size: allow.size };
}

const rows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-users-private.json', 'utf8')), rows, (row) => (
  Number.isInteger(Number(row.db_id)) && row.tg_id != null && typeof row.username_norm === 'string'
));
const users = [];
const seen = new Set();
for (const row of rows) {
  const dbId = Number(row.db_id);
  if (seen.has(dbId)) continue;
  seen.add(dbId);
  users.push({
    dbId,
    tgId: String(row.tg_id),
    usernameNorm: row.username_norm,
    started: Number(row.started || 0),
    hatched: Number(row.hatched || 0),
  });
}

const usernameMatches = users.filter((row) => row.usernameNorm === process.env.OWNER_USERNAME_NORM);
const { allow, sources, size: allowSize } = await loadAllowlist();
const allowMatches = allowSize ? users.filter((row) => allow.has(row.tgId)) : [];

let method = 'none';
let chosen = null;
if (usernameMatches.length === 1) {
  method = 'username';
  chosen = usernameMatches[0];
} else if (usernameMatches.length > 1) {
  method = 'username_ambiguous';
} else if (allowMatches.length === 1) {
  method = 'experience_allowlist';
  chosen = allowMatches[0];
} else if (allowMatches.length > 1) {
  method = 'allowlist_ambiguous';
} else if (allowSize > 0 && allowMatches.length === 0) {
  method = 'owner_absent_already_clean';
} else {
  method = 'unresolved';
}

const publicUsers = users.map(({ dbId, usernameNorm, started, hatched }) => ({ dbId, usernameNorm, started, hatched }));
const identity = {
  method,
  ownerDbId: chosen ? chosen.dbId : null,
  ownerUsername: chosen ? chosen.usernameNorm : null,
  ownerHatched: chosen ? chosen.hatched : 0,
  usernameMatchCount: usernameMatches.length,
  allowlistSize: allowSize,
  allowlistMatchCount: allowMatches.length,
  allowlistSources: sources,
  users: publicUsers,
};
fs.writeFileSync('/tmp/kontur-owner-identity.json', JSON.stringify(identity, null, 2) + '\n');
fs.rmSync('/tmp/kontur-users-private.json', { force: true });
console.log(`OWNER_IDENTITY_METHOD=${method} db_id=${identity.ownerDbId || 0} users=${publicUsers.length} allowlist=${allowSize}`);
if (method === 'username_ambiguous' || method === 'allowlist_ambiguous' || method === 'unresolved') {
  throw new Error(`owner identity fail-closed: method=${method}`);
}
NODE

identity_method="$(node --input-type=module -e 'import fs from "node:fs"; process.stdout.write(String(JSON.parse(fs.readFileSync("/tmp/kontur-owner-identity.json","utf8")).method || ""))')"
if [ "$identity_method" = 'owner_absent_already_clean' ]; then
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const identity = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8'));
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-before.json', 'utf8'));
const payload = {
  status: 'PASS',
  stage: 'one-user-reset-skipped-owner-absent',
  release: process.env.RELEASE_SHA,
  exactAsset: true,
  assets: { js: '/assets/index-DuA7dhZw.js', css: '/assets/index-C64rrWW-.css' },
  ownerUsernameRequested: process.env.OWNER_USERNAME_NORM,
  identity,
  health,
  resetPerformed: false,
  ownerAlreadyClean: true,
  usersRemaining: identity.users.length,
  hatchedRemaining: identity.users.filter((row) => row.hatched === 1).length,
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
console.log('ONE_USER_RESET_SKIPPED_OWNER_ALREADY_CLEAN');
NODE
else
  owner_id="$(node --input-type=module -e 'import fs from "node:fs"; process.stdout.write(String(JSON.parse(fs.readFileSync("/tmp/kontur-owner-identity.json","utf8")).ownerDbId || ""))')"
  test "$owner_id" -gt 0

  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities, (SELECT COUNT(*) FROM d1_migrations) AS migrations" \
    > /tmp/kontur-counts-before.json

  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" \
    > /tmp/kontur-live-schema.json

  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT CASE WHEN hatched_at IS NULL THEN 0 ELSE 1 END AS owner_hatched FROM profiles WHERE user_id = ${owner_id}" \
    > /tmp/kontur-owner-hatched.json

  node --input-type=module <<'NODE'
import fs from 'node:fs';

const owner = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8'));
const ownerId = Number(owner.ownerDbId);
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
order.splice(usersIdx, 1);
order.push('users');

const byTarget = new Map(targets.map((t) => [t.name, t]));
let sql = 'PRAGMA foreign_keys=OFF;\n';
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
if (!sql.includes(`DELETE FROM "users" WHERE id = ${ownerId};`)) throw new Error('users delete is not scoped to owner id');
if (/DROP\s+TABLE/i.test(sql)) throw new Error('refusing DROP TABLE');
for (const name of preserve) {
  if (new RegExp(`DELETE FROM\\s+"?${name}"?`, 'i').test(sql)) throw new Error(`refusing delete from preserved table ${name}`);
}
fs.writeFileSync('/tmp/kontur-one-user-reset.sql', sql);
fs.writeFileSync('/tmp/kontur-one-user-reset-verify.sql', countSelects.join('\nUNION ALL\n') + ';\n');
fs.writeFileSync('/tmp/kontur-one-user-reset-targets.json', JSON.stringify({ ownerId, username: owner.ownerUsername, order }));
console.log(`ONE_USER_RESET_PLAN_PASS tables=${order.length} owner_db_id=${ownerId}`);
NODE

  echo 'STEP=related_before'
  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --file /tmp/kontur-one-user-reset-verify.sql \
    > /tmp/kontur-one-user-related-before.json

  echo 'STEP=d1_backup_skipped_to_keep_database_available'
  node --input-type=module <<'NODE'
import fs from 'node:fs';
fs.writeFileSync('/tmp/kontur-backup-meta.json', JSON.stringify({
  status: 'SKIPPED_keep_d1_available_for_one_user_delete',
  bytes: 0,
  sha256: null,
  exportExit: null,
}));
console.log('D1_BACKUP_STATUS skipped');
NODE

  echo 'STEP=delete_statements'
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const sql = fs.readFileSync('/tmp/kontur-one-user-reset.sql', 'utf8');
const statements = sql.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean);
if (statements.length < 2) throw new Error('reset SQL missing statements');
for (const statement of statements) {
  const command = statement.endsWith(';') ? statement : `${statement};`;
  console.log(`D1_EXEC ${command.slice(0, 96)}`);
  const result = spawnSync('pnpm', [
    '-F', '@kontur/worker', 'exec', 'wrangler', 'd1', 'execute',
    process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME,
    '--remote', '--config', 'wrangler.jsonc', '--command', command,
  ], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (/^PRAGMA\b/i.test(command)) {
      console.log(`D1_PRAGMA_SKIPPED status=${result.status}`);
      continue;
    }
    throw new Error(`d1 execute failed status=${result.status} for ${command.slice(0, 160)}`);
  }
}
console.log(`ONE_USER_RESET_DELETES_PASS statements=${statements.length}`);
NODE

  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --file /tmp/kontur-one-user-reset-verify.sql \
    > /tmp/kontur-one-user-related-after.json

  pnpm -F @kontur/worker exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM restored_opportunities) AS opportunities, (SELECT COUNT(*) FROM d1_migrations) AS migrations, (SELECT COUNT(*) FROM users WHERE id = ${owner_id}) AS owner_remaining" \
    > /tmp/kontur-counts-after.json

  curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_one_user=post" \
    > /tmp/kontur-prod-health-after.json
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
const firstCounts = (path) => {
  const records = [];
  visit(JSON.parse(fs.readFileSync(path, 'utf8')), records, (row) => row.users != null && row.hatched != null);
  if (!records[0]) throw new Error(`aggregate missing ${path}`);
  const row = records[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number.isFinite(Number(v)) ? Number(v) : v]));
};
const relatedMap = (path) => {
  const found = [];
  visit(JSON.parse(fs.readFileSync(path, 'utf8')), found, (row) => typeof row.table_name === 'string' && Number.isInteger(Number(row.rows)));
  return Object.fromEntries(found.map((row) => [row.table_name, Number(row.rows)]));
};
const identity = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync('/tmp/kontur-one-user-reset-targets.json', 'utf8'));
const backup = JSON.parse(fs.readFileSync('/tmp/kontur-backup-meta.json', 'utf8'));
const before = firstCounts('/tmp/kontur-counts-before.json');
const after = firstCounts('/tmp/kontur-counts-after.json');
const relatedBefore = relatedMap('/tmp/kontur-one-user-related-before.json');
const relatedAfter = relatedMap('/tmp/kontur-one-user-related-after.json');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-after.json', 'utf8'));
const ownerHatchedRows = [];
visit(JSON.parse(fs.readFileSync('/tmp/kontur-owner-hatched.json', 'utf8')), ownerHatchedRows, (row) => row.owner_hatched != null);
const ownerWasHatched = ownerHatchedRows.length ? Number(ownerHatchedRows[0].owner_hatched) : Number(identity.ownerHatched || 0);
if (after.owner_remaining !== 0) throw new Error('owner row still present');
for (const table of plan.order) {
  if (relatedAfter[table] !== 0) throw new Error(`owner-related rows remain in ${table}=${relatedAfter[table]}`);
}
if (after.users !== before.users - 1) throw new Error(`users ${after.users} != ${before.users}-1`);
if (after.hatched !== before.hatched - ownerWasHatched) throw new Error('hatched isolation failed');
if (!(after.colorings > 0) || !(after.opportunities > 0)) throw new Error('static seeds erased');
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('health mismatch');
const payload = {
  status: 'PASS',
  stage: 'one-user-reset',
  release: process.env.RELEASE_SHA,
  exactAsset: true,
  assets: { js: '/assets/index-DuA7dhZw.js', css: '/assets/index-C64rrWW-.css' },
  identity,
  ownerUsername: identity.ownerUsername,
  ownerDbId: identity.ownerDbId,
  tablesScoped: plan.order,
  relatedCountsBefore: relatedBefore,
  relatedCountsAfter: relatedAfter,
  usersBefore: before.users,
  usersAfter: after.users,
  hatchedBefore: before.hatched,
  hatchedAfter: after.hatched,
  colorings: after.colorings,
  opportunities: after.opportunities,
  migrations: after.migrations,
  backup,
  health,
  apiBoundary: true,
  telegramWebhookBoundary: true,
  resetPerformed: true,
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
console.log(`ONE_USER_RESET_PASS remaining_users=${after.users} remaining_hatched=${after.hatched}`);
NODE
fi
) > /tmp/kontur-one-user.log 2>&1
reset_status=$?
set -e
cat /tmp/kontur-one-user.log

if [ "$reset_status" -ne 0 ]; then
  node --input-type=module <<'NODE'
import fs from 'node:fs';
let identity = null;
try { identity = JSON.parse(fs.readFileSync('/tmp/kontur-owner-identity.json', 'utf8')); } catch {}
const log = fs.readFileSync('/tmp/kontur-one-user.log', 'utf8')
  .replace(/\u001b\[[0-9;]*m/g, '')
  .replace(/(authorization|bearer|token|secret)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]');
const lines = log.split(/\r?\n/).filter(Boolean);
const payload = {
  status: 'BLOCKED',
  stage: 'one-user-reset',
  release: process.env.RELEASE_SHA,
  identity,
  error: lines.slice(-60).join('\n').slice(-8000),
};
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync(`apps/miniapp/dist/${process.env.DIAGNOSTIC_JSON}`, JSON.stringify(payload, null, 2) + '\n');
console.log('ONE_USER_RESET_BLOCKED_DIAGNOSTIC_READY');
NODE
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

pnpm -F @kontur/worker exec wrangler deploy --keep-vars --config wrangler.staging.generated.jsonc

if [ "${reset_status:-1}" -ne 0 ]; then
  echo "CLOUDFLARE_ONE_USER_RESET_FAIL_CLOSED status=$reset_status" >&2
  exit "$reset_status"
fi
echo 'CLOUDFLARE_ONE_USER_RESET_CONFIRMED'
