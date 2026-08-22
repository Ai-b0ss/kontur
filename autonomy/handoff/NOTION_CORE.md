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

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать. В конце этого прохода все пять старых checks всё ещё `pending`.

## Постоянная память v4

Канонический проверенный `LATEST` остаётся:
- capsule `20260822T124805Z-7a66179727`;
- archive SHA-256 `6f87c85b580999d6e03bde8eb0701b7dbede291d0155edb8a2e13fd4555287f6`;
- parts: 1;
- `LATEST.json` Git blob `18ce26b25c5b8f00c1e8eca449a593531d2fd331`.

`LATEST`, manifest и part в этом проходе перечитаны. Новую capsule/указатель не публиковать без полного точного `capsule_runtime_v4.py restore -> pack -> readback -> CAS`. Не реконструировать неизвестные bytes и не форсировать pointer. Новые V45/V46 материалы уже долговечно лежат в control-ветке.

## Stage A — закрыт

`V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.
Пока legacy-state v2, `unsupported/corrupt/persistence_blocked` после load/get обязаны fail-closed до Notion и в `/v1/responses`, и в `/v1/responses/compact`. Новый v3 нельзя вводить без этого rollback floor.

## Stage B store — зелёная основа

`V34_V35_EXACT_CLASS_INTEGRATED_PASS` на преобразованном `ConversationSegmentStore`:
- отдельный strict `provider_intent`;
- exact durable replay с сохранёнными IDs;
- restart;
- detached `get()`;
- duplicate unresolved fail-closed;
- forced NCM28 final-write failure сохраняет intent и блокирует persistence;
- TTL cleanup + replay-unavailable tombstone.

Evidence: `autonomy/evidence/notion/20260822T1240Z_v34_v35_exact_store_integration.json`.

Целевой порядок Core:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## V41–V44 — уже доказанные границы

V41 candidate: `AccountLease.run(..., allow_failover: bool = True)`. Default сохраняет обычную Agent-ротацию; protected Core после intent использует `false`, что запрещает `_switch_account()` и делает ambiguous transport одноразовым provider-step. Candidate: `autonomy/evidence/notion/20260822T1155Z_v41_accountlease_failover_optout_exact_candidate.patch`.

V42: protected transport error с `allow_failover=false` выходит напрямую и не достигает нынешнего server recursion через `AccountPoolExhausted`; отдельный server retry flag не нужен для этого пути.

V43: на старом exact server были три callsite: initial/continuation Responses, planner correction, compaction. Все deliberate post-intent provider-step должны быть protected.

V44: safe streaming — не отдельная provider-facing transaction. Сначала полностью завершить provider+strict durable finalize одного canonical Responses object; затем JSON или existing `responses_sse()` только проецируют тот же сохранённый объект. Existing projector новых UUID не создаёт. Клиентский disconnect после provider-entered не должен отменять commit-critical server task.

## V45 — найден и локально закрыт Agent↔Core wrapper gap

Свежий Agent/Core аудит доказал: Agent materialization меняет первый Responses-вызов с прямого `AccountLease.run(...)` на `DynamicReservationLeaseSession.run_selected(...)`. Поэтому V41 на одном `AccountLease` был бы недостаточен: protected flag потерялся бы в wrapper и default failover тихо вернулся бы.

Prepared composition patch:
`autonomy/v3/candidates/NOTION_AGENT_CORE_ALLOW_FAILOVER_COMPOSITION_20260822.patch`.

Локальная модель прошла `V45_AGENT_CORE_ALLOW_FAILOVER_COMPOSITION_MODEL_PASS`:
- default Agent path сохраняет старую форму вызова и обычный legitimate failover;
- protected `run_selected(..., allow_failover=false)` и later `run(..., allow_failover=false)` реально передают запрет вниз и дают zero account switch при ambiguous transport;
- late foreground reservation до provider entry всё ещё безопасно reselect-ит аккаунт, а eventual provider-step остаётся protected.

Evidence: `autonomy/evidence/notion/20260822T1555Z_v45_agent_core_allow_failover_composition.json`.

## V46 — готов детерминированный composition materializer

Создан `autonomy/evidence/notion/20260822T1605Z_v46_agent_core_composition_materializer.py`.
Он жёстко проверяет frozen base blobs, затем в фиксированном порядке:
1. применяет официальный Agent account-pool dynamic-reservation transform;
2. применяет официальный Agent server transform;
3. поверх post-Agent `account_pool.py` накладывает V41 `allow_failover`;
4. на exact `reservation_aware_lease.py` накладывает V45 forwarding;
5. компилирует все полученные Python-файлы и печатает exact post-composition Git blob SHA.

Сам materializer локально компилируется: `V46_COMPOSITION_MATERIALIZER_SELF_COMPILE_PASS`.
**Ещё не объявлять exact composed product PASS:** из этой среды нет полного checkout, поэтому V46 пока не прогнан на всех real bytes и существующем Agent test cluster. Это следующий обязательный шаг, а не Windows.

## Обязательные durable-replay инварианты

В итоговом composed candidate сохранить: exact canonical replay с неизменными IDs; separate provider intents; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical task; hard crash after intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.
Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Восстановить exact checkout/capsule по v4 и прогнать `20260822T1605Z_v46_agent_core_composition_materializer.py` сначала без `--apply`, затем на изолированной копии с `--apply`; сохранить post-composition blobs.
2. На composed bytes прогнать существующие Agent dynamic-reservation/materializer tests плюс targeted protected-mode regressions. Не переносить старые отдельные PASS автоматически.
3. Уже на composed server собрать Stage-B orchestration: account acquisition -> strict intent -> protected first `run_selected(..., allow_failover=false)` + correction/direct calls -> canonical Responses/compaction -> strict finalize -> cache/reservation -> client.
4. Прогнать composed matrix: default Agent failover; protected no-failover; late reservation reselection; pool unavailable; intent/final write failure; ambiguous transport; exact retry/restart IDs; planner correction; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
5. Совместить Codex shell-env patch локально.
6. Только после зелёного exact-local composed Stage B — один disposable native-Windows gate с exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
7. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством stable conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
