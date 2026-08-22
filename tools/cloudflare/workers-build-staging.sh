#!/usr/bin/env bash
set -euo pipefail

# Owner-authorized one-shot 2026-08-22.
# Reuse the previously proven production deploy + FK-safe one-user reset harness
# from commit 67ce5981, changing ONLY the exact release SHA and owner username.
# No global D1 wipe, no schema/migration/static seed/secret/webhook/main mutation.

TEMPLATE_COMMIT='67ce59815d2377ae4a4acea6bd3836ae8ec4b777'
RELEASE_SHA='6fefe26ba4a145e0b5e559005f8e7faf851e2737'
OWNER_USERNAME_NORM='fff6pm'
TEMPLATE_PATH='tools/cloudflare/workers-build-staging.sh'
TMP='/tmp/kontur-owner-release-pr22.sh'

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
