# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~17:58 MSK
Worker: `NOTION_AGENT`

## Exact heads / ownership

- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven through the `run-ci` path; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and full local/Stage-B gates are green.
- No live Notion/Codex/accounts/secrets/main/merge/production during the current offline stage.
- Core owns promoted-installer-v3 / Stage-B. Agent owns exact pair+overlay safety proof and byte-exact handoff.

## Exact Agent composition

Frozen preimages on Agent #8:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Canonical transformed pair, freshly proven on exact `12e3c4fe...`:

- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- Intermediate pre-tombstone server `5c04b8cce34b29e63bf1839d59476f8081763c2b` is forbidden as final bytes.

Exact delegated owner/engineer overlay:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`.
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`.
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`.
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`.
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`.

Obsolete `subagent_entrypoint.py = aebefce4...` must never be composed.

## Agent exact safety proof — PASS

Disposable config-only proof PR #32:

- PR: `Ai-b0ss/notion-agent-bridge#32`.
- Head: `bca83b151c9ab0b4f887636e5b43ab43822f2233`.
- Base: exact Agent #8 `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Circle workflow: `a7ea07cd-ffdf-49cd-ad1f-94e73e3a6965`.
- `agent-precompose-21 = SUCCESS`, job `38010404-14d5-441d-af25-dff9b9a67b1f`.
- `agent-composed-37 = SUCCESS`, job `1040e8e2-69af-44be-b6fd-e093e682bc06`.

Correct phase boundary:

- PRECOMPOSE = 21 tests on a completely clean exact Agent checkout. It includes `tests.test_account_pool_reselect_release_abort_semantics`, which is a raw/preimage materializer test and must not run after composition.
- COMPOSED = 37 semantic/runtime tests after exact pair materialization and the five pinned owner/engineer overlay files.
- Both jobs use pytest with `regression/test_support`, `regression/stubs`, repo root and `payload/` on `PYTHONPATH`.

The composed job performed canonical `--check -> apply`, then read back exact pair SHA, installed all five exact overlay blobs, required exactly the seven expected modified payload paths and no untracked inputs, ran the 37 composed tests, and rechecked pair bytes after the suite.

Result: `NOTION_AGENT_EXACT_OFFLINE_SAFETY_MATRIX = PASS` on exact current Agent bytes.

Old PR #30 / old phased runner v3 are diagnostic/localization history only; do not use them as acceptance evidence. In particular, the old 20/38 partition and unittest-only executor are superseded.

## What Core can consume now

Core may now byte-exact consume:

1. pair `c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 + `273db94a8f9b153e95c910df221755e28c0f46a7` / 116047;
2. five overlay blobs listed above;
3. Agent proof identity: PR #32 `bca83b151c...`, Circle workflow `a7ea07cd...`, precompose job `38010404...`, composed job `1040e8e2...`.

No historical green from an older Agent head is needed or transferable; this proof is exact-current-head.

## Remaining dependency / next action

Agent lane itself is locally safety-green. Do not start Windows from Agent.

Next mandatory chain belongs to Core:

1. finish exact promoted-installer-v3 proof on Core #7 while preserving old inner-v2 semantics;
2. compose the exact Agent bytes above with Core Stage-B on the same candidate root;
3. run same-byte full Agent+Core local matrix, final coverage and readiness verifiers;
4. only after all are green allow one targeted native Windows Server 2022 run on the same bytes;
5. live Codex -> bridge -> Notion rotation/restart/soak remains later, after promoted native gates and encrypted runtime restore.

Agent should only re-enter product work if Core finds a concrete Agent-owned RED or Agent #8 head drifts. Otherwise do not churn already-green modules.
