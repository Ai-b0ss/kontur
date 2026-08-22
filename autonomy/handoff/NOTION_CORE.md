# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `efab0a496b5b90a3d631560540e80269a29dbf91`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. Core-boundary blobs на этом head по-прежнему:
- `payload/server.py` — `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

Сначала бесплатные exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates. CircleCI использовать только как редкий финальный native-Windows proof по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, только через disposable `ci/notion-core-windows-final-gate` и только когда Windows semantics остаются последним реальным недоказанным рубежом. Старый digest workflow не перезапускать.

## Постоянная память v4

Последний полностью проверенный канонический `LATEST`:
- capsule `20260822T105649Z-f43025f69b`;
- archive SHA-256 `bcb82a131b9276c7d6cf8acbe34f7c7f8b0ef9963220d791a7fd5cf811b421d5`;
- parts: 1;
- `LATEST.json` Git blob `e092670cc44cd569eee8d810e45e52fe908b986a`.

Новый V41 долговечно сохранён отдельными immutable evidence-файлами в control branch. Новый `LATEST` в этом запуске не объявлять без полного exact v4 restore/pack/verify/CAS цикла; неизвестные bytes не реконструировать.

## NCM28 / Windows

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать. Финальный native-Windows gate пока не запускать: Stage A закрыт, но Stage B server orchestration ещё не exact-local green. Когда Stage B станет зелёным, один disposable gate должен совместить остаточный auth-rollback/NCM28 proof, PowerShell runtime-restore atomic replace semantics и полный Core candidate gate на exact SHA. Linux/Wine не считать доказательством Windows.

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

Свежий exact `AccountLease.run()` подтверждён на blob `11cea792...`: любой failover-eligible exception сейчас безусловно доходит до `_switch_account()`. То есть V36/V40 невозможно честно реализовать только сервером — нужен caller-controlled opt-out в `account_pool.py`.

Подготовлен exact candidate:
`autonomy/evidence/notion/20260822T1155Z_v41_accountlease_failover_optout_exact_candidate.patch`.

API: `AccountLease.run(..., allow_failover: bool = True)`. Значение по умолчанию сохраняет нынешнюю Agent-ротацию. Core после успешной strict provider-intent publication вызывает каждый deliberate planner-step с `allow_failover=false`. В этом режиме failover-eligible ошибка учитывается на текущем выбранном аккаунте ровно один раз, transport outcome получает `retry_scheduled=false`, `_switch_account()` не вызывается, исходная ошибка поднимается наверх. Trust-rule denial и timeout остаются на существующих более ранних fail-closed ветках.

Локальная модель: `V41_ACCOUNTLEASE_FAILOVER_OPTOUT_MODEL_PASS`; `allow_failover=false -> switch_account_calls=0`, `allow_failover=true -> existing retry path preserved`. Evidence: `autonomy/evidence/notion/20260822T1155Z_v41_accountlease_failover_optout_evidence.json`.

Важно: V41 закрывает только sibling-account failover. В `handle_openai_responses()` остаётся отдельный foreground transport retry/recursion; после durable intent его тоже обязательно подавить.

## Обязательные durable-replay инварианты V12–V29

Сохранить в едином server candidate: exact canonical replay с неизменными IDs; отдельный `provider_intents`; stable conversation identity до provider entry; detached get/rollback; TTL/size/oversize tombstone; stale retry >32; content-free context identity включая empty input/compaction; stream/non-stream только как проекции одного durable payload; disconnect после provider-entered не отменяет commit-critical server task; hard crash после intent fail-closed; ambiguous transport без sibling/outer retry; removed persisted tool-owner account без ghost reservation/подмены; unresolved intent вне обычного TTL/LRU с bounded capacity; exact compaction replay + legacy fail-closed; schema epoch/rollback floor.

## Codex shell-env safety

До live probe обязателен `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Не исследовать Stage A и V34/V35 заново.
2. Наложить V41 на изолированную exact-копию `account_pool.py`, проверить compile и targeted fake-pool cases: ordinary success, local error, trust denial, ambiguous transport with opt-out, default failover compatibility, accounting/outcome exactly once.
3. Собрать exact-local server orchestration на `server.py=f02cef6a...`: route/account acquisition -> strict intent -> deliberate steps с `allow_failover=false` -> suppress outer foreground retry -> canonical Responses/compaction -> strict finalize -> cache/reservation/client.
4. Прогнать локальную матрицу: pool unavailable; intent write failure; ambiguous transport; final write failure; retry/restart exact IDs; planner bad-tool correction same account; correction transport failure; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
5. Совместить Codex shell-env patch локально.
6. Только после зелёного exact-local Stage B запустить один disposable `ci/notion-core-windows-final-gate`; сохранить exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
7. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством стабильного conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
