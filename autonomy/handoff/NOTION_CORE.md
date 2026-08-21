# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; read-only head в этом запуске `bdb6c24d9693d1347fb01f616ffb5826a916f297`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T124611Z-ddaa375745`;
- archive SHA-256 `76b94e212550f618b94c9a8b10aebaf795ef9bc364a71d7a3c8c937ccfe150b8`;
- 3 parts: 800/800/404 chars;
- manifest Git blob `f14622a09bff55f8d94ed2bee7a901daa5752da1`;
- part blobs: `d1d40ed2774b5121eab0928f7d08a44c8ada3c30`, `22e99468d040920a1b5a6252ca7cdfb780b5c13e`, `8bec83bdcf4a9a7e39111265f806587bb779a96f`;
- `LATEST.json` Git blob `9d177ee7a42795d3c3d1e0e3928d2ea3060a7399`.

На старте capsule `20260821T115242Z-b890e09862` была восстановлена через v4 с полной проверкой manifest/parts/archive/workspace; archive SHA `8857bdcd88be830274fb3318e1c0e0539bf42d0f4584c640d0dd96b6e530ecaf`.

Новая capsule упакована exact v4 после checkpoint. Все три part перечитаны и совпали с локальными Git blob SHA. Первичная публикация manifest имела другое форматирование и потому другой blob; обязательная проверка это поймала, manifest заменён точными локальными байтами и повторно прочитан с blob `f14622a...`. Перед переключением `LATEST` указатель был снова прочитан и остался на parent blob `fd11cb32e3b657c88a170e718845e0a7f697255f`; старый LATEST сохранён как PREVIOUS, новый опубликован CAS-обновлением и повторно прочитан.

Долговечное новое доказательство: `autonomy/evidence/notion/20260821T1245Z_durable_replay_v10_ephemeral_rehydration.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В свежей read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8/V9 база

Fresh exact blobs на проверенной интеграционной границе PR #8:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`.

V8 уже локально доказал strict durable store: outer state version остаётся `2`; exact rendered replay переживает restart; `turn_id`/`request_kind` участвуют в identity, `stream` нет; stale retry tombstone-ится; >512 KiB fail-closed; 6h TTL / 8 MiB total / 32 stale fingerprints; forced NCM28 write failure наблюдаем и откатывает память через deep copy.

V9 доказал, что нынешний `stream_openai_responses()` неидемпотентен: он генерирует новый `rs_*` и вставляет request-local reasoning item в `response.completed`. Поэтому streaming/non-streaming после commit должны быть проекциями одного persisted canonical Responses payload. До durable publication нельзя выдавать `resp_`, `call_`, `fc_`, `ctc_`, `msg_` или `rs_`. Предпочтительная post-commit проекция — deterministic `responses_sse()` из готового canonical response.

## V10 — post-commit ephemeral rehydration

Новый найденный Core-дефект: порядок `durable commit -> memory cache/reservation -> client` сам по себе недостаточен после restart. `ForegroundAccountReservations` живёт только в памяти. Если persisted tool-call просто вернуть Codex после restart, его owner-account больше не защищён на локальном tool-gap, и независимая работа может занять этот аккаунт. Обратный случай: persisted final response обязан очистить возможную старую reservation до выдачи клиенту.

Новый обязательный инвариант:
1. provider completion/correction;
2. один canonical Responses payload со всеми client-visible IDs;
3. strict atomic NCM28 publication conversation progress + exact replay;
4. после commit восстановить/обновить memory-only cache;
5. до client output: persisted tool-call => `reserve(turn_key, persisted account_id)`; persisted final response => `clear(turn_key)`;
6. только затем identity-bearing HTTP/SSE.

Если post-commit cache/reservation reconstruction падает, durable response уже является source of truth. Клиенту ответ не выдавать; повтор должен заново восстановить ephemeral state из durable record и вернуть тот же response без второго provider call.

Local verdict: `DURABLE_REPLAY_V10_EPHEMERAL_REHYDRATION_PASS`.

Проверено локально:
- same-turn retry: provider call_count остаётся 1;
- stream/non-stream имеют одну request identity;
- restart возвращает те же `response_id/item_id/call_id`;
- restart tool replay сначала восстанавливает reservation persisted account;
- новый `turn_id` с тем же body — новый provider call, предыдущий fingerprint становится stale;
- late stale retry блокируется без provider call;
- forced durable-write failure оставляет zero cache + zero reservation + zero client response;
- forced reservation failure после durable commit: retry восстанавливает reservation и возвращает тот же call без второго provider call;
- final-response replay очищает stale reservation;
- >512 KiB response fail-closed до записи.

Это пока не полный exact FastAPI server PASS: fixture использует реальную семантику свежих exact файлов и проверенную V8-store модель, но продуктовые `server.py/conversation_segments.py` не изменялись.

## Codex shell-env safety

Product probe всё ещё должен получить `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY` и `RUNTIME_STATE_KEY`. Предыдущий локальный verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`; живой Codex до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Сделать apply-ready exact-source patch для `ConversationSegmentStore + server`: V8 strict store, V9 canonical stream projection, V10 replay rehydration/clear.
3. Exact local tests: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / post-commit reservation failure / stream↔non-stream / size+TTL eviction. После successful durable replay provider call_count = 1. При write failure: zero cache, zero reservation, zero identity-bearing response.
4. Отдельно наложить shell-environment policy на exact Codex probe и расширить контрактный тест.
5. Product push не делать при ZERO-MINUTE. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
