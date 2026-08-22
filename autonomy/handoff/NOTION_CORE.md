# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `78e0642002af6e8eafa6a7fcafe5dae134a99ae2`.
Core-relevant exact blobs from the previously revalidated V48 boundary remain unchanged by the newest commit; compare `57bafc097... -> 78e064200...` adds only `tests/test_subagent_tombstone_post_replace_sync_failure.py`.
- `payload/server.py` — `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/reservation_aware_lease.py` — `c77b4d5214911def1729243516aec73e43f8d425`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим и Windows

Сначала бесплатные exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates.
CircleCI — только один редкий финальный native-Windows proof по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, через disposable `ci/notion-core-windows-final-gate`, когда Stage A + актуальный composed Stage B уже локально зелёные и Windows semantics остаются последним реальным неизвестным.

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать. На выходе этого прохода все пять старых checks всё ещё `pending`.

## Постоянная память v4

Канонический `LATEST` на старте: `20260822T174313Z-983e2ae2ca`, archive SHA-256 `d52325feb2e8b2c44c55ea152910565e58f34b20dfe6b4ffc48de495ede8e150`, pointer blob `ea3964022f2ceb4f09c15d8d8c74dc8baf291949`.

Этот checkpoint был реально восстановлен точным `capsule_runtime_v4.py` после локальной проверки его Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. После V49 упакована новая immutable capsule:
- `20260822T194513Z-61fd941485`;
- archive SHA-256 `eb9e5f87f4618d63058e67fd2c3a467eff8ffb7e448e85567ddb32914b1ada3b`;
- parts: 1;
- part Git blob readback `d17aa2f970d5e24e7822f2b74806b06295cdff9d`;
- manifest Git blob readback `d438dfeec560fecc2f4dd9f411eeea62a156fdce`.

Перед публикацией `LATEST` был fresh-read и всё ещё имел исходный blob `ea396402...`. Старый указатель сохранён в `PREVIOUS`, затем новый опубликован CAS-обновлением именно от этого blob. Финальный `LATEST.json` указывает на новую capsule и имеет blob `ae813ed8e6810557ab3457cd8b634fc5e36bfa58`.
Не реконструировать неизвестные bytes и не force-write pointer.

## Stage A — закрыт

`V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.
Legacy-state v2 `unsupported/corrupt/persistence_blocked` после load/get fail-closed до Notion и в `/v1/responses`, и в `/v1/responses/compact`. Новый v3 нельзя вводить без этого rollback floor.

## Stage B store — зелёная основа

`V34_V35_EXACT_CLASS_INTEGRATED_PASS`:
- strict separate `provider_intent`;
- exact durable replay с сохранёнными IDs;
- restart;
- detached `get()`;
- duplicate unresolved fail-closed;
- forced NCM28 final-write failure сохраняет intent и блокирует persistence;
- TTL cleanup + replay-unavailable tombstone.

Evidence: `autonomy/evidence/notion/20260822T1240Z_v34_v35_exact_store_integration.json`.

Целевой порядок Core:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## V41–V45 — доказанные границы

- V41: `AccountLease.run(..., allow_failover=True)`; default сохраняет Agent failover, protected Core после intent использует `false`.
- V42: protected transport error выходит напрямую и не попадает в старый outer retry через `AccountPoolExhausted`.
- V43: protected mode обязателен для initial/continuation Responses, planner correction и compaction.
- V44: stream/non-stream — только проекции одного уже долговечно сохранённого canonical Responses object; disconnect после provider-entered не отменяет commit-critical task.
- V45: `allow_failover=false` должен проходить через `DynamicReservationLeaseSession.run_selected/run` и one-shot wrappers, иначе Agent wrapper тихо вернёт обычный failover.

## V48 — frozen composition materializer, но больше не достаточен для final proof

`autonomy/evidence/notion/20260822T1840Z_v48_frozen_agent_toolchain_composition_materializer.py`, Git blob `dab975abd730481d0986b38cb2b2fb2d816e4244`.

V48 фиксирует пять Agent helper-файлов и три product preimage, затем выполняет Agent pair/tombstone materialization, накладывает V41/V45 и компилирует composed files. На границе `57bafc097...` frozen input set был свежим.

Свежий Agent commit `78e0642002af6e8eafa6a7fcafe5dae134a99ae2` добавил только новую регрессию и не изменил эти frozen inputs. Поэтому формально старый preimage-check остаётся свежим, но **V48 больше нельзя считать достаточной границей состава**: новая регрессия доказала существенный product safety state, который V48 вообще не фиксировал.

## V49 — новая стыковая блокировка no-replay

Fresh exact Agent state:
- `payload/subagent_tombstone_store.py` blob `b0e0ac9d911e5311729e997d8715d45857744549`;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` blob `68f124aeac6cceb8de0313d3a2750f68a900901d`.

Текущий `SubagentTombstoneStore._persist_snapshot()` делает `os.replace(tmp, canonical)` и только затем `_sync_parent()`. В `resolve_call()` это означает: mutating local side effect уже выполнен; replace может убрать durable inflight marker; затем parent sync падает; текущий процесс становится uncertain, но fresh restart способен прочитать уже marker-cleared canonical file и разрешить replay уже выполненного side effect. Новый тест именно эту границу фиксирует и ослаблять его нельзя.

Evidence: `autonomy/evidence/notion/20260822T1945Z_v49_agent_no_replay_composition_blocker.json`.
Вердикт: `V48_FROZEN_INPUTS_STILL_FRESH_BUT_FINAL_COMPOSITION_BLOCKED`.

До Agent fix + green restart/tombstone cluster финальный Stage-B composed PASS и native-Windows gate запрещены. После фикса нельзя переносить старый V48 PASS автоматически: следующий exact composition proof обязан заморозить свежий Agent head, исправленный `payload/subagent_tombstone_store.py` и саму новую regression вместе с текущим helper toolchain.

## Обязательные durable-replay инварианты

В итоговом composed candidate сохранить: exact canonical replay с неизменными IDs; separate provider intents; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical task; hard crash after intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.
Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Fresh-read PR #8 каждый проход. Пока head остаётся `78e064200...` и tombstone store blob остаётся `b0e0ac9...`, не объявлять composition достаточной и не запускать final Windows.
2. Независимую Core Stage-B работу продолжать локально: V34/V35 store + V41/V45 protected mode + canonical Responses/compaction projection + strict intent/finalize orchestration.
3. Когда Agent fix появится: сравнить exact changed files; потребовать PASS новой post-replace-sync regression и всего restart/tombstone cluster без ослабления теста.
4. Сразу после Agent fix создать следующую composition version поверх V48: freeze exact fixed Agent head + fixed `subagent_tombstone_store.py` + regression-test blob + current five helper blobs + product preimages; затем check/apply на disposable exact checkout.
5. На тех же composed bytes прогнать Agent pair-materializer/journal-path/tombstone/dynamic-reservation cluster + V41/V45 + Stage-B orchestration matrix.
6. Совместить Codex shell-env patch локально.
7. Только после exact-local composed green — один disposable native-Windows gate с exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
8. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством stable conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
