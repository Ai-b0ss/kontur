# Owner UI key-material evidence — 2026-09-04

Status: **owner-visible configuration evidence; secret values intentionally not copied**.

This addendum records facts visible in owner-supplied CircleCI and GitHub settings screenshots. It complements `KEY_MATERIAL_RESEARCH_2026-09-04.md` and upgrades several earlier `REFERENCED_ONLY` / historical conclusions.

## 1. CircleCI organization inventory

The owner UI currently shows two CircleCI projects:

1. `free-fabric-gpt-bridge`
2. `qwen-free-api`

At capture time, `qwen-free-api` had run about 44 minutes earlier and `free-fabric-gpt-bridge` about 2 days earlier. This is operational evidence that the Qwen Circle project is still active; it is not merely a historical project record.

## 2. `qwen-free-api` project-level environment variables — CURRENTLY CONFIGURED

Owner UI shows these masked project environment-variable names:

- `AUTOPILOT_GITHUB_TOKEN_2`
- `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL`
- `RUNTIME_STATE_KEY`

Secret values are not reproduced.

### Consequence for `RUNTIME_STATE_KEY`

This upgrades the current Qwen Circle project from merely historical key-bearing evidence to **PROVEN_CONFIGURED_CURRENTLY** at the project-settings layer.

The successful real Qwen preflight commit `7ad56bac97036147962c4c0ea797617984eb248a` is especially important because its `.circleci/config.yml` checks `${RUNTIME_STATE_KEY}` directly and does **not** attach a Circle context to the job. Therefore that successful execution consumed the project-level environment variable (or an equivalently injected project setting), not an unseen named context dependency.

Resulting evidence chain:

- owner UI: `qwen-free-api` currently has project env `RUNTIME_STATE_KEY` configured;
- preflight config: job directly requires `RUNTIME_STATE_KEY`, no context declaration;
- historical real execution: restore + upstream Qwen preflight passed.

This substantially reduces uncertainty around where the decryptor lives.

### Consequence for Qwen webhook control

The same active Circle project currently contains `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL` and `RUNTIME_STATE_KEY` side-by-side.

This does **not mathematically prove** that the URL points back to this exact project, because Circle project env values are opaque and could contain another project’s webhook. However it materially increases the compatibility prior: the Qwen-specific custom-webhook credential and the runtime decryptor are co-located in the active `qwen-free-api` project.

The next execution experiment should therefore test the existing Qwen custom-webhook path before inventing new trigger credentials.

## 3. `free-fabric-gpt-bridge` project-level environment variables — CURRENTLY CONFIGURED

Owner UI shows these masked names:

- `CIRCLE_CUSTOM_WEBHOOK_URL`
- `CLOUDFLARE_API_KEY`
- `CLOUDFLARE_EMAIL`
- `FF_CHATGPT_SESSION_BUNDLE`
- `RUNTIME_STATE_KEY`

Secret values are not reproduced.

This establishes a **second current Circle key-bearing project** with:

- the same-named runtime decryptor variable;
- the generic Circle custom-webhook URL;
- Cloudflare bootstrap credentials used by the Free Fabric control-plane design;
- a ChatGPT session bundle unrelated to Notion provider auth but potentially relevant to historical bridge execution.

This is a strong fallback/control-plane surface. It also makes the earlier Free Fabric architecture coherent with the live owner configuration: the generic bridge project has the generic webhook and Cloudflare roots, while the Qwen project has the Qwen-specific webhook.

## 4. GitHub fine-grained token inventory visible in owner UI

The GitHub token settings page visibly contains these token names:

- `Notion v2` — expires 2026-09-29; UI says never used
- `Notion` — expires 2026-09-29; UI says never used
- `AUTOPILOT_GITHUB_TOKEN_2` — expires 2026-09-24; used within last 2 weeks
- `AUTOPILOT_GITHUB_TOKEN` — expires 2026-09-17; used within last 2 weeks
- `circleci-autopilot-handoff` — expires 2026-09-17; used within last 3 weeks
- `ai-mirrors-miniapps-pages` — expires 2026-10-11; UI says never used
- `gh_token` — expires 2026-10-06; UI says never used
- `notion-code-patcher` — expires 2026-09-22; used within last 3 months

Values are not recoverable from the screenshot and are not copied here.

### Important semantic correction

The GitHub PAT names `Notion` / `Notion v2` are **GitHub repository credentials**, not Notion provider `token_v2` session material. Do not confuse them with the `token_v2` field stored inside the encrypted Notion runtime.

These GitHub tokens may be useful for private-repository access if their scopes include the needed repos, but their names alone do not prove scope and do not provide a plaintext credential to the current worker.

### `circleci-autopilot-handoff`

The name and recent-use timestamp make this a high-value provenance lead for historical Circle↔GitHub control, but the token value and exact repository permissions are unknown. Treat as **EXISTS_IN_OWNER_TOKEN_INVENTORY**, not as an available runtime secret until an executor/environment variable or successful authenticated operation proves where it is installed.

## 5. Updated evidence grades

| Surface | New grade | Why |
|---|---|---|
| `qwen-free-api` Circle `RUNTIME_STATE_KEY` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI shows current project env; prior real job directly consumed same name |
| `qwen-free-api` Circle `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI shows masked project env |
| `qwen-free-api` Circle `AUTOPILOT_GITHUB_TOKEN_2` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI shows masked project env; prior capability probe also used this class |
| `free-fabric-gpt-bridge` `RUNTIME_STATE_KEY` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI project settings |
| `free-fabric-gpt-bridge` `CIRCLE_CUSTOM_WEBHOOK_URL` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI project settings |
| bridge Cloudflare email/global API key | **PROVEN_CONFIGURED_CURRENTLY** | owner UI project settings |
| `FF_CHATGPT_SESSION_BUNDLE` | **PROVEN_CONFIGURED_CURRENTLY** | owner UI project settings; validity not tested here |
| GitHub `Notion` / `Notion v2` PATs | **EXISTS_IN_OWNER_TOKEN_INVENTORY** | token entries visible, values/scopes unavailable |
| `circleci-autopilot-handoff` PAT | **EXISTS_IN_OWNER_TOKEN_INVENTORY** | visible + recently used, injection point unknown |

## 6. Release-impact conclusion

The release should no longer treat `RUNTIME_STATE_KEY` discovery as the blocker. The owner UI confirms the decryptor variable is presently configured in **both** Circle projects, and the Qwen project is currently active.

The critical technical question narrows to **trigger/execution compatibility**, not key discovery:

1. trigger an execution on active `qwen-free-api` using an existing legitimate route;
2. prove the project-level `RUNTIME_STATE_KEY` still decrypts the mirrored Notion archive;
3. run bounded actual Notion eligibility preflight;
4. on GREEN continue directly into the long Qwen+Notion F51 in the same execution where feasible.

Priority trigger order after this evidence:

1. existing `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL` path associated with the active Qwen project;
2. an already-working Circle project event/branch route on `qwen-free-api`;
3. generic `free-fabric-gpt-bridge` custom-webhook/control-plane route, because it also currently has `RUNTIME_STATE_KEY` + Cloudflare roots;
4. self-hosted GitHub runners only as fallbacks if they come online.

Do not expose masked values, do not request rotation merely to inspect them, and do not conflate GitHub PAT names with provider session credentials.
