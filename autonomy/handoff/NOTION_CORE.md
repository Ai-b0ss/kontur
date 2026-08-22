# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `8c46616f6c4d038fc3b578a0e516aa7fb832a0a1`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. Текущие Core-boundary blobs на этом head:
- `payload/server.py` — `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

Сначала бесплатные exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates. CircleCI использовать только как редкий финальный native-Windows proof по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, только через disposable `ci/notion-core-windows-final-gate` и только когда Windows semantics остаются последним реальным недоказанным рубежом. Старый digest workflow не перезапускать.

## Постоянная память v4

Канонический `LATEST` после текущего запуска:
- capsule `20260822T105649Z-f43025f69b`;
- archive SHA-256 `bcb82a131b9276c7d6cf8acbe34f7c7f8b0ef9963220d791a7fd5cf811b421d5`;
- parts: 1;
- `LATEST.json` Git blob `e092670cc44cd569eee8d810e45e52fe908b986a`.

Capsule была собрана точным `capsule_runtime_v4.py` после восстановления предыдущего `LATEST`. Part и manifest после публикации перечитаны; их Git blob SHA совпали с локально рассчитанными. Перед CAS `LATEST` был перечитан и сохранил исходный blob `13b0b93d787c72882cbf688b644ca95277e6cf2d`; старый `LATEST` `20260822T095123Z-7991a947ca` сохранён как `PREVIOUS`, затем новый указатель опубликован через exact parent SHA/CAS и повторно прочитан.

Checkpoint ссылается на `autonomy/evidence/notion/20260822T1049Z_v40_canonical_provider_step_invariant_correction.json`.

## NCM28 / Windows

Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` перечитан read-only: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`. Не перезапускался.

Финальный native-Windows gate **пока не запускать**. Stage A уже закрыт локально, но Stage B ещё не интегрирован в точный server-path целиком. Когда Stage B станет exact-local green, один Windows gate должен совместить:
- остаточный `auth-rollback`/NCM28 Core proof;
- PowerShell runtime-restore atomic replace semantics;
- полный Core candidate gate на exact SHA.

Linux/Wine не считать доказательством Windows.

## Stage A — compatibility floor

Stage A закрыт локально на точных Core-boundary исходниках как `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Смысл пола: пока состояние ещё старого формата v2, `unsupported/corrupt/persistence_blocked` после load/get обязаны дать fail-closed **до Notion** и для обычного `/v1/responses`, и для `/v1/responses/compact`. Это минимальный safe rollback floor перед публикацией нового v3-state.

После первого v3-state нельзя откатываться ниже Stage-A safe commit/floor.

## Stage B — durable Responses/Codex replay

Текущий product-server всё ещё небезопасен по порядку аварийных действий: внешний Notion call, memory-only affinity/reservation, exact response IDs, streaming и durable publication пока не образуют одну доказанную транзакционную границу.

Целевой порядок:
`local route/account acquisition -> strict provider-intent publication -> deliberate planner steps on the already-selected lease, each attempted at most once with implicit retry/failover disabled -> one canonical Responses/compaction payload -> strict atomic durable finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Ключевой инвариант после intent — **не буквально один provider call**, а отсутствие неявного повтора provider-операции. Текущий сервер законно умеет делать ограниченный planner-correction после невалидной рекомендации модели; такой deliberate correction остаётся частью одной durable transaction и выполняется на том же выбранном lease/account. Каждый deliberate planner step допускается максимум один раз. AccountLease failover и отдельный foreground transport retry/recursion после intent запрещены. Transport failure на любом таком шаге оставляет intent unresolved и не публикует client result.

После успешной durable publication retry/restart должен вернуть тот же exact payload с теми же `response_id/item_id/call_id`, а **новых** provider calls при exact retry быть не должно. До successful intent publication provider count должен быть 0. При final write failure unresolved intent остаётся, а client result, memory cache и reservation не публикуются.

### Store: V34 + V35 — exact-class PASS

Точный `payload/conversation_segments.py` blob `553bd349...` материализован локально, V34 exact-preimage materializer прошёл `--check/apply`, после чего наложен V35 retention overlay и выполнена компиляция.

Реальный преобразованный `ConversationSegmentStore` прошёл локальный интеграционный harness:
- strict `begin_provider_intent` — PASS;
- exact replay с сохранёнными IDs — PASS;
- restart возвращает тот же replay — PASS;
- `get()` detached copy — PASS;
- duplicate unresolved intent — fail-closed PASS;
- forced final NCM28 write failure виден вызывающему коду — PASS;
- при final write failure intent сохраняется — PASS;
- store переходит в persistence-blocked — PASS;
- V35 удаляет просроченный replay обычной cleanup без нового provider traffic — PASS;
- `replay_unavailable` tombstone переживает restart — PASS.

Итог: `V34_V35_EXACT_CLASS_INTEGRATED_PASS`.

Доказательство: `autonomy/evidence/notion/20260822T1240Z_v34_v35_exact_store_integration.json`.

### V36 — ambiguous transport не может породить неявный второй provider attempt

Exact current `AccountLease.run()` после failover-eligible transport error умеет переключить аккаунт и продолжить `retry_operation`. После durable provider-intent это небезопасно: transport evidence фиксирует `provider_call_entered=true`, но не доказывает отсутствие удалённого прогресса.

V36 оставляет Agent-ротацию по умолчанию неизменной, но Core protected transaction должна вызывать lease с failover disabled после intent — и для initial/continuation step, и для каждого deliberate planner-correction step.

Важно: одного AccountLease-флага недостаточно. В `handle_openai_responses()` существует ещё отдельный foreground transport retry/recursion. Уже сохранённый V36/V39 evidence требует подавить и этот второй слой после durable intent. Локальная повторная модель подтверждает: AccountLease-only suppression + outer retry создаёт лишний provider attempt; полное suppression обоих неявных уровней сохраняет границу «каждый deliberate planner step максимум один раз».

### V37/V39/V40 — route before intent и deliberate planner steps

Provider-intent нельзя писать до локального выбора маршрута/аккаунта: `cooldown/exhausted` до любого provider call иначе оставит ложный unresolved marker.

Правильный порядок Stage B: сначала local lease/account acquisition без provider traffic, затем strict intent, затем bounded deliberate planner steps на том же lease/account. Для каждого такого шага `allow_failover=false`; outer transport recursion после intent выключен. Коррекция planner-ответа не считается transport retry и не должна быть удалена из продукта ради ошибочного правила «ровно один provider call».

V40 устранил противоречие в самом каноническом handoff: прежняя фраза `exactly one provider entry` расходилась с точным `server.py`, где сохранён bounded planner-correction loop. Актуальный инвариант: **no implicit provider replay; each deliberate planner step is attempted at most once**. Доказательство: `autonomy/evidence/notion/20260822T1049Z_v40_canonical_provider_step_invariant_correction.json`.

## Обязательные durable-replay инварианты из V12–V29

При сборке единого server candidate сохранить:
- exact canonical replay с неизменными IDs после retry/restart;
- отдельный `provider_intents` ledger, а не fake ConversationSegment;
- stable conversation identity до provider entry; отсутствие `thread_id/session_id` => fail-closed;
- detached `get()` и полный rollback памяти при write failure;
- replay TTL/size bounds и oversize durable tombstone;
- stale retry >32 через prefix/history gate;
- content-free segment-context identity, включая empty input и compaction;
- stream/non-stream только как проекции одного сохранённого canonical payload; до durable finalize никаких client IDs/provider-derived chunks;
- client disconnect после provider-entered не отменяет commit-critical server-owned task;
- hard crash после provider-intent остаётся fail-closed до exact durable finalize;
- ambiguous transport после intent не получает sibling или outer retry без typed `PROVEN_NO_REMOTE_PROGRESS`;
- removed persisted tool-owner account => без ghost reservation и без молчаливой подмены account/thread;
- unresolved provider intent не удаляется обычным conversation TTL/LRU; отдельная bounded capacity;
- exact durable compaction replay + legacy fail-closed;
- schema epoch/rollback floor: v3 state не должен быть молча прочитан старым unsafe v2 server.

## Codex shell-env safety

До live probe обязателен кандидат `[shell_environment_policy]`:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- explicit exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Bridge key остаётся доступен самому Codex через `env_key`, но не локальным shell-командам агента. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Не исследовать Stage A и V34/V35 store заново — они уже локально доказаны.
2. Собрать exact-local Stage-B server orchestration на текущих `server.py/account_pool.py` boundaries:
   - local route/account acquisition;
   - strict intent write;
   - initial/continuation и каждый deliberate planner-correction step — максимум одна попытка на выбранном lease/account, с V36 failover disabled;
   - suppress existing outer foreground transport retry после intent;
   - canonical Responses/compaction payload;
   - strict finalize;
   - только потом memory cache/affinity/reservation/client.
3. Локальная матрица до Windows: pool unavailable -> no intent/provider; intent write failure -> provider=0; ambiguous transport на deliberate step -> никакого sibling/outer retry + unresolved intent; final write failure -> no client/cache/reservation + intent preserved; retry/restart exact IDs без новых provider calls; planner bad-tool -> bounded correction on same account -> final durable replay; transport failure during correction -> unresolved intent/no client; compaction exact/restart/legacy; stream/non-stream; disconnect/hard crash; removed account; TTL/size/oversize/stale retry.
4. Совместить Codex shell-env patch локально.
5. Только после зелёного exact-local Stage B запустить один disposable `ci/notion-core-windows-final-gate`; сохранить exact SHA/cases/logs/artifacts. Недоступный результат не считать PASS.
6. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с обезличенным доказательством стабильного conversation id на initial/tool-result/retry/restart.

Product PR #7/#8 в текущем запуске не менялись. Hosted CI, live Notion/Codex, секреты и пользовательские данные не трогались.
