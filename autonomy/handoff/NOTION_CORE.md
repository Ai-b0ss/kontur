# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; fresh read-only head `ce610b78f38a6f33dbdc5d0b6a46a25bbae907d9`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T171838Z-f0922fe343`;
- archive SHA-256 `57d432762b50dfd35a1abca854956a43643801c18764c3f08ad1a011a203f43a`;
- archive size 10896 bytes;
- 4 parts: 4096/4096/4096/2240 chars;
- part Git blobs: `df0995c941192e764648fe8872456fbf6023b2e1`, `9396207ecba94eeec86c1ba58c92d8fe63c1e16a`, `d46243ef95b0515b705b5896a9a6485453a76d33`, `90123f2d2042a08f52068d129cbe7ef06e713f44`;
- manifest Git blob `98b8d35b0b9357d553c4e35d1117bafddc717747`;
- `LATEST.json` Git blob `0824aa1d8c84afe7dcd4b460352bd5ee5f531074`.

На старте был полностью восстановлен предыдущий `LATEST` `20260821T161515Z-9368915ded` через exact `capsule_runtime_v4.py`; manifest, все четыре parts, archive SHA и workspace проверены. Перед публикацией нового указателя старый LATEST был повторно прочитан и оставался на exact parent blob `626c27c80e525f9a5b4d07c0698b9e8e7272c02f`; он сохранён как `PREVIOUS`, затем новый LATEST опубликован CAS и перечитан.

Новая capsule была упакована без `__pycache__`. При первом upload обязательная readback-проверка поймала неверные bytes part-0002/part-0003; LATEST до исправления не переключался. Обе части заменены точными локальными bytes, после чего все part Git blobs и manifest Git blob совпали с локально рассчитанными.

Новый долговечный материал:
- `autonomy/evidence/notion/20260821T1618Z_durable_replay_v12_ordering_model.json`;
- `autonomy/evidence/notion/20260821T1712Z_v12_exact_store_candidate.json`;
- `autonomy/evidence/notion/20260821T1712Z_v12_exact_patch_spec.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) по-прежнему `pending`. Hosted Windows/CI в этом запуске не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V12

Fresh exact blobs PR #8:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Текущая product-семантика всё ещё аварийно неверна:
1. `ForegroundAccountReservations` и memory-only `TurnAffinityStore` меняются до durable `ConversationSegmentStore` write.
2. `ConversationSegmentStore._save_locked()` глотает NCM28/OSError и только ставит `persistence_blocked`, поэтому caller не знает, что durable publication не состоялась.
3. Финальные `response_id/item_id/call_id` создаются только после этих шагов.
4. Cache hit хранит только completion text и заново создаёт IDs.
5. `stream_openai_responses()` выдаёт `resp_*`/`rs_*` до durable commit и добавляет request-local reasoning item в `response.completed`.

Обязательный порядок V12:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

До durable publication нельзя выдавать клиенту identity-bearing IDs. Stream/non-stream должны быть проекциями одного persisted canonical payload; после commit использовать детерминированную проекцию из готового payload.

Сохраняются инварианты V8–V11:
- внешний state `version=2`, replay marker внутри записи;
- `turn_id` и `request_kind` входят в request identity, `stream` не входит;
- stale old retry tombstone-ится;
- replay TTL 6h, максимум 512 KiB на ответ, 8 MiB суммарно, 32 stale fingerprints;
- strict write failure откатывает in-memory mutations через deep copy;
- persisted tool-call rehydrates reservation только для существующего current account id; удалённый owner => clear ghost reservation + fail closed, без молчаливой замены account/thread;
- persisted final response очищает stale reservation;
- если strict durable write однажды упал и store стал `persistence_blocked`, следующий retry должен остановиться до provider call.

### Новый exact-store кандидат

На свежей границе PR #8 собран локальный `V12_STORE_CANDIDATE.py` и targeted harness. Verdict: `DURABLE_REPLAY_V12_STORE_CANDIDATE_PASS`.

Проверено:
- outer state version остаётся `2`;
- inner replay schema version `1`;
- exact canonical Responses payload переживает restart с теми же IDs;
- legacy v2 читается без ложного заявления exact replay;
- stream/non-stream имеют одну request identity;
- forced durable write failure полностью откатывает in-memory state и переводит store в blocked;
- per-response/aggregate/TTL/tombstone limits соблюдаются;
- `ConversationSegmentStore.get()` в кандидате возвращает **detached deep copy**.

Последний guard важен: exact product `get()` сейчас возвращает сам внутренний `ConversationSegment`. Если server при подготовке replay начнёт менять его до commit, то мутация попадёт в live in-memory durable record и способна обойти rollback. Поэтому V12 implementation не должна мутировать объект, полученный из `get()`, до успешной публикации; безопаснее возвращать detached copy.

Это пока apply-ready локальный store candidate + exact integration spec, НЕ product fix. В `notion-agent-bridge` ничего не пушилось.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: во временный Codex config добавить `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Локальный verdict ранее: `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Материализовать полный exact `server.py` текущего PR #8 и наложить V12 локально вместе с проверенным store candidate: strict write observable to caller, canonical persisted response, replay lookup before provider, fail-closed blocked-store, post-commit TurnAffinity + reservation rehydration/current-account validation, deterministic stream projection.
3. Локально на exact source проверить: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / second retry after blocked store / post-commit reservation failure / account removed across restart / stream↔non-stream / size+TTL eviction. После successful durable replay provider call_count=1; при write failure zero cache, zero reservation, zero identity-bearing output.
4. Затем совместить уже готовый shell-env patch в Core/Agent integration проверке. Product push не делать при ZERO-MINUTE.
5. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
