#!/usr/bin/env bash
set -euo pipefail

# PR #23 temporary observability trigger for independent PR #22 frame proof.
export TARGET_SHA='32298ee88dfbcbfd207c476496b55737c26c44a3'
WORK='/tmp/kontur-pr22-independent-proof'
EVIDENCE_REPO_DIR='.evidence/pr22-independent-frame-proof'

export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'

if test -s "$EVIDENCE_REPO_DIR/ready.json"; then
  echo 'PR22_INDEPENDENT_FRAME_PROOF_ALREADY_PERSISTED'
  exit 0
fi

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
node --input-type=module <<'NODE'
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(process.env.KONTUR_BROWSER_EVIDENCE_DIR + '/browser-acceptance.json', 'utf8'));
if (m.result !== 'PASS') throw new Error('browser acceptance failed');
if (m.exactHead !== process.env.TARGET_SHA) throw new Error(`wrong exact head ${m.exactHead}`);
console.log(`PR22_INDEPENDENT_CHROMIUM_PASS head=${m.exactHead}`);
NODE

cd - >/dev/null
mkdir -p "$EVIDENCE_REPO_DIR"
cp "$KONTUR_BROWSER_EVIDENCE_DIR/motion-3-q8-to-reveal.webm" "$EVIDENCE_REPO_DIR/motion-3-q8-to-reveal.webm"
cp "$KONTUR_BROWSER_EVIDENCE_DIR/browser-acceptance.json" "$EVIDENCE_REPO_DIR/browser-acceptance.json"
for f in 05-quiz-q8.png 15-hatch-intact.png 16-hatch-opening.png 06-bird-reveal.png 18-hatch-430x1000.png 19-hatch-390x844.png 23-hatch-slow-api-390x844.png; do
  test -s "$KONTUR_BROWSER_EVIDENCE_DIR/$f"
  cp "$KONTUR_BROWSER_EVIDENCE_DIR/$f" "$EVIDENCE_REPO_DIR/$f"
done
node --input-type=module <<'NODE'
import fs from 'node:fs';
fs.writeFileSync('.evidence/pr22-independent-frame-proof/ready.json', JSON.stringify({
  status: 'PASS', exactHead: process.env.TARGET_SHA, capturedAt: new Date().toISOString()
}) + '\n');
NODE

git config user.name 'kontur-proof-bot'
git config user.email 'kontur-proof-bot@users.noreply.github.com'
git add "$EVIDENCE_REPO_DIR"
git commit -m 'test: store independent PR22 Chromium frame proof'
git push origin HEAD:refs/heads/ci/kontur-prod-readonly-probe-20260822

echo 'PR22_INDEPENDENT_FRAME_PROOF_DONE'
