# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~07:0x MSK
Worker: `NOTION_AGENT`

## Exact heads

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`
- Circle connectivity is already proven. Do not re-probe it.
- Windows remains forbidden until exact Agent pair + same-byte Agent/Core Stage-B/full local matrix are green.

## Fresh materializer safety result

A real TOCTOU defect was reproduced on prior Agent head `9c2098feebd186421629f80e62787d0569f8b30c`:

1. wrapper validated `payload/account_pool.py` as a plain file;
2. before the base materializer reached its internal `Path.resolve()`, the target could be swapped to a symlink (or its parent directory replaced by a symlink);
3. the old base path canonicalization would then follow that late alias toward an external path.

Root fix is now in PR #8:

- `tools/materialize_agent_wiring_with_tombstones.py` blob `4ae3b1c2d23bbfa8980bd4a3652ee9d2941b1cd5`
- new regression `tests/test_materialize_agent_wiring_late_alias_substitution.py` blob `4750c57e17055f1e6896382a0f355801492bc82f`

The wrapper now passes a guarded lexical Path into the base transaction. Alias checks run again at the base `resolve()` boundary and again when that Path crosses `os.fspath()` into filesystem operations. This closes the reproduced late final-target and late parent-alias substitutions without changing product transformation logic.

Focused local semantic regression on Linux/POSIX: **3/3 PASS**:
- final product file swapped to symlink after wrapper validation -> rejected;
- parent directory swapped to symlink before base resolve -> rejected;
- parent directory swapped after resolve but before filesystem boundary -> rejected;
- external target bytes remain unchanged in all scenarios.

This is Linux/POSIX evidence. Native Windows path semantics remain part of the later targeted Windows gate.

## Exact Agent pair contract

Frozen product preimages are unchanged by the safety fix:

- `payload/account_pool.py` preimage `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes
- `payload/server.py` preimage `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes

Deterministic transformation recipe remains:

- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`
- server/startup materializer `20c2fb2e550daab52f3d27e791fa500002a73735`
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`
- base pair transaction `30fb89286eb4457b25b2145918279fec2d735042`
- canonical wrapper now `4ae3b1c2d23bbfa8980bd4a3652ee9d2941b1cd5`

Expected transformed product bytes remain:

- `account_pool.py` = `c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes / SHA-256 `5d233686d882a2819e9ed19b73d4ed6ce55ef794385db2447c2801000844c38a`
- final `server.py` = `273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes / SHA-256 `d1492ef4a0dc2842c0bdde417945091d3949485283ebf7be729bdbcced0010a1`

Historical pair PASS from an older Agent head is not proof for `3cc0c0be...`. Pair must be rerun on this head: `--check -> apply -> readback SHA/size -> compile`.

## Mandatory Agent matrix

Use the full canonical Agent matrix already required by final coverage, plus the new regression:

`tests.test_materialize_agent_wiring_late_alias_substitution`

The final composed/Windows coverage must explicitly require this module before Windows is authorized. Existing coverage `b51f11f27d7ef2c52bc6fd93d3469caf3d6d4ae3` predates this regression and must be respun/equivalently extended together with its Windows-readiness pin after same-byte local composition is green. Do not run Windows against the old coverage pin.

Critical existing regressions remain mandatory, especially:
- `tests.test_subagent_tombstone_post_replace_sync_failure`
- `tests.test_server_subagent_tombstone_restart`
- `tests.test_delegated_cancellation_lifecycle`
- `tests.test_startup_status_repeated_cancellation`
- dynamic reservation/reselect/failover tests
- prompt mode / prompt identity / delegated owner-mode tests
- tool-loop uncertain-side-effect and lifecycle drain tests.

## Corrected delegated owner/engineer five-file set

- `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`
- `a9d15b79b421cd29b094b549be06d2b0319e26d9`
- `f36e9c91355dec667173b6265dd550554fb0f05d`
- `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`
- `f47838b338f2bd94163cf466110f939c065ac041`

Do not use obsolete entrypoint blob `aebefce4...`.

## Core boundary

Core currently owns Stage-B-only work and must not be overlapped. After Agent releases exact pair + full Agent matrix:

1. Core consumes exact `c9ca6f3b.../48066 + 273db94a.../116047` with readback, not a prose claim.
2. Compose Stage-B on the same bytes.
3. Run full Agent+Core local matrix.
4. Run final coverage/readiness with the new late-alias regression included and `--candidate-root` bound to the same tree.
5. Only complete local same-byte green authorizes one targeted Windows Server 2022 run.

## Persistent memory

Last normatively verified LATEST remains:
- pointer blob `740b0e3515f1fb9a7f523f71749b224b1fda9c0a`
- capsule `20260823T225025Z-8eae144a28`
- archive SHA-256 `db911f8d4e419c5d83f8c71bdb8258a2399dd1faf241ec80df328bb5c235cb74`

Do not publish a replacement LATEST unless the full v4 protocol is completed: restore -> checkpoint -> pack -> immutable upload -> readback every part/manifest -> verify -> reread LATEST -> CAS update, preserving PREVIOUS. No manual reconstruction of unknown bytes.

## Next exact step

On fresh PR #8 head `3cc0c0be...`:

1. rerun canonical pair `--check -> apply -> readback SHA/size -> compile` in an isolated local tree;
2. run the full mandatory Agent matrix including the new late-alias test on those transformed bytes;
3. persist exact pair bytes or a byte-exact reconstructible handoff for Core;
4. release Agent ownership so Core can perform same-byte Stage-B composition.

No Circle/Windows/live Notion/Codex/accounts/secrets/main/merge/production before those local gates.