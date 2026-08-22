#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-shot 2026-08-22.
# Deploy exact visually verified hatch candidate 289ef82f to existing
# production Worker kontur-igor with --keep-vars.
# Reuse the proven 67ce5981 production-deploy portion, then STOP.
# Do NOT delete the owner, do NOT reset D1, do NOT apply migrations,
# do NOT change secrets/webhook/main.
# Replay already allows repeating the quiz without a D1 wipe.

TEMPLATE_COMMIT='67ce59815d2377ae4a4acea6bd3836ae8ec4b777'
RELEASE_SHA='289ef82f76536aa05b2efab59400e80bcb94d50a'
RELEASE_REF='cursor/hatch-product-289ef82f-1021'
TEMPLATE_PATH='tools/cloudflare/workers-build-staging.sh'
TMP='/tmp/kontur-hatch-visual-289ef82f.sh'
ONESHOT_NONCE='20260822-hatch-289ef82f-ops-probe-trigger'

# Fetch the exact previously successful one-shot harness even if this checkout is shallow.
git fetch --no-tags --depth=1 origin "$TEMPLATE_COMMIT"
test "$(git rev-parse --verify 'FETCH_HEAD^{commit}')" = "$TEMPLATE_COMMIT"
git show "FETCH_HEAD:$TEMPLATE_PATH" > "$TMP.template"

TEMPLATE="$TMP.template" OUTPUT="$TMP" RELEASE_SHA="$RELEASE_SHA" RELEASE_REF="$RELEASE_REF" node --input-type=module <<'NODE'
import fs from 'node:fs';

const input = fs.readFileSync(process.env.TEMPLATE, 'utf8');
const oldRelease = "export RELEASE_SHA='771f908b6f2407102a04e2c1773ff97f1150a400'";
const newRelease = `export RELEASE_SHA='${process.env.RELEASE_SHA}'`;
if ((input.match(new RegExp(oldRelease.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
  throw new Error('template release constant mismatch');
}

let output = input.replace(oldRelease, newRelease);
output = output.replaceAll('771f908b', process.env.RELEASE_SHA.slice(0, 8));

const oldFetch = 'git fetch --no-tags --depth=1 origin "$RELEASE_SHA"';
const newFetch = `git fetch --no-tags --depth=1 origin "${process.env.RELEASE_REF}"`;
if (!output.includes(oldFetch)) throw new Error('template git fetch line missing');
output = output.replace(oldFetch, newFetch);

const skipResetNeedle = "  echo 'PRODUCTION_DEPLOY_CONFIRMED_BEGIN_ONE_USER_RESET'\n";
const skipReset = `  echo 'PRODUCTION_DEPLOY_CONFIRMED_SKIP_OWNER_RESET'
  node --input-type=module <<'PROOF'
import fs from 'node:fs';
const proof = JSON.parse(fs.readFileSync('/tmp/kontur-deploy-proof.json', 'utf8'));
const health = JSON.parse(fs.readFileSync('/tmp/kontur-prod-health-deploy.json', 'utf8'));
const payload = {
  status: 'PASS',
  stage: 'production-hatch-deploy-no-d1-reset',
  release: process.env.RELEASE_SHA,
  worker: process.env.CLOUDFLARE_PROD_WORKER_NAME,
  origin: process.env.CLOUDFLARE_PROD_ORIGIN,
  d1Reset: false,
  ownerDelete: false,
  exactAsset: true,
  assets: { js: proof.js, css: proof.css },
  users: proof.users,
  hatched: proof.hatched,
  grants: proof.grants ?? null,
  health: { ok: health.ok, devMode: health.devMode, driver: health.driver, startedBot: health.startedBot, hatched: health.hatched, grants: health.grants },
  apiBoundary: true,
  telegramWebhookBoundary: true,
};
fs.writeFileSync('/tmp/kontur-diagnostic-payload.json', JSON.stringify(payload, null, 2) + '\\n');
fs.writeFileSync('/tmp/kontur-final-proof.json', JSON.stringify(payload, null, 2) + '\\n');
console.log('D1_LEFT_UNTOUCHED_PASS');
PROOF
  write_diagnostic
  return 0
`;
if (!output.includes(skipResetNeedle)) throw new Error('template reset start marker missing');
output = output.replace(skipResetNeedle, skipReset);

output = output.replace(
  'echo "CLOUDFLARE_PRODUCTION_HATCH_RESET_CONFIRMED release=$RELEASE_SHA"',
  'echo "CLOUDFLARE_PRODUCTION_HATCH_DEPLOY_CONFIRMED release=$RELEASE_SHA d1_reset=false"',
);
output = output.replace(
  'echo "CLOUDFLARE_PRODUCTION_HATCH_RESET_FAIL_CLOSED status=$release_status" >&2',
  'echo "CLOUDFLARE_PRODUCTION_HATCH_DEPLOY_FAIL_CLOSED status=$release_status" >&2',
);

if (output.includes(oldRelease)) throw new Error('template SHA patch incomplete');
if (output.includes('PRODUCTION_DEPLOY_CONFIRMED_BEGIN_ONE_USER_RESET')) {
  throw new Error('one-user reset was not skipped');
}
if (!output.includes('PRODUCTION_DEPLOY_CONFIRMED_SKIP_OWNER_RESET')) {
  throw new Error('skip-reset marker missing');
}
if (!output.includes(`export RELEASE_SHA='${process.env.RELEASE_SHA}'`)) throw new Error('new release missing');
if (!output.includes('igorekglukhovskii43.workers.dev')) throw new Error('production/staging origin account changed unexpectedly');
if (!output.includes('--keep-vars')) throw new Error('keep-vars missing');
if (!output.includes('--name "$CLOUDFLARE_PROD_WORKER_NAME"')) throw new Error('explicit production Worker name missing');
fs.writeFileSync(process.env.OUTPUT, output);
NODE

chmod 700 "$TMP"
echo "KONTUR_HATCH_VISUAL_DEPLOY_BOOTSTRAP_PASS release=$RELEASE_SHA ref=$RELEASE_REF template=$TEMPLATE_COMMIT nonce=$ONESHOT_NONCE d1_reset=false"
exec bash "$TMP"
