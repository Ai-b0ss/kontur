#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-shot production deploy for the exact frontend candidate.
# Proven path: isolated exact archive -> full checks -> wrangler deploy --keep-vars
# -> exact live asset convergence -> health/API/webhook boundaries -> D1 read-only
# before/after equality. NO owner reset, NO migrations, NO schema/secret changes.
# NONCE=20260823-owner-mode-6952eba2-production

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_WORKER_NAME='kontur-igor'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
export CLOUDFLARE_PROD_ORIGIN='https://kontur-igor.igorekglukhovskii43.workers.dev'
export RELEASE_SHA='6952eba2b740b40b55433613d7c8bb594f215583'
export RELEASE_DIR='/tmp/kontur-production-owner-mode-6952eba2'

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" != '22' ]; then
  echo "KONTUR_PROD_DEPLOY_FAIL unexpected_node=$(node --version) expected_major=22" >&2
  exit 1
fi

echo "KONTUR_PROD_DEPLOY_NODE_PASS version=$(node --version)"
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
node tools/handoff-safety-check.mjs

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
git fetch --no-tags --depth=1 origin "$RELEASE_SHA"
test "$(git rev-parse --verify 'FETCH_HEAD^{commit}')" = "$RELEASE_SHA"
git archive "$RELEASE_SHA" | tar -x -C "$RELEASE_DIR"

(
  cd "$RELEASE_DIR"
  pnpm install --frozen-lockfile
  pnpm -F @kontur/miniapp test
  pnpm -F @kontur/worker test
  pnpm typecheck
  pnpm build
)

echo "KONTUR_EXACT_CANDIDATE_BUILD_PASS release=$RELEASE_SHA"

node --input-type=module <<'NODE'
import fs from 'node:fs';
const root = process.env.RELEASE_DIR;
const raw = fs.readFileSync(`${root}/apps/worker/wrangler.jsonc`, 'utf8').replace(/^\uFEFF/, '');
const config = JSON.parse(raw);
if (config.name !== process.env.CLOUDFLARE_PROD_WORKER_NAME) throw new Error(`production Worker mismatch: ${config.name}`);
const db = (config.d1_databases || []).find((item) => item?.binding === 'DB');
if (!db || db.database_name !== process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME || db.database_id !== process.env.CLOUDFLARE_PROD_D1_DATABASE_ID) {
  throw new Error('production D1 binding mismatch');
}
if (db.database_id === process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID) throw new Error('staging D1 leaked into production config');
if (config.assets?.directory !== '../miniapp/dist') throw new Error('production assets directory mismatch');
const html = fs.readFileSync(`${root}/apps/miniapp/dist/index.html`, 'utf8');
const js = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
const css = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0];
if (!js || !css) throw new Error('built candidate missing hashed assets');
fs.writeFileSync('/tmp/kontur-owner-mode-expected-assets.json', JSON.stringify({ js, css }));
console.log(`KONTUR_PROD_TARGET_PASS js=${js} css=${css}`);
NODE

(
  cd "$RELEASE_DIR/apps/worker"
  pnpm exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
  pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM d1_migrations) AS migrations" \
    > /tmp/kontur-prod-counts-before.json
)

node --input-type=module <<'NODE'
import fs from 'node:fs';
const raw=fs.readFileSync('/tmp/kontur-prod-d1-info.json','utf8');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_NAME)) throw new Error('production D1 name missing');
if(!raw.includes(process.env.CLOUDFLARE_PROD_D1_DATABASE_ID)) throw new Error('production D1 id missing');
if(raw.includes(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID)) throw new Error('staging D1 identity appeared in production probe');
console.log('KONTUR_PROD_D1_READONLY_AUTH_PASS');
NODE

set +e
(
  cd "$RELEASE_DIR/apps/worker"
  env -u WRANGLER_CI_OVERRIDE_NAME -u WRANGLER_CI_MATCH_TAG -u CLOUDFLARE_WORKER_NAME -u CLOUDFLARE_ENV \
    pnpm exec wrangler deploy \
      --name "$CLOUDFLARE_PROD_WORKER_NAME" \
      --keep-vars \
      --config wrangler.jsonc
) > /tmp/kontur-owner-mode-production-deploy.log 2>&1
deploy_status=$?
set -e
cat /tmp/kontur-owner-mode-production-deploy.log
if [ "$deploy_status" -ne 0 ]; then
  echo "KONTUR_PROD_DEPLOY_FAIL wrangler_exit=$deploy_status" >&2
  exit "$deploy_status"
fi

echo "KONTUR_WRANGLER_DEPLOY_PASS release=$RELEASE_SHA"

(
  cd "$RELEASE_DIR"
  RELEASE_ORIGIN="$CLOUDFLARE_PROD_ORIGIN" \
  RELEASE_PROPAGATION_TIMEOUT_MS='180000' \
    node tools/cloudflare/wait-for-deployed-assets.mjs
)

curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$CLOUDFLARE_PROD_ORIGIN/api/v1/health?owner_mode_release=$RELEASE_SHA" \
  > /tmp/kontur-prod-health.json
export LIVE_HTML="$(curl -fsS -H 'Cache-Control: no-cache, no-store, max-age=0' "$CLOUDFLARE_PROD_ORIGIN/?owner_mode_release=$RELEASE_SHA")"
api_code="$(curl -sS -o /tmp/kontur-prod-unauth.json -w '%{http_code}' "$CLOUDFLARE_PROD_ORIGIN/api/v4/local/state?owner_mode_release=$RELEASE_SHA")"
test "$api_code" = '401'
webhook_code="$(curl -sS -o /tmp/kontur-prod-webhook.txt -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{"update_id":1}' "$CLOUDFLARE_PROD_ORIGIN/telegram/webhook")"
test "$webhook_code" = '403'

(
  cd "$RELEASE_DIR/apps/worker"
  pnpm exec wrangler d1 execute "$CLOUDFLARE_PROD_D1_DATABASE_NAME" \
    --remote --config wrangler.jsonc --json --command \
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT COUNT(*) FROM worm_grants) AS grants, (SELECT COUNT(*) FROM colorings) AS colorings, (SELECT COUNT(*) FROM d1_migrations) AS migrations" \
    > /tmp/kontur-prod-counts-after.json
)

node --input-type=module <<'NODE'
import fs from 'node:fs';
function firstCounts(path) {
  const rows=[];
  const visit=(v)=>{
    if(Array.isArray(v)) return v.forEach(visit);
    if(!v||typeof v!=='object') return;
    if(v.users!=null && v.hatched!=null && v.grants!=null) rows.push(v);
    Object.values(v).forEach(visit);
  };
  visit(JSON.parse(fs.readFileSync(path,'utf8')));
  if(!rows[0]) throw new Error(`counts missing ${path}`);
  return Object.fromEntries(Object.entries(rows[0]).map(([k,v])=>[k,Number(v)]));
}
const before=firstCounts('/tmp/kontur-prod-counts-before.json');
const after=firstCounts('/tmp/kontur-prod-counts-after.json');
for(const key of ['users','hatched','grants','colorings','migrations']) {
  if(after[key]!==before[key]) throw new Error(`D1 changed during frontend deploy: ${key} ${before[key]} -> ${after[key]}`);
}
const health=JSON.parse(fs.readFileSync('/tmp/kontur-prod-health.json','utf8'));
if(health.ok!==true || health.devMode!==false || health.driver!=='d1') throw new Error('production health mismatch');
const expected=JSON.parse(fs.readFileSync('/tmp/kontur-owner-mode-expected-assets.json','utf8'));
const html=process.env.LIVE_HTML||'';
if(!html.includes(expected.js)||!html.includes(expected.css)) throw new Error(`live HTML missing expected assets ${expected.js} ${expected.css}`);
console.log(`KONTUR_PRODUCTION_OWNER_MODE_PASS release=${process.env.RELEASE_SHA}`);
console.log(`KONTUR_PRODUCTION_ASSETS_PASS js=${expected.js} css=${expected.css}`);
console.log(`KONTUR_PRODUCTION_D1_UNCHANGED_PASS users=${after.users} hatched=${after.hatched} grants=${after.grants}`);
console.log('KONTUR_PRODUCTION_HEALTH_PASS');
console.log('KONTUR_PRODUCTION_API_BOUNDARY_PASS status=401');
console.log('KONTUR_PRODUCTION_WEBHOOK_BOUNDARY_PASS status=403');
NODE

# Leave the connected staging project with a valid generated staging config and
# the exact same candidate dist. Cloudflare's configured deploy command may run
# after this build script; it must remain isolated from production D1.
rm -rf apps/miniapp/dist
mkdir -p apps/miniapp/dist
cp -a "$RELEASE_DIR/apps/miniapp/dist/." apps/miniapp/dist/
node tools/cloudflare/make-staging-config.mjs
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc','utf8'));
if(c.name!=='kontur-igor-staging') throw new Error('staging Worker mismatch');
const db=(c.d1_databases||[]).find((x)=>x?.binding==='DB');
if(!db||db.database_id!=='22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging D1 mismatch');
if('route' in c||'routes' in c||'triggers' in c) throw new Error('production route/cron leaked into staging config');
console.log('KONTUR_STAGING_POST_DEPLOY_PREP_PASS');
NODE
