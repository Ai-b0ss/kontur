# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~10:0x MSK
Worker: `NOTION_AGENT`

## Exact heads

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`
- Circle connectivity is already proven. Do not re-probe it.
- Windows remains forbidden until exact Agent pair + same-byte Agent/Core Stage-B/full local matrix are green.

## Fresh exact pair reproduction on current Agent head

The frozen preimages were reconstructed locally from fresh GitHub bytes and verified by Git blob SHA before transformation:

- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes / SHA-256 `7bd7425331261e8f2d00eb83fc551423dc9cc851b3357147554ea725efc211ae`
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes / SHA-256 `a364cdf0a88ac2f318616b4b633f6f10b6d156b85c8668d4d54b5d884ae28310`

Current immutable recipe:

- account transform `80aeb1872c1cab7f51c33039584b5786e441f9f0`
- server/startup transform `20c2fb2e550daab52f3d27e791fa500002a73735`
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`
- base pair transaction `30fb89286eb4457b25b2145918279fec2d735042`
- canonical guarded wrapper `4ae3b1c2d23bbfa8980bd4a3652ee9d2941b1cd5`
- late-alias regression `4750c57e17055f1e6896382a0f355801492bc82f`

Fresh isolated check/apply/readback/compile result: **PASS**.

- check phase left both exact preimages unchanged;
- transformed `account_pool.py` read back as `c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes / SHA-256 `5d233686d882a2819e9ed19b73d4ed6ce55ef794385db2447c2801000844c38a` / compile PASS;
- transformed final `server.py` read back as `273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes / SHA-256 `d1492ef4a0dc2842c0bdde417945091d3949485283ebf7be729bdbcced0010a1` / compile PASS;
- server intermediate before tombstone remains `5c04b8cce34b29e63bf1839d59476f8081763c2b`; do not use it as the final server byte.

Fresh Linux/POSIX focused late-alias negative probe on the current wrapper semantics: **3/3 PASS**. Late final-file symlink, late parent symlink before resolve, and parent symlink after resolve/before filesystem boundary are all rejected; external target bytes stay unchanged.

Machine-readable evidence, already read back from GitHub:

`autonomy/evidence/notion/20260824T0815Z_agent_fresh_pair_local_reproduction.json`

blob `cbe3676dc61cc9e828b5a1bcc244896dd7ca0a9f`.

## Important remaining boundary

This is a fresh exact local pair reproduction, but **not yet full Agent safety green**. The full mandatory Agent/delegation matrix on `3cc0c0be...` has not yet been executed in the ChatGPT local runtime. Historical green from older heads is not transferred.

Direct `fetch_blob` of transformed output SHAs `c9ca6f3b...` and `273db94a...` still returns 404 in the product repo. Therefore do not describe PR #8 itself as pair-materialized yet. Core can nevertheless reconstruct the pair byte-exact without guessing from the immutable preimages + immutable transform blobs + exact output SHA/size/SHA-256 above.

## Mandatory Agent matrix

Final composed coverage/readiness currently pinned by controller + Agent hardening:

- coverage verifier `fafc7eb733da90d306b4fa599e57b6ecd921a357`
- Windows readiness v10 `2496278f56c67ded32fdc15ae6b116971e8410af`

The full canonical matrix must actually run on the transformed pair before Agent releases it as safety-green. Critical modules include at least:

- `tests.test_subagent_tombstone_post_replace_sync_failure`
- `tests.test_subagent_tombstone_store`
- `tests.test_server_subagent_tombstone_restart`
- `tests.test_delegated_cancellation_lifecycle`
- `tests.test_materialize_agent_wiring*`, including target-path and late-alias regressions
- dynamic reservation/reselect/failover and reservation-aware lease tests
- prompt mode / prompt identity / Responses prompt wiring + HTTP contract
- delegation policy/dispatcher/model-step/entrypoint/runtime tests
- delegated tool-loop malformed/uncertain-side-effect tests
- startup cleanup + repeated cancellation tests
- lifecycle drain/rebind/durable tool guard tests
- account-pool parallelism.

### Matrix composition boundary discovered 2026-08-24 ~08:55 MSK

Do **not** run/count the mandatory prompt/delegation matrix on only the raw PR #8 delegation files. On exact head `3cc0c0be...`, raw `delegation_policy.py=cc50fc7373578262e6051e76716563a98f8f4935` and `delegation_dispatcher.py=e888c87262d4307a0c5a7de9e315e01601f20a33` still have no delegated owner-mode fields. A direct local negative probe proves `DelegationRequest(..., prompt_mode="owner", owner_system_prompt="SECRET")` fails at construction with `TypeError: unexpected keyword argument 'prompt_mode'`.

Therefore a green matrix over only raw PR #8 delegation bytes would be a false proof for delegated `engineer/owner` behavior. The mandatory Agent matrix must run on:

1. the exact transformed pair `account_pool=c9ca6f3b...` + final `server=273db94a...`; **and**
2. the corrected five-file owner/engineer overlay listed below.

If the overlay is not composed, owner-mode must remain explicitly NOT_READY and Windows remains forbidden.

Fresh targeted local probes in this line, reconstructed from current-head source slices:

- current-head delegation policy: **10/10 PASS** for its existing identity/budget contract;
- dispatcher/lifecycle semantics: **10/10 PASS**;
- dynamic reservation session semantics: **5/5 PASS**.

These 25 targeted PASS are supporting evidence only and do not replace the pending full exact transformed-pair + overlay matrix.

Machine-readable evidence read back from GitHub:

`autonomy/evidence/notion/20260824T0855Z_agent_matrix_prompt_overlay_boundary.json`

blob `9878e375491c7605ad65f2040b95ec4eaec31365`.

No Windows until this complete composed matrix and Core same-byte Stage-B are green on one tree.

## Corrected delegated owner/engineer five-file set

- `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e` — `payload/delegation_policy.py`
- `a9d15b79b421cd29b094b549be06d2b0319e26d9` — `payload/delegation_dispatcher.py`
- `f36e9c91355dec667173b6265dd550554fb0f05d` — `payload/notion_delegated_model_step.py`
- `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e` — `payload/subagent_entrypoint.py`
- `f47838b338f2bd94163cf466110f939c065ac041` — `payload/server_subagent_lifecycle.py`

Do not use obsolete entrypoint blob `aebefce4...`.

### Windows-readiness owner-overlay pin hardening — 2026-08-24 ~10:00 MSK

A fresh falsification found that readiness v9 (`349b6005255382bab7284c42da43c2d163a178be`) rehashed only five product files and did **not** require the corrected five-file delegated owner/engineer overlay. Therefore a composed candidate could theoretically retain the raw PR #8 delegation files while a self-consistent manifest still satisfied all byte checks outside that overlay.

Root fix is now control-only Windows readiness v10 blob `2496278f56c67ded32fdc15ae6b116971e8410af`, schema `notion_windows_ready_candidate_v10`:

- all five delegated owner/engineer files are added to candidate-root byte rehash;
- manifest `composed_blobs` must contain the five exact blobs listed above, not merely arbitrary 40-hex values;
- candidate-root bytes must rehash to those manifest values, so raw/current PR #8 delegation files or one-byte drift fail closed.

Local synthetic falsification/positive control: **3/3 PASS** — wrong-but-self-consistent overlay is `NOT_READY`; exact-pin fixture is `PASS`; single overlay byte drift is `NOT_READY`.

Durable evidence: `autonomy/evidence/notion/20260824T1000Z_owner_overlay_windows_readiness_pin.json`, blob `38ace654bfe583b2bad6a83f443aaaec26706e05`.

This closes only the final byte-admission hole. It is **not** full Agent safety-green and does not authorize Windows by itself.

## Core boundary / next exact step

Agent owns the exact pair + mandatory Agent matrix. Core Stage-B must not be overlapped.

Next:
1. build the local Agent candidate from exact transformed pair + corrected five-file owner/engineer overlay;
2. run the full mandatory Agent matrix against that exact composed Agent candidate;
3. if green, mark Agent safety-green and release exact recipe/digests/test manifest to Core;
4. Core reconstructs/readbacks the same candidate, composes Stage-B on those same bytes and runs full Agent+Core local matrix + coverage `fafc7eb7...` + readiness v10 `2496278f... --candidate-root`;
5. only then one targeted Windows Server 2022 run becomes admissible.

No Circle/Windows/live Notion/Codex/accounts/secrets/main/merge/production in the current Agent pair/composition stage.
