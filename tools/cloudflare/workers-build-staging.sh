#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-time production release. This staging Workers Build is
# only the credentialed executor: runtime bytes are extracted from RELEASE_SHA,
# while the lane's product/visual source is never deployed to production.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_WORKER_NAME='kontur-igor'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export RELEASE_SHA='b153d4c96a775484c0cfc3b454029f9e4dadaf75'
release_dir='/tmp/kontur-production-b153d4c9'

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

run_production_release() {
  # Prove the authenticated executor resolves the exact production D1. Read only.
  pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw=fs.readFileSync('/tmp/kontur-prod-d1-info.json','utf8');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if(raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('CLOUDFLARE_PROD_D1_READONLY_AUTH_PASS');
NODE

  # Extract, verify and build only the accepted runtime commit.
  rm -rf "$release_dir"
  mkdir -p "$release_dir"
  git fetch --no-tags --depth=1 origin "$RELEASE_SHA"
  test "$(git rev-parse FETCH_HEAD)" = "$RELEASE_SHA"
  git archive "$RELEASE_SHA" | tar -x -C "$release_dir"

  (
    cd "$release_dir"
    pnpm install --frozen-lockfile
    pnpm -F @kontur/miniapp test
    pnpm -F @kontur/worker test
    pnpm typecheck
    pnpm build
  )

  # Fail closed on Worker, D1 and assets identity before any production write.
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const configText = fs.readFileSync('/tmp/kontur-production-b153d4c9/apps/worker/wrangler.jsonc', 'utf8').replace(/^\uFEFF/, '');
const config = JSON.parse(configText);
if (config.name !== process.env.CLOUDFLARE_PROD_WORKER_NAME) throw new Error('production Worker identity mismatch');
const db = (config.d1_databases || []).find((item) => item?.binding === 'DB');
if (!db || db.database_name !== process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME || db.database_id !== process.env.CLOUDFLARE_PROD_D1_DATABASE_ID) {
  throw new Error('production D1 binding mismatch');
}
if (db.database_id === process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID) throw new Error('staging D1 leaked into production config');
if (config.assets?.directory !== '../miniapp/dist') throw new Error('production assets directory mismatch');
console.log('CLOUDFLARE_PRODUCTION_TARGET_PASS');
NODE

  # Read-only aggregate counts; no IDs or user rows leave Cloudflare.
  (
    cd "$release_dir/apps/worker"
    pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --remote --config wrangler.jsonc --json --command \
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched" \
      > /tmp/kontur-prod-counts-before.json
  )

  # The only production write: exact Worker/assets deploy. No D1 command,
  # migration, secret command or webhook mutation is permitted here.
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
    RELEASE_STATUS='BLOCKED' RELEASE_ERROR_LOG='/tmp/kontur-production-deploy.log' node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.RELEASE_ERROR_LOG, 'utf8')
  .replace(/\u001b\[[0-9;]*m/g, '')
  .replace(/(authorization|bearer|token|secret)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]');
const lines = raw.split(/\r?\n/).filter(Boolean);
const relevant = lines.filter((line) => /error|code|permission|auth|forbidden|unauthorized/i.test(line));
const error = (relevant.length ? relevant : lines.slice(-25)).slice(-25).join('\n').slice(-4000);
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync('apps/miniapp/dist/cloudflare-production-release-b153d4c9.json', JSON.stringify({
  status: process.env.RELEASE_STATUS,
  release: process.env.RELEASE_SHA,
  error,
}, null, 2) + '\n');
console.log('PRODUCTION_DEPLOY_BLOCKED_DIAGNOSTIC_READY');
NODE
    return "$deploy_status"
  fi

  cat /tmp/kontur-production-deploy.log
  (
    cd "$release_dir"
    RELEASE_ORIGIN="$CLOUDFLARE_PROD_ORIGIN" \
    RELEASE_PROPAGATION_TIMEOUT_MS='180000' \
      node tools/cloudflare/wait-for-deployed-assets.mjs
  )

  curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
    "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?kontur_release_probe=$RELEASE_SHA" \
    > /tmp/kontur-prod-health.json
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
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched" \
      > /tmp/kontur-prod-counts-after.json
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
const before = firstCounts('/tmp/kontur-prod-counts-before.json');
const after = firstCounts('/tmp/kontur-prod-counts-after.json');
if (after.users < before.users || after.hatched < before.hatched) throw new Error('production user data count decreased');
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health.json', 'utf8'));
if (health.ok !== true || health.devMode !== false || health.driver !== 'd1') throw new Error('production health mismatch');
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync('apps/miniapp/dist/cloudflare-production-release-b153d4c9.json', JSON.stringify({
  status: 'PASS',
  release: process.env.RELEASE_SHA,
  exactAsset: true,
  health: true,
  dataPreserved: true,
  apiBoundary: true,
  telegramWebhookBoundary: true,
  users: after.users,
  hatched: after.hatched,
}, null, 2) + '\n');
console.log(`PRODUCTION_DEPLOY_PASS release=${process.env.RELEASE_SHA}`);
console.log('EXACT_ASSET_PASS');
console.log('HEALTH_PASS');
console.log(`DATA_PRESERVED_PASS users=${after.users} hatched=${after.hatched}`);
console.log('API_BOUNDARY_PASS');
console.log('TELEGRAM_WEBHOOK_BOUNDARY_PASS');
NODE
}

set +e
(
  set -e
  run_production_release
) > /tmp/kontur-production-release.log 2>&1
release_status=$?
set -e
cat /tmp/kontur-production-release.log

if [ "$release_status" -ne 0 ]; then
  RELEASE_STATUS='BLOCKED' RELEASE_ERROR_LOG='/tmp/kontur-production-release.log' node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw = fs.readFileSync(process.env.RELEASE_ERROR_LOG, 'utf8')
  .replace(/\u001b\[[0-9;]*m/g, '')
  .replace(/(authorization|bearer|token|secret)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]');
const lines = raw.split(/\r?\n/).filter(Boolean);
const relevant = lines.filter((line) => /error|code|permission|auth|forbidden|unauthorized|failed|fail/i.test(line));
const error = (relevant.length ? relevant : lines.slice(-35)).slice(-35).join('\n').slice(-6000);
fs.mkdirSync('apps/miniapp/dist', { recursive: true });
fs.writeFileSync('apps/miniapp/dist/cloudflare-production-release-b153d4c9.json', JSON.stringify({
  status: process.env.RELEASE_STATUS,
  release: process.env.RELEASE_SHA,
  stage: 'production-release',
  error,
}, null, 2) + '\n');
console.log('PRODUCTION_RELEASE_BLOCKED_DIAGNOSTIC_READY');
NODE
fi

# Preserve the normal staging build output expected by Workers Builds.
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

if [ "$release_status" -ne 0 ]; then
  pnpm -F @kontur/worker exec wrangler deploy \
    --keep-vars \
    --config wrangler.staging.generated.jsonc
  echo "CLOUDFLARE_PRODUCTION_RELEASE_FAIL_CLOSED status=$release_status" >&2
  exit "$release_status"
fi

echo "CLOUDFLARE_PRODUCTION_RELEASE_CONFIRMED release=$RELEASE_SHA"
