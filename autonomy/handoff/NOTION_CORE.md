# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; fresh read-only head `cd442df4e4574822627761d7d3ea81df37844a41`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T161515Z-9368915ded`;
- archive SHA-256 `b932fbdd01f63f4a71598aee0fb8dde1ada6a56934084ff84b50c515e5cd8fb1`;
- 4 parts: 2048/2048/2048/1032 chars;
- manifest Git blob `cda89b0fdb05797cf062a962247254ea378b7edd`;
- part blobs: `464f39284ef3f1b84339c7b7de01926405ddfcae`, `aeab31b70775ab1bcae280293019e8f0ed559ed5`, `43d6304e94315308edcc786194bb829dcb512b2a`, `e4e1246a67f5db9372d71004423c17c1ce1752e9`;
- `LATEST.json` Git blob `626c27c80e525f9a5b4d07c0698b9e8e7272c02f`.

На старте предыдущий `LATEST` `20260821T145530Z-7d09429766` был полностью прочитан: manifest и все четыре части совпали с ожидаемыми blob SHA. Exact `capsule_runtime_v4.py` использовался для локального восстановления/упаковки. Перед публикацией нового указателя `LATEST` был повторно прочитан и оставался на exact parent blob `70558172fbdc2362258b94ce702486b5a07f4e81`; старый LATEST сохранён как `PREVIOUS`, затем новый LATEST опубликован CAS и перечитан.

Новый долговечный материал:
- `autonomy/evidence/notion/20260821T1618Z_durable_replay_v12_ordering_model.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В fresh read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V12

Fresh exact blobs PR #8:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Текущая product-семантика всё ещё аварийно неверна:
1. `ForegroundAccountReservations` и memory-only `TurnAffinityStore` меняются до durable ConversationSegmentStore write.
2. `ConversationSegmentStore._save_locked()` глотает NCM28/OSError и только ставит `persistence_blocked`, поэтому caller не знает, что durable publication не состоялась.
3. Финальные `response_id/item_id/call_id` создаются только после этих шагов.
4. Cache hit хранит только completion text и заново создаёт IDs.
5. `stream_openai_responses()` выдаёт `resp_*`/`rs_*` до durable commit и добавляет request-local reasoning item в `response.completed`.

Обязательный порядок V12:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

До durable publication нельзя выдавать клиенту identity-bearing IDs. Stream/non-stream должны быть проекциями одного persisted canonical payload; предпочтительно после commit использовать deterministic `responses_sse()`.

V8/V9/V10/V11 инварианты сохраняются:
- внешний state `version=2`, replay marker внутри записи;
- `turn_id` и `request_kind` входят в request identity, `stream` не входит;
- stale old retry tombstone-ится;
- replay TTL 6h, максимум 512 KiB на ответ, 8 MiB суммарно, 32 stale fingerprints;
- strict write failure откатывает in-memory mutations через deep copy;
- persisted tool-call rehydrates reservation только для существующего current account id; удалённый owner => clear ghost reservation + fail closed, без молчаливой замены account/thread;
- persisted final response очищает stale reservation.

Новый V12 guard: если strict durable write один раз упал и store стал `persistence_blocked`, повтор должен остановиться **до provider call**. Иначе после первой неудачной публикации второй запрос снова попросит модель спланировать действие, хотя безопасного durable состояния уже нет.

Локальный harness повторно прошёл: `DURABLE_REPLAY_V12_END_TO_END_ORDERING_MODEL_PASS`, 10 сценариев. Проверены same retry/restart с теми же IDs и provider call_count=1; stream/non-stream canonical identity; новый turn с тем же текстом; stale retry; write failure => zero cache/zero reservation/zero client result; blocked-store retry before provider; post-commit reservation failure + recovery; removed owner after restart; final response clears reservation.

Это пока локальная модель порядка, НЕ product fix. В `notion-agent-bridge` ничего не пушилось.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: во временный Codex config добавить `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Локальный verdict ранее: `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Собрать один apply-ready exact-source patch настоящих `ConversationSegmentStore + server.py`, реализующий V12: strict write observable to caller, canonical persisted response, replay lookup before provider, fail-closed blocked-store, post-commit TurnAffinity + reservation rehydration/current-account validation, deterministic stream projection.
3. Локально на exact source проверить: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / second retry after blocked store / post-commit reservation failure / account removed across restart / stream↔non-stream / size+TTL eviction. После successful durable replay provider call_count=1; при write failure zero cache, zero reservation, zero identity-bearing output.
4. После этого совместить уже готовый shell-env patch в Core/Agent integration проверке. Product push не делать при ZERO-MINUTE.
5. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
