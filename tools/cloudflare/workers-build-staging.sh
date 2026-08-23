#!/usr/bin/env bash
set -euo pipefail

# Disposable staging-only diagnostics for the hatch candidate.
# No production Worker/D1 writes.

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

: > /tmp/kontur-test-results.tsv
set +e
for f in apps/miniapp/test/*.test.ts; do
  node --experimental-strip-types --test "$f" > "/tmp/$(basename "$f").log" 2>&1
  code=$?
  printf '%s\t%s\n' "$code" "$f" >> /tmp/kontur-test-results.tsv
done
pnpm -F @kontur/miniapp typecheck > /tmp/kontur-typecheck.log 2>&1
typecheck_code=$?
set -e
export TYPECHECK_CODE="$typecheck_code"

pnpm -F @kontur/miniapp build

node --input-type=module <<'NODE'
import fs from 'node:fs';
const rows=fs.readFileSync('/tmp/kontur-test-results.tsv','utf8').trim().split('\n').filter(Boolean).map((line)=>{const [code,file]=line.split('\t');return {file,code:Number(code)};});
const failed=rows.filter((row)=>row.code!==0);
const typecheckLog=fs.readFileSync('/tmp/kontur-typecheck.log','utf8');
const typecheckCode=Number(process.env.TYPECHECK_CODE || '0');
const details={status:'DIAGNOSTIC',tests:rows,failedTests:failed.map((x)=>x.file),typecheckCode,typecheckTail:typecheckLog.split('\n').slice(-40)};
for(const row of failed){const p=`/tmp/${row.file.split('/').pop()}.log`;details[`log:${row.file}`]=fs.readFileSync(p,'utf8').split('\n').slice(-80);}
fs.mkdirSync('apps/miniapp/dist',{recursive:true});
fs.writeFileSync('apps/miniapp/dist/source-test-diagnostic.json',JSON.stringify(details,null,2)+'\n');
console.log(`KONTUR_SOURCE_DIAGNOSTIC failed=${failed.length} typecheck=${typecheckCode}`);
NODE

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
console.log('KONTUR_DIAGNOSTIC_STAGING_PREP_PASS');
NODE
