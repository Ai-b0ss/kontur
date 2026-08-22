# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `f58f0123b370ad786d337337eb03a6a4ce9963b3`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. На этом head Core-boundary blobs: `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`, `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

Сначала бесплатные exact-source Linux/Python/Node проверки. Production, реальные Notion данные/traffic и секреты не трогать до локальных safety gates. GitHub Actions не использовать как бесплатный исполнитель.

CircleCI теперь разрешён только как редкий доказательный ресурс по `autonomy/ci/CIRCLECI_GATE_POLICY.md`. Для native Windows Core использовать только disposable ref `ci/notion-core-windows-final-gate`, и только когда Stage-A compatibility floor и актуальный Stage-B durable-state кандидат локально зелёные настолько, что Windows semantics остаются реальным недоказанным рубежом. Старый digest workflow не перезапускать как замену финальному gate. Product/control refs force-write запрещён; force-move допустим только для разрешённого disposable gate ref.

## Постоянная память

Fresh v4 `LATEST` на старте текущего запуска:
- capsule `20260822T064521Z-22a279609f`;
- archive SHA-256 `1f693c04ca4529d3a5bb0b521b446f308f1956d53c12a9c78fdb6bc5727ef19c`;
- parts: 2;
- `LATEST.json` Git blob `2a4c6154c0afe0a6254103b271f3f41189cfff65`.

Эта capsule восстановлена локально из точных immutable parts: обе части прошли `chars`/SHA-256, собранный archive совпал по размеру и SHA-256, а `CHECKPOINT.json` после extract совпал с manifest по размеру и SHA-256. Verdict: `V4_LATEST_EXACT_RESTORE_PASS`. Неизвестные bytes не реконструировались.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`.

Новый final Windows gate пока **не запускать**: Stage A ещё не закрыт полностью, Stage B v3 candidate ещё не собран. Когда оба локально зелёные, один bounded Windows gate должен совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28/Core gate на exact candidate SHA. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses / Codex replay — текущая граница

Текущий product-сервер всё ещё аварийно небезопасен: remote Notion call идёт до durable exact replay publication; reservation и memory-only `TurnAffinityStore` меняются до durable publication; `ConversationSegmentStore` глотает NCM28/OSError в `persistence_blocked`; окончательные `response_id/item_id/call_id` создаются позже; text-cache регенерирует ID; streaming заранее выдаёт идентификаторы/provider-derived thinking и отменяет незавершённый `run_request()` при закрытии клиента.

Уже доказанные локальные слои V12–V29 сохраняются как требования, но старые patch-файлы нельзя механически складывать: V27/V28 меняют schema rollout и форму provider-intent.

Целевой порядок:
`strict provider-intent publication -> provider -> один canonical Responses/compaction payload -> strict atomic durable publication(progress + exact payload, clear intent) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful publication retry/restart возвращает те же `response_id/item_id/call_id`, provider count остаётся 1. Любая durable failure до provider => provider count 0. Final durable failure => старый provider-intent остаётся, ноль ephemeral mutation и ноль client result. Stream/non-stream — только проекции одного сохранённого payload.

### V26 — compaction также требует pre-provider intent

Exact durable compaction replay без V22 intent имеет crash-window: Notion мог выполнить compaction, а exact compact payload ещё не сохранён. V22/V23/V25 правила provider-intent обязательны и для `request_kind=compaction`.

Материалы: `autonomy/evidence/notion/20260822T0548Z_durable_replay_v26_compaction_preprovider_intent.{json,py}`.

### V27 — schema epoch + rollback floor

Хранить V12/V22–V26 safety metadata под внешним `conversation-state version=2` небезопасно: exact current v2 loader реконструирует только известные поля `ConversationSegment`, неизвестные top-level/per-record поля пропускает, а следующий старый save их стирает. Это уничтожает replay/provider-intent доказательства.

Простой переход на `version=3` также недостаточен: нынешний v2 store ставит `persistence_blocked`, но нынешний server не проверяет его до provider entry и способен снова войти в Notion с пустым in-memory state.

Обязательный rollout:
1. **Stage A compatibility floor** пока state ещё v2: после load/get и перед любым provider-entering Responses/compaction действием unsupported/corrupt/blocked durable state => fail closed до Notion.
2. Только после доказанного Stage A — **Stage B state version=3** с durable replay/intents.
3. Зафиксировать `minimum_safe_rollback_commit=<exact Stage-A commit>`; после первого v3 state rollback ниже floor запрещён.

Материалы: `autonomy/evidence/notion/20260822T0605Z_durable_replay_v27_schema_epoch_rollback_floor.*`.

### V28 — отдельный `provider_intents` ledger

Provider intent нельзя представлять fake `ConversationSegment`: на первой операции ещё нет настоящих `account_id/notion_thread_id`, а fake segment может быть ошибочно принят rollover/anchor/diagnostic логикой за реальную Notion-ветку.

Предпочтительная v3 форма:
- top-level `provider_intents[conversation_storage_key] = {request_fingerprint, request_kind, created_at}` — только обезличенные данные;
- `conversations` содержит только реальный provider segment/progress/exact replay после результата;
- finalize одной NCM28 atomic write одновременно создаёт/обновляет real segment + exact replay и удаляет matching intent;
- final write failure сохраняет intent и не публикует fake/partial segment;
- general conversation TTL/LRU не удаляет provider-intents; отдельный bounded capacity `MAX_UNRESOLVED_PROVIDER_INTENTS=128`.

Материалы: `autonomy/evidence/notion/20260822T0618Z_durable_replay_v28_separate_provider_intent_ledger.{json,py}`.

### V29 — stable conversation identity обязательна

`codex_conversation_key(body)` = `client_metadata.thread_id` или fallback `session_id`. Store при `key=None` не имеет durable namespace. Поэтому перед новой provider-entering ordinary Responses или compaction операцией durable Core mode требует non-empty stable conversation key; иначе fail closed до provider. Не синтезировать ключ из request hash, `turn_id`, random UUID, HTTP connection или memory cache.

Synthetic/live bridge probe явно передаёт `thread_id`. Настоящий `codex exec` probe пока не доказывает, что фактический Codex build отправляет стабильный `thread_id/session_id` на wire. Live acceptance должна добавить обезличенный capture и доказать один и тот же conversation id на initial turn, tool-result continuation, retry и restart.

Материалы: `autonomy/evidence/notion/20260822T0635Z_durable_replay_v29_stable_conversation_identity.{json,py}`.

### V30 — исходный Stage-A materializer оказался неполным

V30 правильно добавлял `ConversationSegmentStore.require_persistence_ready()` и вставлял post-`get()` gate в обычный `handle_openai_responses()`. Но self-review exact product source выявил ошибку в собственном доказательстве V30: `/v1/responses/compact` вызывает отдельный `handle_openai_compaction()`, а не `handle_openai_responses()`. V30 materializer вообще не менял этот путь.

Следовательно прежний пункт `V30_COMPACTION_SHARES_PROVIDER_FLOOR_PASS` относился только к модели, а не к точному product path; считать Stage A закрытым по V30 нельзя.

### V31 — исправленный Stage-A floor для ordinary + compaction

Подготовлен exact-preimage materializer на проверенных blobs:
- `conversation_segments=553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `server=f02cef6a0ffc202c75fbe71c520c72ac19ff876d`.

V31 вставляет один и тот же post-`get()` `require_persistence_ready()` gate в два независимых provider-entering пути:
1. ordinary Responses — после `affinity/get(segment)` и до account lease/provider;
2. compaction — после `conversation_segments.get()` и до fingerprint/lease/provider.

Ранее локально доказано:
- V30 ordinary blocked-after-get => provider count 0;
- реальная V30 compaction-форма при blocked-after-get => provider count 1;
- V31 compaction blocked-after-get => provider count 0;
- healthy compaction => provider count 1;
- materializer Python compile PASS;
- оба exact textual anchors трансформируются отдельно и fail-closed по count.

Новый exact-source результат текущего запуска:
- `payload/conversation_segments.py` материализован локально и его Git blob вычислен как точный `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- V31 transform на этом полном exact файле компилируется;
- настоящий преобразованный `ConversationSegmentStore` прошёл local real-class harness: healthy persistent v2 PASS; unsupported v3 fail-closed; corrupt JSON fail-closed; cleanup-triggered NCM28 write failure, возникший внутри `get()`, становится виден post-get gate и fail-closed; `path=None` остаётся допустимым in-memory режимом;
- verdict: `V31_EXACT_CONVERSATION_STORE_REAL_CLASS_PASS`.

Материал: `autonomy/evidence/notion/20260822T0745Z_v31_exact_store_real_class_evidence.json`.

Граница доказательства: exact `server.py` blob и оба нужных anchors подтверждены через GitHub, но полный exact server пока не материализован в файловой системе текущего container. Уже собранный локальный surrogate имеет другой Git blob и **отброшен как недоказательный**. Поэтому Stage A всё ещё `NOT_YET_EXACT_LOCAL_PASS`; нельзя считать её закрытой только по store-half.

## Остальные обязательные V12–V25 инварианты

Сохранить при сборке нового v3-кандидата:
- exact canonical Responses replay с неизменными IDs после retry/restart;
- detached `get()` / deepcopy и полный rollback памяти при write failure;
- oversize durable tombstone + exact replay TTL/size bounds;
- persistence gate после `get()`;
- exact durable compaction replay + legacy fail-closed;
- stale retry >32 через prefix gate;
- отдельная content-free segment-context identity, включая empty input и post-compaction marker;
- stream/non-stream из одного canonical payload; до publication никаких client IDs/provider-derived data;
- client disconnect после provider-entered не владеет commit-critical task; server-owned bounded registry/drain;
- ambiguous transport после provider-intent не получает sibling retry без typed `PROVEN_NO_REMOTE_PROGRESS`;
- removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread;
- unresolved provider intent не очищается обычным TTL/LRU и имеет отдельный bounded capacity.

## Codex shell-env safety

До live probe обязателен candidate `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Read-only проверить исторический Windows digest; не перезапускать — выполнено, all-five-pending.
2. Восстановить fresh v4 `LATEST` exact runtime — выполнено для `20260822T064521Z-22a279609f`.
3. Доматериализовать **точный** `server.py` blob `f02cef6a...` без аппроксимации, прогнать V31 full-file `--check`, isolated apply и реальные current ordinary+compaction regressions. Assertions Stage A: unsupported v3/corrupt state/get-cleanup write failure => provider count 0 для ordinary и compaction; healthy v2 => прежнее поведение.
4. Только после Stage-A exact local PASS собрать Stage-B v3 store: legacy v2 read path + separate `provider_intents` ledger + exact replay/conversation state, сохраняя V12–V29. Зафиксировать `minimum_safe_rollback_commit` как Stage-A commit-кандидат до любой v3 publication.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/account removed/TTL+size/oversize/compaction exact+restart+legacy/unresolved intent >30d + >500 pressure + capacity/missing conversation identity/v3->Stage-A rollback failclosed.
6. Совместить shell-env patch локально.
7. Только когда Stage A + Stage B локально зелёные и Windows semantics остаются последним реальным рубежом, использовать один disposable `ci/notion-core-windows-final-gate` по policy; сохранить exact gate SHA/logs/results. Недоступный результат не считать PASS.
8. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`; capture должен доказать stable conversation id. Затем restart/recovery proof.

PR #7/#8 в этом проходе не менялись, hosted CI и provider traffic не запускались.
