#!/usr/bin/env bash
set -euo pipefail

TARGET_SHA='32298ee88dfbcbfd207c476496b55737c26c44a3'
WORK='/tmp/kontur-pr22-frame-proof'
export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'

rm -rf "$WORK"
mkdir -p "$WORK"
git fetch --no-tags --depth=1 origin "$TARGET_SHA"
test "$(git rev-parse --verify 'FETCH_HEAD^{commit}')" = "$TARGET_SHA"
git archive "$TARGET_SHA" | tar -x -C "$WORK"

cd "$WORK"
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
node tools/handoff-safety-check.mjs
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp typecheck
pnpm -F @kontur/miniapp build
pnpm -F @kontur/miniapp exec playwright install --with-deps chromium

export KONTUR_BROWSER_EVIDENCE_DIR="$WORK/.evidence/kontur-browser"
node apps/miniapp/test/browser-acceptance.mjs

test -s "$KONTUR_BROWSER_EVIDENCE_DIR/motion-3-q8-to-reveal.webm"
test -s "$KONTUR_BROWSER_EVIDENCE_DIR/browser-acceptance.json"
mkdir -p apps/miniapp/dist/__proof/pr22
cp "$KONTUR_BROWSER_EVIDENCE_DIR/motion-3-q8-to-reveal.webm" apps/miniapp/dist/__proof/pr22/motion-3-q8-to-reveal.webm
cp "$KONTUR_BROWSER_EVIDENCE_DIR/browser-acceptance.json" apps/miniapp/dist/__proof/pr22/browser-acceptance.json
for f in 05-quiz-q8.png 15-hatch-intact.png 16-hatch-opening.png 06-bird-reveal.png 18-hatch-430x1000.png 19-hatch-390x844.png 23-hatch-slow-api-390x844.png; do
  test -s "$KONTUR_BROWSER_EVIDENCE_DIR/$f"
  cp "$KONTUR_BROWSER_EVIDENCE_DIR/$f" "apps/miniapp/dist/__proof/pr22/$f"
done
node --input-type=module <<'NODE'
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(process.env.KONTUR_BROWSER_EVIDENCE_DIR + '/browser-acceptance.json', 'utf8'));
if (manifest.result !== 'PASS') throw new Error('browser acceptance did not pass');
if (manifest.exactHead !== process.env.TARGET_SHA) throw new Error(`unexpected evidence head ${manifest.exactHead}`);
fs.writeFileSync('apps/miniapp/dist/__proof/pr22/ready.json', JSON.stringify({
  status: 'PASS',
  exactHead: process.env.TARGET_SHA,
  motion: 'motion-3-q8-to-reveal.webm',
  capturedAt: new Date().toISOString(),
}) + '\n');
NODE

node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc', 'utf8'));
if (c.name !== process.env.CLOUDFLARE_STAGING_WORKER_NAME) throw new Error('unexpected staging worker');
const db = c.d1_databases?.find((x) => x?.binding === 'DB');
if (!db || db.database_name !== process.env.CLOUDFLARE_STAGING_D1_DATABASE_NAME || db.database_id !== process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID) throw new Error('staging D1 mismatch');
if ('route' in c || 'routes' in c || 'triggers' in c) throw new Error('production routing leaked into staging config');
console.log('PR22_FRAME_PROOF_STAGING_ISOLATION_PASS');
NODE

pnpm -F @kontur/worker exec wrangler deploy --keep-vars --config wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
const url = `${process.env.CLOUDFLARE_STAGING_ORIGIN}/__proof/pr22/ready.json?ts=${Date.now()}`;
const r = await fetch(url, { headers: { 'cache-control': 'no-cache, no-store' }, cache: 'no-store' });
if (!r.ok) throw new Error(`proof marker HTTP ${r.status}`);
const value = await r.json();
if (value.status !== 'PASS' || value.exactHead !== process.env.TARGET_SHA) throw new Error(`proof marker mismatch ${JSON.stringify(value)}`);
console.log(`PR22_FRAME_PROOF_PUBLIC_PASS head=${value.exactHead}`);
NODE

echo 'PR22_FRAME_PROOF_DONE'
