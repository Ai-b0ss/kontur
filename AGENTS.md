# Kontur

Kontur is a Telegram community Mini App and bot with bird onboarding, a respect economy, cosmetic eggs and community participation features. The Cloudflare Worker serves the Mini App, API, Telegram webhook and cron jobs; D1 stores production data. Local Node/PGlite services provide a reference implementation and tests.

Code map:
- `apps/worker/`: production Worker, API, Telegram integration and D1 migrations.
- `apps/miniapp/`: React/Vite screens, API client, styles and public assets.
- `packages/core/` and `packages/contracts/`: domain logic, invariants and shared API contracts.
- `apps/api/`, `apps/bot/` and `packages/db/`: local reference services and database tooling; do not deploy them as a second production runtime.
- `tools/sim/` and `tools/cloudflare/`: simulations, verification and staging tooling; other `tools/` scripts handle deployment, backups and handoffs.
- `art-direction/` and `stage5-prototype/`: visual references and historical prototypes, not current runtime authority.

Checks (exact commands from CI/README):
- Dependency-free staging isolation: `node tools/cloudflare/staging-config-check.mjs`.
- Unit tests: `pnpm -F @kontur/core test`, `pnpm -F @kontur/db test`, `pnpm -F @kontur/bot test`, `pnpm -F @kontur/miniapp test`.
- Other local gates: `pnpm cf:test`, `pnpm test:api`, `pnpm typecheck`, `pnpm sim`, `pnpm cf:test-transfer`, `pnpm build`; combined gate: `pnpm check`.

`main` is the integration branch.

Working rules:
- Check `git status` and preserve unrelated user changes.
- Technical authority: code/tests > `PROJECT_STATE.yaml` > `AI_PROJECT_NAVIGATOR.md` > `README.md`/`HANDOVER.md` > `WORKLOG.md` > `DESIGN.md`/`kontur-brief.html`. Stop on code/document conflicts, record `UNKNOWN` and identify the missing verification instead of guessing.
- Old archives and superseded material are historical evidence only; copy runtime code from them only with an investigated, documented reason.
- Never disclose, commit or package secrets or personal data, including `.env`, `*.local`, backups, local data, private research and Telegram IDs.
- Diagnostics do not authorize production writes. Create a Git checkpoint before production code/schema changes and take a full backup before changing D1.
- Never edit applied migrations; add the next numbered migration.
- D1 restore starts with a verified Dry Run. `-Apply` requires a separate explicit decision and an automatic pre-restore backup.
- Do not automatically bring the broad design concept into the MVP. Changes to the core, meaning, features, design or copy are a separate product stage tracked in `BACKLOG.md`.
- After significant changes, run proportionate checks, update affected state documents and record the decision in `WORKLOG.md`. Preserve `UNKNOWN`/`HOLD` as uncertainty, not failure, and never claim unverified work is complete.
