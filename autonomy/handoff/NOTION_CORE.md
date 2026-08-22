# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `f58f0123b370ad786d337337eb03a6a4ce9963b3`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. На этом head Core-boundary blobs: `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`, `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260822T060802Z-2f8776e109`;
- archive SHA-256 `4f4cf0451a1205fdd8ed990e3a6fcbd9c0f930973a0f31517207c091b6771ab1`;
- parts: 3;
- part blobs: `048220f6c54521b9cf027237ea4a74d30439c0ed`, `c9fdd0c9c904b6e01288dfc868f1ea53d97a4dd7`, `aef17ff4340449e7a3768133af45274911da8360`;
- manifest blob `078d7537e3b49bf467080ea4c7ac15641b1807b7`;
- `LATEST.json` blob после CAS: `72443419f2fafd3c5249a3e3d701150e9d030a6e`.

Все immutable parts и manifest перечитаны после публикации. Readback поймал ошибочно загруженный `part-0001`; `LATEST` не переключался, пока part не был заменён точными локальными байтами и повторно проверен (`c9fdd0...`). Предыдущий проверенный `LATEST` `20260822T060303Z-5ee7edb294` сохранён как `PREVIOUS`. На старте запуска прежняя capsule была восстановлена exact `capsule_runtime_v4.py`; неизвестные bytes не реконструировались.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28 gate. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses / Codex replay — текущая граница

Текущий product-сервер всё ещё аварийно небезопасен: remote Notion call идёт до durable exact replay publication; reservation и memory-only `TurnAffinityStore` меняются до durable publication; `ConversationSegmentStore` глотает NCM28/OSError в `persistence_blocked`; окончательные `response_id/item_id/call_id` создаются позже; text-cache регенерирует ID; streaming заранее выдаёт идентификаторы/provider-derived thinking и отменяет незавершённый `run_request()` при закрытии клиента.

Уже доказанные локальные слои V12–V26 сохраняются как требования, но **старые patch-файлы нельзя механически складывать**: V27/V28 меняют schema rollout и форму provider-intent.

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

Локальные результаты: `V27_VERSION2_DOWNGRADE_METADATA_STRIP_REPRODUCED`, `V27_VERSION3_OLD_SERVER_ROLLBACK_PROVIDER_REENTRY_REPRODUCED`, `V27_SCHEMA_EPOCH_ROLLBACK_FLOOR_MODEL_PASS`.

Материалы: `autonomy/evidence/notion/20260822T0605Z_durable_replay_v27_schema_epoch_rollback_floor.*`.

### V28 — отдельный `provider_intents` ledger

Provider intent нельзя представлять fake `ConversationSegment`: на первой операции ещё нет настоящих `account_id/notion_thread_id`, а fake segment может быть ошибочно принят rollover/anchor/diagnostic логикой за реальную Notion-ветку.

Предпочтительная v3 форма:
- top-level `provider_intents[conversation_storage_key] = {request_fingerprint, request_kind, created_at}` — только обезличенные данные;
- `conversations` содержит только реальный provider segment/progress/exact replay после результата;
- finalize одной NCM28 atomic write одновременно создаёт/обновляет real segment + exact replay и удаляет matching intent;
- final write failure сохраняет intent и не публикует fake/partial segment;
- general conversation TTL/LRU не удаляет provider-intents; отдельный V25 bound `MAX_UNRESOLVED_PROVIDER_INTENTS=128`.

Локальный итог: `DURABLE_REPLAY_V28_SEPARATE_INTENT_LEDGER_MODEL_PASS` плюс отдельные PASS для first request, atomic finalize, failed finalize, cleanup survival и capacity.

Материалы: `autonomy/evidence/notion/20260822T0618Z_durable_replay_v28_separate_provider_intent_ledger.{json,py}`.

### V29 — stable conversation identity обязательна

`codex_conversation_key(body)` = `client_metadata.thread_id` или fallback `session_id`. Store при `key=None` не имеет durable namespace. Поэтому перед новой provider-entering ordinary Responses или compaction операцией durable Core mode требует non-empty stable conversation key; иначе fail closed до provider. Не синтезировать ключ из request hash, `turn_id`, random UUID, HTTP connection или memory cache.

Synthetic/live bridge probe явно передаёт `thread_id`. Настоящий `codex exec` probe пока проверяет итоговый JSONL/files, но **не доказывает**, что фактический Codex build отправляет стабильный `thread_id/session_id` на wire. Live acceptance должна добавить обезличенный capture и доказать один и тот же conversation id на initial turn, tool-result continuation, retry и restart.

Локальный итог: `DURABLE_REPLAY_V29_STABLE_IDENTITY_FAILCLOSED_MODEL_PASS` + подтверждён metadata evidence gap настоящего CLI probe.

Материалы: `autonomy/evidence/notion/20260822T0635Z_durable_replay_v29_stable_conversation_identity.{json,py}`.

### V30 — Stage-A floor уже материализован как exact-preimage candidate

Подготовлен отдельный кандидат Stage A, не меняющий product branch:
- `ConversationSegmentStore.require_persistence_ready()`;
- server вызывает его **после** `conversation_segments.get()` (потому что load/cleanup внутри get может впервые заблокировать persistence) и **до** account lease/provider entry;
- тот же `handle_openai_responses()` защищает ordinary Responses и compaction;
- in-memory `path=None` остаётся совместимым с unit fakes/явно ephemeral uses.

Локальная модель прошла: unsupported/corrupt load => provider 0; cleanup write failure during get => provider 0; compaction => тот же floor; healthy durable store => provider 1; ephemeral store compatibility => PASS.

Exact-preimage materializer проверяет Git blobs `conversation_segments=553bd349...`, `server=f02cef6a...`, требует ровно один anchor, компилирует оба rendered Python-файла до mutation, по умолчанию работает read-only, `--apply` пишет через sibling temp + `os.replace`.

Материалы:
- `autonomy/evidence/notion/20260822T0650Z_v30_stage_a_compatibility_floor_evidence.json`;
- `..._exact.patch` (integration sketch);
- `..._materializer.py` (предпочтительный apply/check механизм).

**Product branch не изменён.** Следующий шаг — materialize exact checkout локально, сначала `materializer --check`, затем apply только на изолированной копии и прогнать настоящие current tests + targeted provider-count regressions. Только после локального Stage-A PASS можно строить v3 Stage B.

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

1. Read-only проверить Windows digest; не перезапускать.
2. Восстановить fresh v4 `LATEST` через exact runtime.
3. Материализовать exact PR8 checkout локально и прогнать V30 exact-preimage materializer в `--check`; затем apply на isolated copy и настоящие local regressions. Assertions Stage A: unsupported v3/corrupt state/get-cleanup write failure => provider count 0 для ordinary + compaction; healthy v2 => прежнее поведение.
4. Только после Stage-A local PASS собрать Stage-B v3 store: legacy v2 read path + separate `provider_intents` ledger + exact replay/conversation state, сохраняя V12–V29. Зафиксировать `minimum_safe_rollback_commit` как Stage-A commit-кандидат до любой v3 publication.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/account removed/TTL+size/oversize/compaction exact+restart+legacy/unresolved intent >30d + >500 pressure + capacity/missing conversation identity/v3->Stage-A rollback failclosed.
6. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
7. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`; capture должен доказать стабильный conversation id. Затем restart/recovery proof.

PR #7/#8 в этом проходе не менялись, hosted CI и provider traffic не запускались.
