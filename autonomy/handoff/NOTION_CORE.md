# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `57bafc097d610e8055ab28f2fadc36a85af8200a`.
Core-relevant exact blobs on that head:
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

На старте этого прохода точным `capsule_runtime_v4.py` был восстановлен канонический `LATEST` `20260822T164624Z-da2720d075`, archive SHA-256 `0ab562b0e83f3c444b5f4ac56102d845ec71ee40da6fb240be7be3d2899c479e`.

После V48 создана новая immutable capsule:
- `20260822T174313Z-983e2ae2ca`;
- archive SHA-256 `d52325feb2e8b2c44c55ea152910565e58f34b20dfe6b4ffc48de495ede8e150`;
- parts: 1;
- part Git blob readback `237d4eb0caabb70402131a9b764a74dc63cf1855`;
- manifest Git blob readback `eb8c35b270e0b5f26c931398abaac9d36bf6fbe3`.

Старый `LATEST` сохранён как `PREVIOUS`, затем новый указатель опубликован через CAS от родительского blob `4e8f74da04b45501f7e2c566a549bd42aab37a94`. Финальный readback `LATEST.json` имеет blob `ea3964022f2ceb4f09c15d8d8c74dc8baf291949`. Не реконструировать неизвестные bytes и не force-write pointer.

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

## V46/V47 — больше не основание exact composed proof

V46 был устаревшим, потому что обходил текущий tombstone pair materializer.
V47 исправил это и стал вызывать `tools.materialize_agent_wiring_with_tombstones.materialize(...)`, но оставил новый provenance-gap: он фиксировал три product preimage blob, а Agent transformation toolchain импортировал динамически из checkout.

Между прежней интеграционной точкой `eaa7e812...` и текущей `57bafc097...` сами product preimages не изменились, но `tools/materialize_agent_wiring.py` изменился. Значит старый V47 PASS не смог бы однозначно доказать, какими именно helper bytes построены composed файлы.

Evidence: `autonomy/evidence/notion/20260822T1840Z_v48_frozen_agent_toolchain_composition_evidence.json`.

## V48 — текущий exact composition materializer

Создан `autonomy/evidence/notion/20260822T1840Z_v48_frozen_agent_toolchain_composition_materializer.py`, Git blob `dab975abd730481d0986b38cb2b2fb2d816e4244`.

V48 до любого импорта фиксирует и проверяет exact Git blob всех Agent helper-файлов:
- `tools/materialize_agent_wiring_with_tombstones.py` — `859039a5e408bc84e7046372cdb509131eb37a97`;
- `tools/materialize_agent_wiring.py` — `30fb89286eb4457b25b2145918279fec2d735042`;
- `tools/apply_account_pool_dynamic_reservation.py` — `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` — `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- `tools/apply_subagent_tombstone_wiring.py` — `40ab3a448e33fb8a8c3ce045ef31a815d0554823`.

После этого он проверяет три frozen product preimage blob, выполняет текущую Agent pair/tombstone materialization, накладывает V41/V45, компилирует composed файлы и печатает их exact Git blob SHA. `--apply` разрешён только на изолированной disposable копии.

**V48 exact composed PASS ещё не объявлен**: нужен полный exact checkout текущего PR #8, затем V48 check/apply и актуальный Agent materializer/tombstone/dynamic-reservation cluster на этих же composed bytes.

## Обязательные durable-replay инварианты

В итоговом composed candidate сохранить: exact canonical replay с неизменными IDs; separate provider intents; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical task; hard crash after intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.
Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Exact checkout PR #8 source -> V48 без `--apply` -> V48 на изолированной копии с `--apply`; сохранить post-composition blobs.
2. На V48 composed bytes прогнать текущие Agent pair-materializer/journal-path/tombstone/dynamic-reservation tests + targeted V41/V45 protected-mode regressions. Старые отдельные PASS не переносить автоматически.
3. На этих же composed bytes встроить Stage-B orchestration: account acquisition -> strict intent -> protected `run_selected/run(..., allow_failover=false)` для всех deliberate provider steps -> canonical Responses/compaction -> strict finalize -> cache/reservation -> client.
4. Прогнать composed matrix: default Agent failover; protected no-failover; late reservation reselection; pool unavailable; intent/final write failure; ambiguous transport; exact retry/restart IDs; planner correction; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
5. Совместить Codex shell-env patch локально.
6. Только после зелёного exact-local composed Stage B — один disposable native-Windows gate с exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
7. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством stable conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
