# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `d2ada47dd096e1273a8bfb1977240a6034e8e622`. Не дублировать rotation, prompt modes, delegation или account/thread affinity. Для Core важен только стык lifecycle/Codex. На этом head `payload/server.py` всё ещё blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, `payload/conversation_segments.py` — `553bd3496c21a7949c3a5dfa03f33b9e09293213`, `payload/turn_affinity.py` — `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`, `payload/account_pool.py` — `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` остаётся прежним:
- capsule `20260821T175055Z-bef4130f09`;
- archive SHA-256 `023f5542a5e693795e3d5b28d89ba8a848156603653ccb8639c2fc84f8295703`;
- archive size 17824 bytes, 6 parts;
- manifest blob `8ca3e2581bbd7a67800648f4945f2b1beefbfa92`;
- `LATEST.json` blob, перечитанный в начале этого запуска: `170db9da4c5e92e93a3905264b1de95ce45e4a8c`.

В этом запуске свежо перечитаны manifest и все шесть immutable parts. Но локальная ручная материализация `capsule_runtime_v4.py` не совпала с каноническим Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`, поэтому этот локальный файл не использовался для restore/pack и `LATEST` намеренно не переключался. Не выдавать ручную реконструкцию за точный v4 runtime. Новый материал сохранён отдельными immutable evidence-файлами.

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

Объединённая последовательность кандидата сейчас:
1. V12 exact durable replay/store candidate;
2. V12 fixup;
3. V17 detached `get()`;
4. V14 durable oversize tombstone;
5. V15 post-`get()` persistence gate + strict compaction ordering;
6. V16 durable exact compaction replay + legacy fail-closed fixup;
7. V18 stale-prefix gate после вытеснения старого SHA из bounded ring;
8. V19 отдельная content-free identity контекста сегмента для `input=[]` и compaction;
9. V20 transport-disconnect commit boundary;
10. V21 server-owned commit-critical task lifetime;
11. V22 pre-provider durable intent tombstone для hard-crash safety;
12. **V23 ambiguous-transport intent gate**.

### Базовые инварианты V12–V19

Успешный путь:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful publication exact retry/restart возвращает те же `response_id/item_id/call_id`, provider count остаётся 1. Любая durable failure до publication => ноль ephemeral mutation и ноль клиентского результата. Stream/non-stream — проекции одного сохранённого canonical payload. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread.

V17: `ConversationSegmentStore.get()` обязан отдавать `deepcopy`, иначе precommit mutation портит in-memory durable preimage до строгой записи.

V18: очень старый retry, уже вытесненный из 32-entry stale-ring, блокируется как строгий префикс нынешней durable истории; нормальный append проходит. После compaction легальное сокращение истории не должно давать ложную блокировку.

V19: identity сегмента должна иметь отдельный content-free context fingerprint, потому что `response_input_fingerprints()` при `input=[]` возвращает `()`. Context identity включает request kind, tools/tool_choice, output/text contract и prompt-policy/operator context; изменение контракта => новый сегмент.

### V20/V21 — обрыв SSE и владение commit-task

Точный `stream_openai_responses()` создаёт `run_request()` локальной asyncio-task и в `finally` делает `task.cancel()` для незавершённой задачи. Если клиент исчез после remote provider progress, но до durable publication, retry способен снова вызвать provider.

V20 отделяет lifetime HTTP/SSE consumer от commit-critical transaction после начала provider-side work. V21 требует server-owned registry сильных ссылок на commit-critical tasks, сбор их исключений и bounded shutdown drain до закрытия account pool. До strict durable publication нельзя отдавать provider-derived данные или response/call/reasoning IDs.

Evidence:
- `autonomy/evidence/notion/20260822T0045Z_durable_replay_v20_stream_disconnect_commit_boundary.json`;
- `autonomy/evidence/notion/20260822T0148Z_durable_replay_v21_detached_commit_ownership.json`.

### V22 — hard process crash до final publication

До первого действия, которое может продвинуть remote Notion thread, strict durable publication content-free provider-intent tombstone с exact request fingerprint и segment identity.

Правила:
- exact durable replay есть => вернуть его, provider не трогать;
- unresolved exact intent есть => fail closed до provider;
- unresolved intent есть для того же remote segment, но пришёл другой request => не продолжать этот segment без reconciliation/proven fresh-segment rule;
- после provider success финальная strict atomic publication одновременно пишет canonical replay/progress и очищает intent;
- final publication failure или неопределённый provider outcome => intent остаётся;
- ordinary replay TTL не удаляет unresolved provider-intent tombstone.

Evidence/code:
- `autonomy/evidence/notion/20260822T0245Z_durable_replay_v22_preprovider_intent_tombstone.json`;
- `autonomy/evidence/notion/20260822T0245Z_durable_replay_v22_preprovider_intent_tombstone_harness.py`.

### V23 — ambiguous transport нельзя превращать в чистый failover success

Новый exact-source дефект найден на стыке V22 с текущим `AccountLease.run()`.

`payload/account_pool.py` сейчас считает `NotionAgentError(TRANSPORT)` и `httpx.HTTPError` failover-eligible. Для Notion TRANSPORT `_record_transport_failure()` записывает `provider_call_entered=True` и `response_progress_observation_complete=False`, то есть нижний слой **не доказал**, что удалённый Notion не продвинулся. `transport_evidence.py` такие наблюдения классифицирует как неопределённые, а не как proof-of-no-progress. Тем не менее `AccountLease.run()` может переключиться на другой аккаунт и выполнить `retry_operation`; кроме того, в `handle_openai_responses()` есть ещё один bounded single-account TRANSPORT retry после `AccountPoolExhausted`.

Без V23 возможна цепочка:
`V22 intent pending -> attempt #1 entered Notion -> ambiguous transport failure -> automatic sibling retry -> attempt #2 succeeds -> final publication clears intent`.

Это теряет сам факт, что attempt #1 мог уже продвинуть remote thread. Локальная модель воспроизвела `provider_calls=2` и чистое final-state после неопределённого первого исхода.

Обязательный V23-инвариант:
- provider intent можно очистить только если учтён исход **каждой** provider-попытки;
- outcome classes: `PROVEN_NO_REMOTE_PROGRESS`, `REMOTE_PROGRESS_POSSIBLE_OR_UNKNOWN`, `REMOTE_PROGRESS_CONFIRMED`;
- только `PROVEN_NO_REMOTE_PROGRESS` разрешает новый provider attempt для того же logical request;
- `REMOTE_PROGRESS_POSSIBLE_OR_UNKNOWN` оставляет/усиливает durable intent и возвращает fail-closed, без sibling retry;
- generic `httpx.HTTPError` считать ambiguous, пока нижний слой не дал явное proof-of-no-progress;
- существующий outer timeout уже fail-closed и соответствует этому правилу;
- это не отменяет multi-account rotation для независимой безопасной работы; блокируется только автоматическое повторение **неопределённой** уже начатой удалённой операции.

Локальные verdicts:
- `CURRENT_V22_PLUS_LEASE_AMBIGUOUS_FAILOVER_REPRODUCED`;
- `V23_AMBIGUOUS_TRANSPORT_FAIL_CLOSED_PASS`;
- `V23_PROVEN_PRE_PROVIDER_RETRY_PASS`.

Evidence/code:
- `autonomy/evidence/notion/20260822T0340Z_durable_replay_v23_ambiguous_transport_intent.json`;
- `autonomy/evidence/notion/20260822T0340Z_durable_replay_v23_ambiguous_transport_intent_harness.py`.

## Codex shell-env safety

До live probe обязателен exact-source candidate `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Собрать один local apply-ready candidate поверх exact `conversation_segments.py + server.py`, включая V12/V17/V14/V15/V16/V18/V19/V20/V21/V22/V23.
3. V22/V23 связать с transport layer: intent-before-provider; никакого автоматического retry/failover после ambiguous entered-provider outcome; final replay publication очищает intent только после доказанного безопасного исхода всех попыток.
4. Добавить server-owned commit registry/drain из V21 как availability/graceful-shutdown слой поверх V22 hard-crash tombstone.
5. Real-class offline matrix: retry/restart/distinct turn/stale retry >32/tool/final/forced NCM28 write/cleanup-write failure/blocked retry/stream↔non-stream/client disconnect/hard-crash intent/ambiguous transport/safe pre-provider retry/account removed/TTL+size/oversize tombstone/compaction exact+restart+legacy retry.
6. Assertions: successful replay provider count 1 + exact IDs/payload; unresolved provider intent => zero new provider call; any pre-provider intent write failure => provider count 0; ambiguous entered-provider transport => no sibling retry; final write failure => intent remains; no prepublication client IDs/provider-derived data.
7. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
8. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
