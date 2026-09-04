# Deep key-material / executor research — 2026-09-04

Status: **evidence inventory, no secret values copied or exposed**.

Purpose: identify where each credential/key class actually lives, what is proven present vs merely referenced, and which key-bearing execution path can unblock fresh Notion provider proof + F51 without waiting on an unrelated offline runner.

## Evidence grades

- **PROVEN_PRESENT** — a real execution would have hard-failed without the material and succeeded.
- **ENCRYPTED_MATERIAL_PRESENT** — encrypted state/object is present; decryptor is separate.
- **REFERENCED_ONLY** — code/workflow references a secret name, but no successful run proves the secret is populated there.
- **DERIVED** — generated deterministically from another root credential; not an independent root secret.
- **PLATFORM_EPHEMERAL** — injected by CI/platform for one run.
- **LOCAL_SOURCE_POSSIBLE** — migration/provenance points to an original local directory and ignore rules name likely local secret material, but current existence has not been proved.
- **TEMPLATE_ONLY** — supported provider key, not evidence of a currently configured credential and not a current release dependency.

## Executive finding

The current Notion problem is **not evidence that Notion credentials were lost**. The Notion credential material is preserved in an encrypted runtime archive. The unresolved dependency is access to a **key-bearing executor** that can decrypt that archive and make one bounded actual-provider request.

`qwen-secret-bridge` is only a GitHub self-hosted runner label. It is not the source of the Notion key and must not be treated as a release prerequisite.

The strongest known key-bearing surface is **Circle**, because a real Qwen upstream preflight on commit `7ad56bac97036147962c4c0ea797617984eb248a` restored encrypted runtime using `RUNTIME_STATE_KEY` and passed. Therefore a usable decryptor existed in that Circle execution environment/context at that time.

## 1. Notion account credentials

### Actual auth material

The Notion runtime does not use a conventional `NOTION_API_KEY` for this provider path. `payload/account_pool.py` discovers account JSON under `~/.notionagents/notion_account.json` and `~/.notionagents/accounts/*.json` and validates:

- `token_v2` — actual Notion session credential;
- `user_id` — account identity input;
- `space_id` — required in stable account mode.

Raw token values are deliberately not part of this report.

### Encrypted state

PR#88 lineage contains:

`.runtime-state/notion-agent-bridge-runtime-state.tar.gz.gpg`

- LFS oid: `sha256:694d9ae9fd357908bae534a9dbba71063abe713f6e5b97d45d9dd465fb247e8d`
- plaintext archive size recorded by LFS pointer: `14908874` bytes
- classification: **ENCRYPTED_MATERIAL_PRESENT**

The private `qwen-free-api` carrier contains the **same exact Notion LFS object**, so the Qwen repository is merely a carrier/mirror for this archive, not its semantic owner.

### Decryptor

Both `RESTORE_RUNTIME_STATE.sh` and `RESTORE_RUNTIME_STATE.ps1` require `RUNTIME_STATE_KEY`, decrypt `.runtime-state/*.gpg`, and write restored state outside the checkout.

`RUNTIME_STATE_KEY` is therefore **not a Notion session token**. It is the root decryptor for encrypted runtime-state archives.

## 2. Where `RUNTIME_STATE_KEY` is known / suspected

### Qwen Circle environment/context — PROVEN_PRESENT at successful preflight

The real Qwen session preflight at `7ad56bac97036147962c4c0ea797617984eb248a` required `RUNTIME_STATE_KEY`, restored encrypted runtime and made a real upstream `/api/models` request. It passed. This is the strongest evidence in the current corpus that a usable decryptor exists in a remote executor.

Classification: **PROVEN_PRESENT at the successful Circle run**. Current presence should be revalidated by execution rather than assumed forever.

### GitHub repository secret on `qwen-free-api` — REFERENCED_ONLY

`.github/workflows/qwen-secret-bridge.yml` and the later Notion self-hosted workflow reference `${{ secrets.RUNTIME_STATE_KEY }}`.

No successful self-hosted run proves that this GitHub repository secret is actually populated. The current Notion self-hosted run `33801997605` remains queued and has never reached the step that would test the secret.

Classification: **REFERENCED_ONLY**.

### Local migration roots — LOCAL_SOURCE_POSSIBLE

The private migrations intentionally ignored `DO_NOT_COMMIT_RUNTIME_STATE_KEY.txt` and `.runtime-state/plain/`.

Recorded source roots:

- Qwen: `C:\Users\user\Downloads\QwenFreeApi`
- Notion: `C:\Users\user\Downloads\NCM28_IDENTITY_BOUND_OWNERSHIP_LOCAL_CANDIDATE_20260815`

Their migration provenance timestamps are nearly simultaneous and both use policy `code-plain-runtime-state-encrypted`, suggesting the same migration procedure. This makes a shared decryptor plausible, but **does not prove** the two projects used the same key or that the ignored local key file still exists.

Priority local recovery checks, if that Windows filesystem becomes available:

1. exact ignored filename `DO_NOT_COMMIT_RUNTIME_STATE_KEY.txt` in/near both roots;
2. `$HOME/runtime-state-restored` / `%USERPROFILE%\runtime-state-restored`;
3. `~/.notionagents/notion_account.json` and `~/.notionagents/accounts/*.json`;
4. old project-local `.runtime-state/plain/` directories.

Do not copy recovered plaintext credentials into public repositories or logs.

### Google Drive

Connected Drive search for `RUNTIME_STATE_KEY`, `DO_NOT_COMMIT_RUNTIME_STATE_KEY`, `QwenFreeApi`, and the recorded Notion local-source directory returned no indexed match.

Classification: **NO INDEXED BACKUP FOUND**; absence from Drive search is not proof that no external/local backup exists.

## 3. Qwen credential material

Qwen runtime ignores plaintext `config/account.json`, `config/accounts/*.json`, browser profile state and `.runtime-state/plain/`.

The private repo contains encrypted Qwen runtime plus multiple encrypted Chrome-profile LFS objects. Real preflight proves at least one restored Qwen session was usable at the upstream boundary.

The Qwen account/session material and `RUNTIME_STATE_KEY` are distinct:

- Qwen account tokens/cookies = provider credentials inside restored state;
- `RUNTIME_STATE_KEY` = decryptor for the encrypted runtime envelope.

## 4. Self-hosted runners are executors, not key stores

### `qwen-secret-bridge`

Label: `[self-hosted, Linux, X64, qwen-secret-bridge]`.

Run `33801997605` is still queued. No Notion provider call and no secret-presence check occurred.

Classification: **OFFLINE/UNAVAILABLE EXECUTOR**, not a credential source.

### `ff-win`

Notion has a separate `[self-hosted, Windows, X64, ff-win]` execution path. A bounded Notion local-runtime preflight was queued as run `33836676438` and also remains queued.

Classification: **OFFLINE/UNAVAILABLE EXECUTOR** at the latest poll. It remains useful if the machine returns because it can inspect already-restored local runtime without needing to transport credentials through public CI.

## 5. Circle control credentials and alternate wake paths

### `CIRCLE_CONTINUATION_KEY`

Used by Circle dynamic configuration. Classification: **PLATFORM_EPHEMERAL** / CI-provided continuation capability, not a general Circle API root token.

### Direct Circle API token

No committed `CIRCLE_TOKEN` / v2 pipeline-trigger helper was found in the audited repos, and the current ChatGPT worker environment does not expose one.

Classification: **NOT FOUND IN CURRENT WORKER / REPO CORPUS**.

### Custom Circle webhook — important alternate control-plane finding

`qwen-workspace` contains a completed Free Fabric wake architecture based on Circle Custom Webhooks rather than a Circle API token.

Root/config names:

- `CIRCLE_CUSTOM_WEBHOOK_URL`
- `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL`

`remote-wake-deploy.mjs` accepts these values and installs them as **Cloudflare Worker secrets**. It never exposes the URL in normal output and redacts it from command output.

The generic provider execution target for Qwen explicitly declares:

- transport = `circle_custom_webhook`
- wake secret name = `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL`

The Worker resolves that secret at runtime and posts a bounded execution envelope to the Circle webhook. The URL is validated as HTTPS CircleCI and is omitted from target-list responses.

Classification: **REAL SECRET-BACKED CONTROL MECHANISM IN THE DESIGN**.

Important limitation: current evidence proves this mechanism was designed/used for the Qwen generic provider executor. It does **not yet prove** that its Circle target is the same project/context that holds the Notion `RUNTIME_STATE_KEY`, nor that it can execute the prepared Notion/F51 carrier unchanged.

Therefore this is the highest-value new compatibility investigation:

> Determine whether the existing `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL` target wakes a Circle project/job with access to the same key-bearing context that passed Qwen runtime restoration. If yes, adapt one bounded private execution envelope to restore the mirrored Notion archive, run Notion preflight, and immediately continue F51 on GREEN. If not, document the exact context/project mismatch and stop treating it as a candidate.

This can avoid dependence on a direct Circle API token.

## 6. Cloudflare / Free Fabric root and derived credentials

Two credential models exist and must not be conflated.

### qwen-workspace global bootstrap

Root inputs:

- `CLOUDFLARE_EMAIL`
- `CLOUDFLARE_API_KEY`
- optional/selected `CLOUDFLARE_ACCOUNT_ID`

From these, bootstrap code derives:

- `FABRIC_RUNNER_TOKEN` — **DERIVED** HMAC credential;
- `FABRIC_VERIFIER_TOKEN` — **DERIVED**, deliberately distinct.

The deploy path stores those derived values and Circle webhook URLs as Cloudflare Worker secrets.

### KONTUR staging

KONTUR's staging workflow separately references:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

This is a different credential form from qwen-workspace's email/global-API-key bootstrap. Do not substitute one for the other without explicit compatibility proof.

## 7. GitHub credentials

### `GITHUB_TOKEN`

GitHub Actions built-in ephemeral token. **PLATFORM_EPHEMERAL**. Scope varies by workflow permissions.

### `AUTOPILOT_GITHUB_TOKEN_2`

Previously capability-probed from a Circle environment:

- authentication/user read: worked;
- repository listing: worked;
- public repository creation: worked;
- private `kontur` read: failed.

It created `Ai-b0ss/free-fabric-ci` and is useful for bounded public-repo operations, but it is **not** a private Notion/KONTUR read credential and is not a substitute for provider/session secrets.

## 8. AI Mirrors keys

### `TELEGRAM_BOT_TOKEN`

The AI Mirrors current-binding workflow used the GitHub secret and the exact current-binding proof run passed. Therefore it was **PROVEN_PRESENT at that run**. This key is unrelated to Free Fabric Notion/F51.

### AI Mirrors runtime decryptor

AI Mirrors follows the same encrypted-runtime hygiene pattern and has its own small encrypted runtime object. The corpus does not prove whether its decryptor is identical to Qwen/Notion `RUNTIME_STATE_KEY`. Do not assume key reuse.

## 9. Optional/provider template credentials

The provider incubator / adapters support names such as:

- `NVIDIA_API_KEY`
- `TOKENROUTER_API_KEY`
- OpenCode-compatible upstream API key/env
- login/session flows for other experimental providers

Classification: **TEMPLATE_ONLY / OPTIONAL** for current release unless a specific packet selects one. They are not the current Notion/F51 blocker.

## 10. Current release-impact map

| Material / surface | Current evidence | Release relevance |
|---|---|---|
| Notion `token_v2` / account JSON | inside preserved encrypted runtime | **P0** provider proof input |
| Notion encrypted runtime OID `694d9ae...` | present in Notion + qwen private carrier | **P0**, not lost |
| `RUNTIME_STATE_KEY` in successful Qwen Circle context | PROVEN_PRESENT at real Qwen preflight | **P0 best remote decryptor evidence** |
| `RUNTIME_STATE_KEY` as qwen GitHub secret | REFERENCED_ONLY | do not wait on it |
| `qwen-secret-bridge` runner | queued/offline | noncritical fallback |
| `ff-win` runner | queued/offline | useful local fallback |
| direct `CIRCLE_TOKEN` | not found | not required if webhook path works |
| `QWEN_CIRCLE_CUSTOM_WEBHOOK_URL` | real Cloudflare-secret-based wake design | **P0 compatibility investigation** |
| `CIRCLE_CUSTOM_WEBHOOK_URL` | real generic Circle wake design | P1 alternate control |
| `FABRIC_RUNNER_TOKEN` / verifier | derived Cloudflare runtime auth | orchestration, not Notion credential |
| `AUTOPILOT_GITHUB_TOKEN_2` | public-capable, private-scope insufficient | public CI only |
| Cursor | unavailable until 2026-09-18 | excluded from critical plan |

## 11. Recommended unblocking sequence

1. **Stop waiting on both offline self-hosted queues.** Preserve them as fallbacks only.
2. **Exploit the strongest proven key location first: Circle.** The success at `7ad56bac...` proves a Circle environment/context could decrypt runtime.
3. **Investigate the existing Qwen-specific Circle Custom Webhook path before inventing another trigger mechanism.** Verify which Circle project/context it wakes and whether that execution sees `RUNTIME_STATE_KEY`.
4. If compatible, run a single composite private carrier: restore Notion runtime -> classify up to the legitimate configured pool -> one bounded actual Notion completion -> on GREEN immediately start Qwen+Notion local services -> long `--require-tools` F51. No scheduler-hour gap between preflight and F51.
5. If webhook target lacks the key/context, use the finding to identify the exact Circle project/context boundary. Do not retry generic pushes blindly.
6. If local Windows becomes reachable first, inspect the ignored/local paths above and use already-restored runtime; no need to recover a remote decryptor if plaintext authorized state is already local.
7. Keep public GitHub Actions for public reusable protocol/acceptance tooling only; never move provider credentials/runtime plaintext there for capacity.

## 12. Things this research deliberately does not claim

- It does not claim any plaintext secret value.
- It does not claim the GitHub `RUNTIME_STATE_KEY` secret exists merely because a workflow references it.
- It does not claim Qwen and Notion encrypted archives use the same decryptor, although the migration evidence makes that plausible.
- It does not claim the Qwen Circle custom webhook can already run Notion; compatibility must be proven.
- It does not interpret an account-specific Notion AI entitlement restriction as a product/system defect.
- It does not authorize account rotation to evade an explicit trust/safety/abuse denial.

## Immediate conclusion

The evidence says **credentials are much more likely preserved than lost**. The bottleneck is routing execution to a place that can access the decryptor/runtime. The best next technical hypothesis is no longer `wake qwen-secret-bridge`; it is **reuse the existing secret-backed Circle custom-webhook control plane to reach the already-proven key-bearing Circle boundary, or precisely prove why that target/context differs**.
