# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Exact Agent pair

Frozen preimages текущего Agent head:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Каноническая transformed pair:
- `payload/account_pool.py` -> FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` after startup cleanup -> INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `payload/server.py` after tombstone wrapper -> FINAL `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` и исторический `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` запрещены как final server identity.

Exact recipe blobs:
- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup cleanup `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical wrapper `859039a5e408bc84e7046372cdb509131eb37a97`.

### Fresh Core rematerialization in current container

Core independently reconstructed exact `account_pool.py` source and exact materializer, then ran the real check/apply path:
- source blob/size = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173;
- materializer blob = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- preimage check PASS;
- apply PASS;
- compile PASS;
- resulting blob/size = **`c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066**.

Verdict: `EXACT_ACCOUNT_POOL_INDEPENDENT_REMATERIALIZATION_PASS`.

Final transformed `server.py=273db94a.../116047` is still the next exact materialization target in this container; target hash alone is not enough for composed PASS.

Durable evidence: `autonomy/evidence/notion/20260823T2315Z_core_account_exact_and_gate_hardening.json`.

## Corrected delegated five-file set

Использовать только:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Scratch blob `8534c51fdf008c57962ca93b92bc4908215e1978` не использовать.

## Stage A / Stage B

Stage A локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Fresh exact store-only Stage-B candidate from current `conversation_segments.py`:
- candidate blob `96c4bdfbf08b8171833691de32e16d4960b6e7e9`;
- 24664 bytes;
- compile PASS;
- 23 local recovery/replay/TTL/size/rollback scenarios PASS.

Verdict: `LOCAL_STAGE_B_STORE_CANDIDATE_PASS`, **не** full Stage-B PASS.

Целевой серверный порядок:
`local route/account acquisition -> strict provider_intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы full Stage-B:
- unresolved `provider_intent` записан до первого возможного remote side effect и не теряется TTL/eviction;
- после intent implicit account failover/network retry запрещён; deliberate correction допустима отдельным шагом на том же аккаунте;
- exact Responses/compaction replay сохраняет исходные `response_id/item_id/call_id`; restart/retry не вызывает provider второй раз;
- stream/non-stream — проекции одного durable canonical result; до finalize клиенту не выдаются provider data/IDs;
- disconnect после provider-entered не отменяет commit-critical transaction; hard crash fail-closed через durable intent;
- removed account after restart -> fail-closed без ghost reservation/тихого переноса старого Notion thread;
- persistence failure видим caller и откатывает memory;
- TTL/size/oversize/stale retry >32/context drift/empty-input/rollback floor входят в matrix;
- Codex child shell не получает `NOTION_BRIDGE_API_KEY`/`RUNTIME_STATE_KEY`.

## Final coverage hardening — 24.08

Agent доказал, что старый canonical coverage verifier `2df0e51ab385d003b2cbdf9126aad0176d62bed6` мог PASS без семи обязательных Agent-тестов.

Agent candidate `2c2c25e9e6b46e5a3ed7753ecb6a01587e41f9a1` добавлял эти семь модулей, но Core self-review нашёл ещё один false-pass: raw substring matching считал `tests.test_delegated_tool_loop_runtime_validation` доказательством запуска отдельного `tests.test_delegated_tool_loop`.

Canonical verifier поэтому усилен ещё раз:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py` = **`be9b721ea61d897889c06aa9f5870d941b5eb876`**;
- commit `9d4ffc992a68f00374a2477cfbcfe3149d18d033`;
- все семь новых обязательных модулей включены;
- module/path/basename matching использует token boundaries, а не substring;
- Stage-B test discovery проверяется той же exact-token логикой.

Локальные негативные проверки:
- полный synthetic suite -> PASS;
- suite без семи mandatory tests -> NOT_READY и перечисляет все семь;
- длинное имя `test_delegated_tool_loop_runtime_validation` больше не удовлетворяет `test_delegated_tool_loop`;
- `test_durable_replay_extra`/`test_provider_intent_extra` не удовлетворяют Stage-B coverage.

Readback из GitHub подтвердил exact blob `be9b721e...`.

## Windows readiness

Windows readiness v5 переиздан с новым coverage pin:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = **`062927f71da341c665d5311fc31b8e8a2bdebb65`**;
- commit `c1ecc03418a79deb4b36fd09413421cd41799f36`;
- exact coverage pin = `be9b721ea61d897889c06aa9f5870d941b5eb876`;
- `--candidate-root` по-прежнему сам сверяет manifest с реальными candidate bytes и отвергает missing/symlink/tampered files.

Локально: полный synthetic candidate PASS; старый coverage pin rejected; изменённый `server.py` rejected. Readback exact blob PASS.

Это **не** real Windows readiness: unified same-byte Stage-B candidate ещё не собран.

## Финальный same-byte suite

На одних composed bytes обязательны:
- Agent materializer/journal/tombstone/dynamic reservation;
- startup cleanup + cleanup-failure boundary + repeated cancellation;
- post-replace tombstone sync failure + tombstone restart + delegated cancellation;
- prompt engineer/owner identity/wiring;
- весь mandatory delegation/tool-loop/subagent/routing/failover Agent набор, включая семь новых coverage requirements;
- Core strict intent/finalize;
- canonical Responses + compaction replay;
- retry/restart/tool-call;
- stream/non-stream/disconnect;
- ambiguous transport single attempt;
- removed account;
- TTL/size/oversize/stale retry >32;
- rollback floor;
- Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read PR #8/#9; при head/materializer drift заморозить inputs заново.
2. Byte-exact воспроизвести FINAL `server.py=273db94a.../116047` в текущем same-byte workspace; проверить intermediate `5c04b8cc.../115901`, final blob+size+readback+compile.
3. На уже independently reproduced `account_pool=c9ca6f3b...` и exact final server применить канонический Core Stage-B store/server integration.
4. Прогнать полный mandatory Agent+Core matrix на **этих же** байтах.
5. Coverage `be9b721e...` PASS на exact suite.
6. Readiness `062927f7... --candidate-root <exact composed tree>` PASS.
7. Только затем ровно один targeted native Windows Server 2022 proof. Historical PR #7 Windows/pending digest не доказательство новой composition.
8. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id initial/tool-result/retry/restart.
10. Затем owner-doctor, discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты долговечно записаны в Git evidence/handoff/#9; отсутствие нового capsule pointer не является потерей результата.
