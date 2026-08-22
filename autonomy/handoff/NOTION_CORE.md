# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `f58f0123b370ad786d337337eb03a6a4ce9963b3`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. На этом head Core-boundary blobs: `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`, `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260822T060303Z-5ee7edb294`;
- archive SHA-256 `c2835f6059e34640f63ff56161a898789e776168933471c441bd05e864e60f60`;
- parts: 2;
- part blobs: `faa4e61520bb20d4303a0665e13b509c699f1d3a`, `86387b25360a569bd8cbc577d2eb7312faa33af9`;
- manifest blob `e492255b3b02a623ab9459bb58183ad4149a4e53`;
- `LATEST.json` blob после CAS: `2255cd6a5528ba9fd9b7317be59656b18f74ca49`.

Перед публикацией обе части и manifest перечитаны из GitHub и совпали с локальными Git blob SHA. Предыдущий `LATEST` `20260822T055656Z-87761bd8db` сохранён как `PREVIOUS`. На старте запуска exact runtime v4 успешно восстановил прежнюю capsule `20260822T054419Z-6590fe2945`; никаких неизвестных байтов не реконструировалось.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28 gate. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses / Codex replay — текущая архитектурная граница

Текущий product-сервер всё ещё имеет аварийно неверный порядок: remote Notion call идёт до durable exact replay publication; reservation и memory-only `TurnAffinityStore` меняются до durable publication; `ConversationSegmentStore` глотает NCM28/OSError в `persistence_blocked`; окончательные `response_id/item_id/call_id` создаются позже; completion-text cache регенерирует ID; streaming заранее выдаёт `resp_*`/`rs_*` и provider-derived thinking и отменяет незавершённый `run_request()` при закрытии клиента.

Уже доказанные локальные слои кандидата V12–V26 сохраняются, но механически применять старые patch-файлы нельзя: V27/V28 меняют сам формат долговечного состояния и порядок rollout.

Успешный конечный путь должен быть:
`strict provider-intent publication -> provider -> один canonical Responses/compaction payload -> strict atomic durable publication(progress + exact payload, clear intent) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful publication exact retry/restart возвращает те же `response_id/item_id/call_id`, provider count остаётся 1. Любая durable failure до provider => provider count 0. Любая final durable failure => старый provider-intent остаётся, ноль ephemeral mutation и ноль клиентского результата. Stream/non-stream — только проекции одного сохранённого canonical payload.

### V26 — compaction тоже обязан иметь pre-provider intent

V16 exact durable compaction replay всё ещё имел crash-window до финальной записи: Notion мог уже выполнить compaction, а локальный exact compact payload ещё не сохранён. Поэтому V22/V23/V25 политика provider-intent обязательна и для `request_kind=compaction`, не только обычного Responses.

Материалы:
- `autonomy/evidence/notion/20260822T0548Z_durable_replay_v26_compaction_preprovider_intent.json`;
- `..._harness.py`.

### V27 — новый schema epoch и rollback floor обязательны

Новый доказанный блокер: хранить V12/V22–V26 replay/intents под внешним `conversation-state version=2` небезопасно при откате. Exact current v2 loader восстанавливает только известные поля `ConversationSegment` и игнорирует неизвестные top-level/per-record safety fields; следующий save старым бинарником их удаляет. Это стирает `replay_response`/provider-intent доказательства.

Простой переход на `version=3` тоже сам по себе недостаточен: нынешний v2 store помечает неподдерживаемую версию `persistence_blocked`, но нынешний server не проверяет этот флаг до provider entry и способен снова войти в Notion с пустым in-memory state.

Обязательный staged rollout:
1. **Stage A compatibility floor** на внешнем v2: server после load/get и перед любым provider-entering Responses/compaction действием проверяет durable persistence readiness; unsupported/corrupt/blocked state => fail closed до Notion.
2. Только после доказанного Stage A публиковать **Stage B state version=3** с durable replay/intents.
3. Зафиксировать `minimum_safe_rollback_commit=<exact Stage-A commit>`. После первого v3 state rollback ниже этого commit запрещён. Stage-A бинарник при встрече v3 обязан fail closed до provider.

Локальные результаты:
- `V27_VERSION2_DOWNGRADE_METADATA_STRIP_REPRODUCED`;
- `V27_VERSION3_OLD_SERVER_ROLLBACK_PROVIDER_REENTRY_REPRODUCED`;
- `V27_SCHEMA_EPOCH_ROLLBACK_FLOOR_MODEL_PASS`.

Материалы:
- `autonomy/evidence/notion/20260822T0605Z_durable_replay_v27_schema_epoch_rollback_floor.json`;
- `..._harness.py`;
- `..._rollback_floor.patch`.

### V28 — provider intent хранить отдельным ledger, не fake ConversationSegment

V22/V25/V26 требуют intent до первого remote action. Но на первой операции ещё нет реальных `account_id/notion_thread_id`, тогда как текущий `ConversationSegment` именно их описывает. Создавать fake segment опасно: rollover/anchor/diagnostics могут принять tombstone за реальную Notion-ветку.

Предпочтительная v3 форма:
- top-level `provider_intents[conversation_storage_key] = {request_fingerprint, request_kind, created_at}` — только обезличенные данные;
- `conversations` содержит только настоящий provider segment/progress/exact replay после результата;
- finalize одной NCM28 atomic write одновременно создаёт/обновляет real segment + exact replay и удаляет matching intent;
- final write failure сохраняет intent и не публикует fake/partial segment;
- general conversation TTL/LRU не трогает provider-intents; отдельный V25 bound `MAX_UNRESOLVED_PROVIDER_INTENTS=128`.

Локальные PASS:
- `V28_FIRST_REQUEST_INTENT_WITHOUT_FAKE_SEGMENT_PASS`;
- `V28_FINALIZE_ATOMIC_SEGMENT_PLUS_REPLAY_PASS`;
- `V28_FINAL_WRITE_FAILURE_PRESERVES_INTENT_PASS`;
- `V28_INTENT_LEDGER_SURVIVES_CONVERSATION_CLEANUP_PASS`;
- `V28_SEPARATE_INTENT_CAPACITY_PASS`.

Материалы:
- `autonomy/evidence/notion/20260822T0618Z_durable_replay_v28_separate_provider_intent_ledger.json`;
- `..._harness.py`.

### V29 — stable conversation identity является Core safety gate

`codex_conversation_key(body)` сейчас = `client_metadata.thread_id` или fallback `session_id`. `ConversationSegmentStore.get/put` при `key=None` не создают долговечного namespace. Значит V22/V28 intent нельзя безопасно опубликовать для запроса без стабильного conversation id.

Обязательное правило: перед новой provider-entering обычной Responses или compaction операцией durable Core mode требует non-empty stable conversation key. Если его нет — fail closed до provider. Не синтезировать ключ из body hash, `turn_id`, random UUID, HTTP connection или memory cache: tool-result continuation/restart обязаны попадать в тот же durable namespace.

Synthetic/live bridge probe уже явно передаёт `thread_id`. Но настоящий `codex exec` probe пока проверяет только итоговые JSONL actions/files и **не доказывает**, что фактический Codex build отправляет стабильный `thread_id/session_id` на wire. Live acceptance должна добавить обезличенный protocol capture и доказать один и тот же conversation id на initial turn, tool-result continuation, retry и restart.

Локальные результаты:
- `V29_NONE_CONVERSATION_KEY_HAS_NO_DURABLE_INTENT_SLOT_REPRODUCED`;
- `V29_SYNTHETIC_PROBE_HAS_STABLE_THREAD_ID_CONFIRMED`;
- `V29_REAL_CODEX_METADATA_EVIDENCE_GAP_CONFIRMED`;
- `DURABLE_REPLAY_V29_STABLE_IDENTITY_FAILCLOSED_MODEL_PASS`.

Материалы:
- `autonomy/evidence/notion/20260822T0635Z_durable_replay_v29_stable_conversation_identity.json`;
- `..._harness.py`.

## Остальные обязательные уже доказанные слои V12–V25

Сохранить при сборке нового v3-кандидата:
- exact canonical Responses replay с неизменными IDs после retry/restart;
- detached `get()` / deepcopy и полный rollback памяти при write failure;
- oversize durable tombstone + exact replay TTL/size bounds;
- persistence gate после `get()`;
- exact durable compaction replay + legacy fail-closed;
- stale retry >32 через prefix gate;
- отдельная content-free segment-context identity, включая empty input и post-compaction marker;
- stream/non-stream из одного canonical payload; до publication никаких client IDs/provider-derived data;
- client disconnect после provider-entered не владеет жизнью commit-critical task; server-owned bounded task registry/drain;
- ambiguous transport после provider-intent не получает sibling retry без typed `PROVEN_NO_REMOTE_PROGRESS`;
- removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread;
- unresolved provider intent не очищается обычным TTL/LRU и имеет отдельный bounded capacity.

## Codex shell-env safety

До live probe обязателен exact-source candidate `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Восстановить fresh v4 `LATEST` через exact runtime.
3. **Не применять механически старый V12..V26 stack.** Сначала собрать точный Stage-A v2 compatibility-floor patch на свежих `conversation_segments.py + server.py` и локально доказать `unsupported/corrupt/write-blocked => provider count 0` для ordinary Responses и compaction.
4. Затем собрать Stage-B v3 store: legacy v2 read path + separate `provider_intents` ledger + exact replay/conversation state, сохраняя V12..V29 инварианты. Зафиксировать `minimum_safe_rollback_commit` как Stage-A commit-кандидат до любой v3 publication.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/account removed/TTL+size/oversize/compaction exact+restart+legacy/**unresolved intent >30d + >500 pressure + capacity**/**missing conversation identity**/**v3->Stage-A rollback failclosed**.
6. Assertions: successful replay provider count 1 + exact IDs/payload; unresolved intent => zero new provider call; pre-provider intent write failure => provider count 0; ambiguous transport => no sibling retry; final write failure => intent remains; general cleanup never erases ambiguity; no fake provider segment before provider result.
7. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
8. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`; capture должен доказать стабильный conversation id. Затем restart/recovery proof.

PR #7/#8 в этом проходе не менялись, hosted CI и provider traffic не запускались.
