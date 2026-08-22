# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`. Свежий read-only PR read этого прохода: head `eaa7e812cb502649fb5291143070b33bfc94380e`. Важная Core-граница не изменилась и подтверждена по точным blob:
- `payload/server.py` — `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/reservation_aware_lease.py` — `c77b4d5214911def1729243516aec73e43f8d425`.

Не дублировать rotation, prompt modes, delegation или account/thread affinity.

## Режим

Сначала бесплатные exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates. CircleCI использовать только как редкий финальный native-Windows proof по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, только через disposable `ci/notion-core-windows-final-gate` и только когда Windows semantics остаются последним реальным недоказанным рубежом. Старый digest workflow не перезапускать.

## Постоянная память v4

Текущий полностью проверенный канонический `LATEST`:
- capsule `20260822T124805Z-7a66179727`;
- archive SHA-256 `6f87c85b580999d6e03bde8eb0701b7dbede291d0155edb8a2e13fd4555287f6`;
- parts: 1;
- `LATEST.json` Git blob `18ce26b25c5b8f00c1e8eca449a593531d2fd331`.

В этом проходе `LATEST`, manifest и immutable part перечитаны. Новую capsule/`LATEST` не публиковать без точного `capsule_runtime_v4.py restore -> pack -> readback -> CAS`. Не реконструировать неизвестные байты и не подменять exact v4-runtime самодельной копией. Новый V45 долговечно сохранён обычным immutable evidence в control-ветке, поэтому работа не потеряна даже без смены pointer.

## NCM28 / Windows

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать. Финальный native-Windows gate пока не запускать: Stage A закрыт, но Stage B server orchestration и Agent↔Core composition ещё не exact-local green. Когда Stage B станет зелёным, один disposable gate должен совместить остаточный auth-rollback/NCM28 proof, PowerShell runtime-restore atomic replace semantics и полный Core candidate gate на exact SHA. Linux/Wine не считать доказательством Windows.

## Stage A — compatibility floor

Stage A закрыт локально на точных Core-boundary исходниках как `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Пока состояние v2, `unsupported/corrupt/persistence_blocked` после load/get обязаны дать fail-closed до Notion и для `/v1/responses`, и для `/v1/responses/compact`. После первой публикации v3-state нельзя откатываться ниже этого safe floor.

## Stage B — durable Responses/Codex replay

Целевой порядок:
`local route/account acquisition -> strict provider-intent publication -> deliberate planner steps on the already-selected lease, each attempted at most once with implicit retry/failover disabled -> one canonical Responses/compaction payload -> strict atomic durable finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Ключевой инвариант после intent: не «ровно один provider call», а **никакого неявного повтора provider-операции**. Ограниченная planner-correction после невалидной рекомендации остаётся допустимой на том же lease/account; каждый осознанный planner-step выполняется максимум один раз. Transport failure на любом таком шаге оставляет intent unresolved и не публикует client result.

### Store V34 + V35 — exact-class PASS

Реальный преобразованный `ConversationSegmentStore` прошёл `V34_V35_EXACT_CLASS_INTEGRATED_PASS`: strict intent, exact replay с сохранёнными IDs, restart, detached `get()`, duplicate unresolved fail-closed, forced final NCM28 failure с сохранением intent, persistence-blocked, TTL cleanup и replay-unavailable tombstone. Доказательство: `autonomy/evidence/notion/20260822T1240Z_v34_v35_exact_store_integration.json`.

### V41 — exact AccountLease failover opt-out candidate

Exact `AccountLease.run()` подтверждён на blob `11cea792...`: любой failover-eligible exception сейчас безусловно доходит до `_switch_account()`. V36/V40 невозможно честно реализовать только сервером — нужен caller-controlled opt-out в `account_pool.py`.

Подготовлен exact candidate:
`autonomy/evidence/notion/20260822T1155Z_v41_accountlease_failover_optout_exact_candidate.patch`.

API: `AccountLease.run(..., allow_failover: bool = True)`. Значение по умолчанию сохраняет нынешнюю Agent-ротацию. Core после успешной strict provider-intent publication вызывает каждый deliberate planner-step с `allow_failover=false`. В этом режиме failover-eligible ошибка учитывается на текущем выбранном аккаунте ровно один раз, transport outcome получает `retry_scheduled=false`, `_switch_account()` не вызывается, исходная ошибка поднимается наверх. Trust-rule denial и timeout остаются на существующих более ранних fail-closed ветках.

### V42 — protected server retry boundary PASS

Exact `server.py=f02cef6a...` проверен вместе с V41 control-flow. Текущий foreground transport recursion входит только через `except AccountPoolExhausted`. При `allow_failover=false` ambiguous transport поднимается прямо из `AccountLease.run()` и не превращается в `AccountPoolExhausted`, поэтому для защищённого post-intent пути этот внешний recursive retry становится недостижимым без отдельного server-флага.

Локальная модель прошла как `V42_PROTECTED_SERVER_RETRY_BOUNDARY_MODEL_PASS`: initial protected transport failure — один provider call, zero switch, zero outer recursion; deliberate planner correction остаётся отдельным осознанным шагом на том же lease; transport failure на correction-step выполняется один раз и закрывается без final commit; default `allow_failover=true` сохраняет существующий Agent failover/retry path.

Evidence: `autonomy/evidence/notion/20260822T1255Z_v42_protected_server_retry_boundary.json`.

### V43 — V41 exact-method targeted PASS + callsite map

V41 прогнан на локально извлечённой точной логике `AccountLease.run()` из blob `11cea792...` с самим кандидатом `allow_failover`. Вердикт: `V41_EXACT_METHOD_TARGETED_PASS`.

Проверены: ordinary success; local validation error; `TRUST_RULE_DENIED`; Notion `TRANSPORT` с одним вызовом/нулём switch/`retry_scheduled=false`; raw HTTP transport с нулём switch; default failover compatibility; два deliberate planner-step на одном lease/account.

Exact server-callsite audit на `server.py=f02cef6a...` подтвердил три обязательных места защищённого Stage-B вызова:
1. Responses initial/continuation;
2. planner correction;
3. compaction initial/continuation.

После strict intent все три должны выполнять provider-step с `allow_failover=false`. Compaction нельзя оставить на старом default failover.

Evidence: `autonomy/evidence/notion/20260822T1345Z_v43_v41_exact_method_and_server_callsites.json`.

### V44 — buffered canonical stream projection PASS (model + exact existing projection)

Exact `server.py=f02cef6a...` проверен на streaming boundary. Нынешний `stream_openai_responses()` создаёт `resp_*` и `rs_*` до долговечной фиксации, начинает отдавать данные до завершения `handle_openai_responses()` и при закрытии генератора отменяет request task. Одновременно текущий same-process affinity-cache восстанавливает только текст и заново вызывает `responses_payload()`, поэтому генерирует новые IDs.

Проверен более простой Stage-B путь: провайдерная работа и commit-critical transaction завершаются до клиентской проекции; stream/non-stream затем строятся из одного уже долговечно сохранённого canonical Responses-объекта. Локальная аварийная модель прошла как `V44_STAGE_B_BUFFERED_CANONICAL_PROJECTION_MODEL_PASS`.

Отдельно exact существующие `responses_item_events()` + `responses_sse()` из blob `f02cef6a...` прогнаны на canonical function-call и message payload. Вердикт `V44_EXACT_EXISTING_RESPONSES_SSE_CANONICAL_PROJECTION_PASS`: проекция сохраняет уже созданные `response_id` и `call_id` и сама новых UUID не создаёт.

Evidence: `autonomy/evidence/notion/20260822T1455Z_v44_buffered_canonical_stream_projection.json`.

V44 не отменяет V20/V21: после фактического входа в Notion commit-critical coroutine всё равно должна иметь server-owned lifetime (`asyncio.shield` + bounded registry/equivalent), чтобы disconnect/cancellation клиента не уничтожил транзакцию до strict finalize. Но клиенту до strict finalize не должны выходить provider text или response/tool IDs.

### V45 — Agent↔Core protected-failover composition PASS (wrapper model)

Свежий Agent/Core аудит выявил реальный composition gap: Agent materialization меняет первый Responses-вызов с прямого `AccountLease.run(...)` на `DynamicReservationLeaseSession.run_selected(...)`. Поэтому V41, применённый только к `AccountLease`, **не защищает материализованный продукт**, пока wrapper не умеет принять и передать `allow_failover=false`.

Точный Agent wrapper на blob `c77b4d52...` и его server/account-pool materializers перечитаны. Подготовленный composition patch `autonomy/v3/candidates/NOTION_AGENT_CORE_ALLOW_FAILOVER_COMPOSITION_20260822.patch` добавляет `allow_failover` в `run_selected/run/_run` и одноразовые wrappers. Критически важно: при default `true` он сохраняет старую форму вызова `lease.run(...)`, чтобы не ломать существующие fake/test leases; только защищённый Core-путь передаёт новый keyword явно.

Локальная модель прошла как `V45_AGENT_CORE_ALLOW_FAILOVER_COMPOSITION_MODEL_PASS`:
- legacy/default Agent wrapper сохраняет старую форму вызова;
- protected `run_selected(..., allow_failover=false)` даёт один ambiguous provider attempt и zero account switch;
- default Agent path по-прежнему умеет обычный failover;
- protected later `run(..., allow_failover=false)` также не переключает аккаунт;
- late foreground reservation **до provider entry** по-прежнему безопасно переизбирает аккаунт, а eventual provider-step остаётся с `allow_failover=false`.

Evidence: `autonomy/evidence/notion/20260822T1555Z_v45_agent_core_allow_failover_composition.json`.

Это меняет порядок сборки финального Stage B: нельзя отдельно доказать V41 на старом server/account-pool и затем считать Agent materialization автоматически совместимой. Финальный кандидат обязан быть проверен на **composed materialized bytes**. Agent dynamic-reservation transform и Core V41 должны иметь один воспроизводимый порядок/post-image, wrapper должен протащить флаг, а сервер после materialization должен поставить protected mode на первый `run_selected`, correction rounds и compaction/direct path. Safe pre-provider reservation reselection остаётся разрешённой; provider-error failover после intent — нет.

## Обязательные durable-replay инварианты V12–V29

Сохранить в едином server candidate: exact canonical replay с неизменными IDs; отдельный `provider_intents`; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream только как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical server task; hard crash после intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Не исследовать Stage A, V34/V35 и старые V41 callsites заново.
2. Сначала собрать воспроизводимый **Agent+Core composition transform**: Agent dynamic-reservation materialization -> Core V41 account-pool opt-out -> V45 wrapper forwarding, с новым post-composition hash/compile и targeted regressions. Не применять V41 отдельно так, чтобы сломать Agent exact-preimage materializer.
3. На composed server собрать Stage-B orchestration: route/account acquisition -> strict intent -> protected first `run_selected(..., allow_failover=false)` и все deliberate correction/direct calls без implicit failover -> один canonical Responses/compaction payload -> strict finalize -> cache/reservation -> клиент.
4. Для `/v1/responses stream=true` после strict durable finalize проецировать сохранённый canonical response через существующий `responses_sse()`. Provider thinking до finalize не публиковать. Commit-critical provider task после provider-entry должен принадлежать серверу, а не SSE-клиенту.
5. Прогнать composed local matrix: Agent default failover; protected no-failover; late reservation reselection; pool unavailable; intent write failure; ambiguous transport; final write failure; retry/restart exact IDs; planner correction same account; correction transport failure; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
6. Совместить Codex shell-env patch локально.
7. Только после зелёного exact-local composed Stage B запустить один disposable `ci/notion-core-windows-final-gate`; сохранить exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
8. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством стабильного conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
