# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `eaa7e812cb502649fb5291143070b33bfc94380e`.
Core-relevant exact blobs on that head:
- `payload/server.py` — `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/reservation_aware_lease.py` — `c77b4d5214911def1729243516aec73e43f8d425`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим и Windows

Сначала бесплатные exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates.
CircleCI — только один редкий финальный native-Windows proof по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, через disposable `ci/notion-core-windows-final-gate`, когда Stage A + актуальный composed Stage B уже локально зелёные и Windows semantics остаются последним реальным неизвестным.

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать.

## Постоянная память v4

Канонический проверенный `LATEST` на старте этого прохода:
- capsule `20260822T124805Z-7a66179727`;
- archive SHA-256 `6f87c85b580999d6e03bde8eb0701b7dbede291d0155edb8a2e13fd4555287f6`;
- parts: 1;
- `LATEST.json` Git blob `18ce26b25c5b8f00c1e8eca449a593531d2fd331`.

`LATEST`, manifest и единственный part перечитаны. Не переключать pointer без полного точного `capsule_runtime_v4.py restore -> pack -> readback -> CAS`; неизвестные bytes не реконструировать и force-write не делать.

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

## V46 — признан устаревшим как основание composed PASS

`20260822T1605Z_v46_agent_core_composition_materializer.py` напрямую применяет только старые `apply_account_pool_dynamic_reservation` и `apply_startup_status_cleanup`, затем V41/V45.

Свежий PR #8 теперь требует текущий pair materializer `tools/materialize_agent_wiring_with_tombstones.py`. Он не только запускает базовый pair transform, но и накладывает `apply_subagent_tombstone_wiring`, требует ровно один `subagent-uncertain-tasks.json` marker и содержит актуальные journal/recovery/finalization guards.

Следствие: V46 может быть зелёным на старой Agent-поверхности и при этом не доказывать нынешний Agent↔Core composed product. Использовать его как основание final Windows gate нельзя.

Evidence: `autonomy/evidence/notion/20260822T1655Z_v47_v46_stale_agent_composition_gap.json`.

## V47 — текущий composition materializer

Создан `autonomy/evidence/notion/20260822T1648Z_v47_agent_core_tombstone_composition_materializer.py`.

Он:
1. проверяет frozen base blobs V46;
2. вызывает текущий `tools.materialize_agent_wiring_with_tombstones.materialize(base_account, base_server)`;
3. требует ровно один tombstone marker в resulting server;
4. поверх post-Agent `account_pool.py` накладывает V41;
5. на exact `reservation_aware_lease.py` накладывает V45;
6. компилирует три composed файла и печатает exact Git blob SHA;
7. `--apply` предназначен только для изолированной disposable копии, не для product branch publication.

**V47 exact composed PASS ещё не объявлен**: его нужно прогнать на полном exact checkout и после этого запустить текущий Agent materializer/dynamic-reservation/tombstone test cluster вместе с protected-mode Core regressions.

## Обязательные durable-replay инварианты

В итоговом composed candidate сохранить: exact canonical replay с неизменными IDs; separate provider intents; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical task; hard crash after intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.
Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Exact checkout PR #8 source -> V47 без `--apply` -> V47 на изолированной копии с `--apply`; сохранить post-composition blobs.
2. На V47 composed bytes прогнать текущие Agent pair-materializer/tombstone/dynamic-reservation tests + targeted V41/V45 protected-mode regressions. Старые отдельные PASS не переносить автоматически.
3. На этих же composed bytes встроить Stage-B orchestration: account acquisition -> strict intent -> protected `run_selected/run(..., allow_failover=false)` для всех deliberate provider steps -> canonical Responses/compaction -> strict finalize -> cache/reservation -> client.
4. Прогнать composed matrix: default Agent failover; protected no-failover; late reservation reselection; pool unavailable; intent/final write failure; ambiguous transport; exact retry/restart IDs; planner correction; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
5. Совместить Codex shell-env patch локально.
6. Только после зелёного exact-local composed Stage B — один disposable native-Windows gate с exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
7. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством stable conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
