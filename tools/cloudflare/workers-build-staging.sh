#!/usr/bin/env bash
set -euo pipefail

# Disposable minimal staging-only bisection.
# Product parent: d4971eb15e2da1198ef776ad48cd9a365a439b1b
# No production Worker/D1 writes.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm -F @kontur/miniapp build
node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc

node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc','utf8'));
const db=c.d1_databases?.find((x)=>x?.binding==='DB');
if(c.name!=='kontur-igor-staging') throw new Error(`non-staging Worker ${c.name}`);
if(!db || db.database_name!=='kontur-staging' || db.database_id!=='22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging D1 mismatch');
if(db.database_id==='91e39e7e-70fc-4551-8d3e-48235e70f985') throw new Error('production D1 selected');
if('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routing leaked');
console.log('KONTUR_MINIMAL_STAGING_PREP_PASS');
NODE
