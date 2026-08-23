#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-shot 2026-08-23.
# Reproduce the proven PR #22 Cloudflare Workers Builds trigger (8f5d0247 on
# branch fix/kontur-core-visual-continuity-20260818, executor kontur-igor-staging):
# bootstrap the exact 67ce5981 production deploy + FK-safe one-user reset
# harness, changing ONLY the release SHA and owner username.
# This file is a dead trigger on ops/kontur-prod-auth-probe-20260822 (PR #18 is
# not the Workers Builds production branch). It must be pushed to the watched
# branch to execute.
# No global D1 wipe, no schema/migration/static seed/secret/webhook/main mutation.
# NONCE=20260823-289ef82f-fff6pm-pr22-bootstrap

TEMPLATE_COMMIT='67ce59815d2377ae4a4acea6bd3836ae8ec4b777'
RELEASE_SHA='289ef82f76536aa05b2efab59400e80bcb94d50a'
OWNER_USERNAME_NORM='fff6pm'
TEMPLATE_PATH='tools/cloudflare/workers-build-staging.sh'
TMP='/tmp/kontur-owner-release-289ef82f.sh'

# Fetch the exact previously successful one-shot harness even if this checkout is shallow.
git fetch --no-tags --depth=1 origin "$TEMPLATE_COMMIT"
test "$(git rev-parse --verify 'FETCH_HEAD^{commit}')" = "$TEMPLATE_COMMIT"
git show "FETCH_HEAD:$TEMPLATE_PATH" > "$TMP.template"

TEMPLATE="$TMP.template" OUTPUT="$TMP" RELEASE_SHA="$RELEASE_SHA" OWNER_USERNAME_NORM="$OWNER_USERNAME_NORM" node --input-type=module <<'NODE'
import fs from 'node:fs';
const input = fs.readFileSync(process.env.TEMPLATE, 'utf8');
const oldRelease = "export RELEASE_SHA='771f908b6f2407102a04e2c1773ff97f1150a400'";
const newRelease = `export RELEASE_SHA='${process.env.RELEASE_SHA}'`;
const oldOwner = "export OWNER_USERNAME_NORM='igorekglukhovskii43'";
const newOwner = `export OWNER_USERNAME_NORM='${process.env.OWNER_USERNAME_NORM}'`;
if ((input.match(new RegExp(oldRelease.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
  throw new Error('template release constant mismatch');
}
if ((input.match(new RegExp(oldOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
  throw new Error('template owner constant mismatch');
}
let output = input.replace(oldRelease, newRelease).replace(oldOwner, newOwner);
// The proven harness has a few temp paths/diagnostic names containing the old short SHA.
output = output.replaceAll('771f908b', process.env.RELEASE_SHA.slice(0, 8));
if (output.includes(oldRelease) || output.includes(oldOwner)) throw new Error('template patch incomplete');
// Guard against accidentally changing the Cloudflare account subdomain when changing owner username.
if (!output.includes('igorekglukhovskii43.workers.dev')) throw new Error('production/staging origin account changed unexpectedly');
if (!output.includes(`export OWNER_USERNAME_NORM='${process.env.OWNER_USERNAME_NORM}'`)) throw new Error('new owner missing');
if (!output.includes(`export RELEASE_SHA='${process.env.RELEASE_SHA}'`)) throw new Error('new release missing');
fs.writeFileSync(process.env.OUTPUT, output);
NODE

chmod 700 "$TMP"
echo "KONTUR_OWNER_RELEASE_BOOTSTRAP_PASS release=$RELEASE_SHA owner=$OWNER_USERNAME_NORM template=$TEMPLATE_COMMIT"
exec bash "$TMP"
