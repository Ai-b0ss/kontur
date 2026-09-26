#!/usr/bin/env bash
set -euo pipefail

# TEMP owner-authorized operation 2026-09-26:
# disable cron triggers on free-fabric-control-staging only.
# No Worker code deploy, no D1/KV mutation, no secret mutation,
# no KONTUR production/staging mutation.

TARGET_WORKER='free-fabric-control-staging'
CFG='/tmp/free-fabric-cron-off.jsonc'

node_major="$(node -p "process.versions.node.split('.')[0]")"
echo "NODE_VERSION=$(node --version)"

corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile

cat > "$CFG" <<'JSON'
{
  "name": "free-fabric-control-staging",
  "triggers": {
    "crons": []
  }
}
JSON

echo "TARGET_WORKER=$TARGET_WORKER"
echo "ACTION=remove_all_cron_triggers_only"

pnpm -F @kontur/worker exec wrangler triggers deploy   --name "$TARGET_WORKER"   --config "$CFG"

echo "FREE_FABRIC_CRON_DISABLE_PASS worker=$TARGET_WORKER"
