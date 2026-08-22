# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `590ae476b7dee4a9a07916cb3504c70568c12552`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. На этом head Core-boundary blobs по-прежнему: `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

В начале текущего запуска точным `capsule_runtime_v4.py` восстановлена проверенная capsule `20260822T040238Z-cb4f3f7946`, archive SHA-256 `5609dcd7d5e74724762d308efe79e1b2a6f871a33a1e0af91a22de2a68ab7ed6`.

После V24 собрана новая immutable capsule `20260822T041253Z-663a897add`, archive SHA-256 `510ede4c23fd62ff7ef022d59893b80ff680d01674c82a2a29f07d1c6e819345`. Оба part и manifest опубликованы и перечитаны; Git blob SHA совпали с локальными `git hash-object`:
- `part-0000.b64` → `87faa6c7d382e868fac39e01dfeb603c9ed3d055`;
- `part-0001.b64` → `c0a55753f8bb8a6214b1b03991d0810650eb1c47`;
- `manifest.json` → `552e227cde793d91aae203b4997c8e2ab9b5d7ff`.

Но `LATEST.json` Git blob изменился между стартом запуска (`5bed98d62ca154a1a8d7a874fd2d55df8d8139d1`) и обязательным пред-публикационным reread (`4faef2dbf4ab0ccc2e49dd65f7fad3a515baf859`). По CAS-протоколу новый `LATEST` **не публиковался и force-write не делался**. Capsule `20260822T041253Z-663a897add` остаётся валидным immutable checkpoint/orphan; текущий указатель принадлежит более свежему писателю и должен приниматься следующим запуском после обычного restore.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28 gate. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses / Codex replay — текущая линия

Текущий product-сервер всё ещё имеет аварийно неверный порядок:
- remote Notion call происходит до durable exact replay publication;
- reservation и memory-only `TurnAffinityStore` меняются до durable publication;
- `ConversationSegmentStore._save_locked()` глотает NCM28/OSError в `persistence_blocked`;
- окончательные `response_id/item_id/call_id` создаются позже;
- completion-text cache регенерирует ID;
- streaming заранее создаёт `resp_*`/`rs_*`, выдаёт provider-derived thinking и в generator `finally` отменяет незавершённый `run_request()`.

Объединённая последовательность кандидата:
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
12. **V24 transport retry proof boundary**.

Успешный путь должен быть:
`strict provider-intent publication -> provider -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload, clear intent) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful publication exact retry/restart возвращает те же `response_id/item_id/call_id`, provider count остаётся 1. Любая durable failure до publication => ноль ephemeral mutation и ноль клиентского результата. Stream/non-stream — проекции одного сохранённого canonical payload. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread.

### V23/V24 — transport ambiguity и граница безопасного retry

Свежая exact-source сверка `payload/account_pool.py` и `payload/transport_evidence.py` показала: текущий нижний слой **не умеет доказать**, что TRANSPORT/httpx ошибка случилась до возможного remote progress.

`_record_transport_failure()` сейчас записывает `provider_call_entered=True` и `response_progress_observation_complete=False`. `classify_transport()` на основании curl code/timing/progress выдаёт диагностические гипотезы (`INDETERMINATE`, `SUPPORTED_BUT_NOT_PROVEN`, `REFUTED_FOR_SIMPLE_PRE_RESPONSE_CONNECT_TIMEOUT` и т.п.), но ни одна из них не является доказательством «Notion точно не получил/не продвинул запрос».

Следствие V24: **нельзя ослаблять V23 по curl code, connect timing или похожей эвристике.** В durable Core режиме все нынешние `NotionAgentError(TRANSPORT)` и generic `httpx.HTTPError` после provider intent остаются `provider_outcome_uncertain` и не получают sibling retry. Rate-limit и прочий доказанно безопасный non-transport failover остаются отдельной политикой и не меняются.

Единственное допустимое будущее исключение: нижний слой должен выдать отдельный типизированный факт `PROVEN_NO_REMOTE_PROGRESS` / «provider call не был начат». Пока такого producer в exact source нет, availability exception не добавлять.

Локальный V24 harness прошёл:
- `V24_CURRENT_TRANSPORT_EVIDENCE_NEVER_PROVES_SAFE_RETRY_PASS`;
- `V24_CURL_TIMING_NOT_PROMOTED_TO_REMOTE_ABSENCE_PASS`;
- `V24_EXPLICIT_PRE_PROVIDER_PROOF_CAN_ENABLE_RETRY_PASS`;
- `V24_RESPONSE_PROGRESS_REMAINS_FAIL_CLOSED_PASS`.

Evidence:
- `autonomy/evidence/notion/20260822T0430Z_durable_replay_v23_transport_failclosed_candidate_v2.patch` — текущий preferred V23 candidate;
- `autonomy/evidence/notion/20260822T0430Z_durable_replay_v23_candidate_self_review.json`;
- `autonomy/evidence/notion/20260822T0412Z_durable_replay_v24_transport_retry_proof_boundary.json`;
- `autonomy/evidence/notion/20260822T0412Z_durable_replay_v24_transport_retry_proof_boundary.py`.

## Codex shell-env safety

До live probe обязателен exact-source candidate `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Восстановить fresh v4 `LATEST`; если более свежий CAS-writer победил, принять его. Immutable capsule `20260822T041253Z-663a897add` использовать только как checkpoint V24, не force-promote.
3. Собрать один local apply-ready candidate поверх exact `conversation_segments.py + server.py + account_pool.py`, включая V12/V17/V14/V15/V16/V18/V19/V20/V21/V22/V23/V24.
4. V23 включать только после V22 durable provider-intent publication. Не добавлять эвристический retry по curl/timing; разрешать retry после intent только при отдельном typed `PROVEN_NO_REMOTE_PROGRESS` из нижнего слоя.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/account removed/TTL+size/oversize tombstone/compaction exact+restart+legacy retry.
6. Assertions: successful replay provider count 1 + exact IDs/payload; unresolved provider intent => zero new provider call; pre-provider intent write failure => provider count 0; ambiguous entered-provider transport => no sibling retry; final write failure => intent remains; no prepublication client IDs/provider-derived data.
7. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
8. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в текущем проходе не менялись, hosted CI и provider traffic не запускались.
