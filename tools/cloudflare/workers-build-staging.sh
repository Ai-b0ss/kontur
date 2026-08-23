#!/usr/bin/env bash
set -euo pipefail

# Disposable visual-proof executor. STAGING ONLY.
# Exact product parent for this branch: d4971eb15e2da1198ef776ad48cd9a365a439b1b
# This build phase prepares the isolated staging bundle/config only.
# The connected Cloudflare Workers Builds deploy phase owns the actual staging deploy.
# Production Worker/D1 are never written by this script.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" != '22' ]; then
  echo "KONTUR_STAGING_PROOF_FAIL unexpected_node=$(node --version)" >&2
  exit 1
fi

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

node tools/handoff-safety-check.mjs
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp typecheck
pnpm -F @kontur/miniapp build

node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc

node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8'));
if (c.name !== 'kontur-igor-staging') throw new Error(`refusing non-staging Worker: ${c.name}`);
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db) throw new Error('staging DB binding missing');
if (db.database_name !== 'kontur-staging') throw new Error(`refusing DB ${db.database_name}`);
if (db.database_id !== '22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error(`refusing DB id ${db.database_id}`);
if (db.database_id === '91e39e7e-70fc-4551-8d3e-48235e70f985') throw new Error('production D1 leaked into staging config');
if (c.name === 'kontur-igor') throw new Error('production Worker target forbidden');
if ('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routes/triggers leaked into staging');
console.log('KONTUR_STAGING_CONFIG_ISOLATION_PASS');
NODE

echo KONTUR_STAGING_BUILD_PREP_PASS
