# Worklog

## 2026-08-22 — owner-authorized non-destructive production release

- Deployed exact runtime `b153d4c96a775484c0cfc3b454029f9e4dadaf75` to Worker `kontur-igor` through the credentialed `kontur-igor-staging` Workers Builds executor.
- Deployment used `wrangler deploy --name kontur-igor --keep-vars`; no D1 reset, migration, user-data mutation, secret update, webhook update, or `main` merge was performed.
- Exact production root/assets, health, unauthenticated API boundary, webhook-secret boundary, and non-decreasing aggregate D1 counts passed. Post-deploy counts: 5 users, 4 hatched profiles.
- The one-time production harness was removed from the executor lane after success.
- Real `/start` → Mini App journey remains `HOLD`: the agent VM has no authenticated Telegram user session. The public bot page and direct Mini App security boundary are reachable, but this is not claimed as an end-to-end Telegram PASS.

## 2026-08-22 — owner-authorized production participant data reset

- A concurrent Cloudflare-native one-shot executor at `51a0669b` deleted rows from the live schema-derived mutable/runtime table set without dropping tables, migrations, or static catalogs.
- Read-only proof `60fd17c7` checked 62 mutable tables with zero remaining rows; production health reports zero started and hatched users. Static colorings and restored opportunities remained non-empty.
- Commit `23f6d016` restored the executor script byte-for-byte to its safe read-only state, preventing a second reset.
- Available executor evidence does not contain a retained pre-reset export or Time Travel bookmark; backup status is `UNKNOWN`, not claimed as PASS.
- Telegram `/start` and first-time onboarding remain `HOLD` because this VM has no authenticated Telegram user session. No synthetic user was created after reset.
