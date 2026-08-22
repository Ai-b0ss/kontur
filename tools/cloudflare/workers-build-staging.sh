#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HEAD='32034e8af92923a2abe09ad00e3220f6da1ed21c'
PATCH='autonomy/patches/KONTUR_PR12_BOUNDED_FIX_20260820.patch'

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'

actual_head="$(git rev-parse HEAD)"
if [[ "$actual_head" != "$EXPECTED_HEAD" ]]; then
  echo "SAFE_STOP unexpected checkout: $actual_head" >&2
  exit 20
fi

test -s "$PATCH"
git apply --check "$PATCH"
git apply "$PATCH"

mapfile -t changed < <(git diff --name-only | sort)
expected=(
  'apps/miniapp/src/screens/LocalKontur.tsx'
  'apps/miniapp/test/local-kontur.test.ts'
)
if [[ "${changed[*]}" != "${expected[*]}" ]]; then
  printf 'SAFE_STOP unexpected patch scope: %s\n' "${changed[*]}" >&2
  exit 21
fi

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

# All source gates run before any Cloudflare write.
node tools/handoff-safety-check.mjs
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp typecheck
pnpm -F @kontur/miniapp build

# Generate isolated staging configuration and fail closed on production leakage.
node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8'));
if (c.name !== 'kontur-igor-staging') throw new Error(`unexpected staging Worker ${c.name}`);
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db || db.database_id !== '22786b4b-99cc-4ca5-a18b-932e8781021b' || db.database_name !== 'kontur-staging') {
  throw new Error('staging D1 mismatch');
}
if ('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routing/cron leaked into staging config');
console.log('CLOUDFLARE_STAGING_ISOLATION_PASS');
NODE

# Only now may the dedicated staging Worker be updated.
pnpm -F @kontur/worker exec wrangler deploy --keep-vars --config wrangler.staging.generated.jsonc

# Read-only public smoke from the same networked build runner.
node --input-type=module <<'NODE'
const origin = process.env.CLOUDFLARE_STAGING_ORIGIN;
const targets = ['/', '/quiz/egg-stage-01.webp', '/quiz/egg-stage-08.webp', '/results/woodpecker.webp'];
for (const path of targets) {
  const res = await fetch(origin + path, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (path.endsWith('.webp') && !type.includes('image/webp')) throw new Error(`${path} wrong content-type ${type}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < (path === '/' ? 100 : 1000)) throw new Error(`${path} suspiciously small ${bytes.byteLength}`);
  console.log(`STAGING_SMOKE_PASS ${path} ${type} ${bytes.byteLength}`);
}
NODE

echo 'KONTUR_PR12_STAGING_DONE'
