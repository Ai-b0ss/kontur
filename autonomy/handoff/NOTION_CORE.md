# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `590ae476b7dee4a9a07916cb3504c70568c12552`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. На этом head Core-boundary blobs: `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

В начале текущего запуска точным `capsule_runtime_v4.py` восстановлена capsule `20260822T040238Z-cb4f3f7946`, archive SHA-256 `5609dcd7d5e74724762d308efe79e1b2a6f871a33a1e0af91a22de2a68ab7ed6`; стартовый Git blob `LATEST.json` — `4faef2dbf4ab0ccc2e49dd65f7fad3a515baf859`.

После V25 создана и полностью перечитана capsule `20260822T044712Z-91cb612bc4`, archive SHA-256 `2648aa631533d419625f2385f612b7a8b0656dedfd04d20c98385afcfe42ad02`:
- `part-0000.b64` Git blob `f0d81a61a7af6e4d142d8d644a08d9e12f65722c`;
- `part-0001.b64` Git blob `5f65ff8187d944ec74157152b7721ee59e6154dc`;
- `manifest.json` Git blob `17c5ee11de7df420f14e0368070969e4ea1205ee`.

Перед публикацией `LATEST` был перечитан и его blob остался равен стартовому `4faef2...`, поэтому CAS разрешён. Старый `LATEST` сохранён как `PREVIOUS`; новый `LATEST` опубликован и повторно прочитан, blob `ef1200fe753e5507107c8e1108fed04ab0e22f0d`.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28 gate. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses / Codex replay

Текущий product-сервер всё ещё имеет аварийно неверный порядок: remote Notion call идёт до durable exact replay publication; reservation и memory-only `TurnAffinityStore` меняются до durable publication; `ConversationSegmentStore` глотает NCM28/OSError в `persistence_blocked`; окончательные `response_id/item_id/call_id` создаются позже; completion-text cache регенерирует ID; streaming заранее выдаёт `resp_*`/`rs_*` и provider-derived thinking и отменяет незавершённый `run_request()` при закрытии клиента.

Объединённая последовательность локального кандидата:
1. V12 exact durable replay/store + fixup;
2. V17 detached `get()`;
3. V14 durable oversize tombstone;
4. V15 post-`get()` persistence gate + strict compaction ordering;
5. V16 durable exact compaction replay + legacy fail-closed fixup;
6. V18 stale-prefix gate;
7. V19 separate content-free segment-context identity + post-compaction marker;
8. V20 contract-independent prefix/stream-disconnect boundary;
9. V21 server-owned commit-critical task registry/drain;
10. V22 pre-provider durable intent tombstone;
11. V23 fail-closed ambiguous transport;
12. V24 transport retry proof boundary;
13. **V25 unresolved-intent retention/capacity safety**.

Успешный путь: `strict provider-intent publication -> provider -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload, clear intent) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful publication exact retry/restart возвращает те же `response_id/item_id/call_id`, provider count остаётся 1. Любая durable failure до publication => ноль ephemeral mutation и ноль клиентского результата. Stream/non-stream — проекции одного сохранённого canonical payload. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread.

### V23/V24 — transport ambiguity

Текущий нижний слой не умеет доказать, что `TRANSPORT`/`httpx` ошибка произошла до возможного remote progress. Поэтому после V22 intent все нынешние transport failures остаются `provider_outcome_uncertain` и не получают sibling retry. Curl code/timing — диагностика, не доказательство. Retry после intent допустим только при отдельном typed `PROVEN_NO_REMOTE_PROGRESS` от нижнего слоя; такого producer в exact source пока нет.

Preferred V23 candidate: `autonomy/evidence/notion/20260822T0430Z_durable_replay_v23_transport_failclosed_candidate_v2.patch`.
V24 evidence/harness: `autonomy/evidence/notion/20260822T0412Z_durable_replay_v24_transport_retry_proof_boundary.{json,py}`.

### V25 — unresolved provider-intent нельзя очищать как обычный conversation state

Новый доказанный gap: V12 general cleanup имеет `CONVERSATION_TTL = 30 days` и `MAX_CONVERSATIONS = 500`. Если V22 хранит `inflight_fp/inflight_started_at` в том же `ConversationSegment`, обычный TTL или LRU может молча удалить unresolved provider-intent tombstone. После этого поздний exact retry потеряет единственное durable доказательство того, что Notion уже мог продвинуть удалённую ветку, и снова сможет попасть к provider planning.

Локально воспроизведено:
- `CURRENT_GENERAL_TTL_DROPS_UNRESOLVED_INTENT_REPRODUCED`;
- `CURRENT_MAX_CONVERSATIONS_DROPS_UNRESOLVED_INTENT_REPRODUCED`.

Preferred V25 policy/candidate:
- unresolved intent не удаляется general TTL;
- обычные/finalized conversations вытесняются раньше unresolved intent;
- отдельный bound `MAX_UNRESOLVED_PROVIDER_INTENTS = 128`;
- при исчерпании bound новая provider-intent операция fail-closed, старые ambiguous bytes не удаляются;
- capacity check находится **только внутри V22 strict new-intent transaction после exact-replay/existing-intent checks**. Нельзя делать общий server precheck: self-review доказал, что при полном лимите он ошибочно блокирует безопасный exact replay и уже существующий ambiguous retry.

Локальные PASS:
- `V25_UNRESOLVED_INTENT_SURVIVES_TTL_AND_ORDINARY_CAPACITY_PASS`;
- `V25_UNRESOLVED_INTENT_CAPACITY_FAIL_CLOSED_PASS`;
- `V25_ORDINARY_EVICTION_PRECEDES_UNRESOLVED_INTENT_PASS`;
- `V25_V2_CAPACITY_CHECK_AT_NEW_INTENT_BOUNDARY_PASS`.

Материалы:
- evidence `autonomy/evidence/notion/20260822T0450Z_durable_replay_v25_unresolved_intent_retention.json`;
- harness `autonomy/evidence/notion/20260822T0450Z_durable_replay_v25_unresolved_intent_retention_harness.py`;
- preferred patch `autonomy/evidence/notion/20260822T0458Z_durable_replay_v25_unresolved_intent_retention_v2.patch`;
- self-review `autonomy/evidence/notion/20260822T0458Z_durable_replay_v25_candidate_self_review.json`;
- первый V25 patch `...0450Z...retention.patch` superseded, не применять.

## Codex shell-env safety

До live probe обязателен exact-source candidate `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Candidate: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Восстановить fresh v4 `LATEST` через exact runtime.
3. Собрать один local apply-ready candidate поверх exact `conversation_segments.py + server.py + account_pool.py`, включая V12..V25. V25 применять после V22 materializes inflight fields.
4. V23 включать только после успешной V22 durable provider-intent publication. Не добавлять эвристический retry по curl/timing.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/account removed/TTL+size/oversize tombstone/compaction exact+restart+legacy retry/**unresolved intent >30d + >500 pressure + capacity-limit exact replay**.
6. Assertions: successful replay provider count 1 + exact IDs/payload; unresolved provider intent => zero new provider call; pre-provider intent write failure => provider count 0; ambiguous entered-provider transport => no sibling retry; final write failure => intent remains; no prepublication client IDs/provider-derived data; general cleanup never erases ambiguity.
7. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
8. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом проходе не менялись, hosted CI и provider traffic не запускались.
