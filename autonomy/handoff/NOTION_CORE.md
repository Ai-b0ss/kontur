# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head `c97c4c1d7432d7ce3e003599ad9a46850045261e`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T115242Z-b890e09862`;
- archive SHA-256 `8857bdcd88be830274fb3318e1c0e0539bf42d0f4584c640d0dd96b6e530ecaf`;
- 3 parts: 800/800/20 chars;
- manifest Git blob `f5080951252fb64c2e4afab9a50c4f807fe01a68`;
- part blobs: `8dff4b28bdf2a1a725802fb979049af7abbe7817`, `11bf3189f1802849c66c18ec42db3498b62d0160`, `fd96342f29612383d63bc8470c1eba8f54379cc3`;
- `LATEST.json` Git blob `fd11cb32e3b657c88a170e718845e0a7f697255f`.

На старте восстановлена предыдущая capsule `20260821T104749Z-a683d83179` через exact `capsule_runtime_v4.py`: manifest/parts/archive/workspace verification PASS, archive SHA `083888cb89c46cc26b3c632d094c1b1941b5a102865b542cd22d61353d15e97f`.

Новая compact capsule упакована v4 после checkpoint. Все три загруженных part и manifest перечитаны из GitHub и совпали с локальными Git blob SHA; затем `LATEST` перечитан и остался на exact parent blob `d66e28d52257fe5026a97893e513cf85416b7edd`. Старый LATEST сохранён как PREVIOUS и новый LATEST опубликован CAS-обновлением с этим exact parent SHA, затем повторно прочитан.

Immutable orphan `20260821T114900Z-d2d1fed678` не публиковать: обязательная byte-проверка поймала несовпадение первого загруженного part с локальным blob. Его не исправляли и на него не переключали LATEST.

Новая capsule хранит checkpoint и краткую V9 границу; подробные V8/V9 доказательства находятся в control-ветке:
- `autonomy/evidence/notion/20260821T1047Z_durable_replay_v8_exact_store.json`;
- `autonomy/evidence/notion/20260821T1140Z_durable_replay_v9_stream_projection.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В свежей read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout.

Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8 exact-store candidate

Fresh PR #8 exact blobs:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`.

Локально materialized exact class `ConversationSegmentStore` и наложен V8 store candidate. Verdicts:
- `DURABLE_REPLAY_V8_STORE_EXACT_CLASS_PASS`;
- `DURABLE_REPLAY_V8_EVICTION_ROLLBACK_PASS`.

Доказано на реальном классе со stub только NCM28 filesystem primitive:
- same request после reload сохраняет exact rendered response IDs;
- `stream` исключён из fingerprint, `turn_id` и `request_kind` включены;
- новый turn tombstone-ит предыдущий request fingerprint;
- NCM28 write failure становится наблюдаемой ошибкой и откатывает memory state;
- >512 KiB rendered replay fail-closed до записи;
- outer state version остаётся `2`, legacy v2 читается без replay capability;
- size-eviction + forced write failure восстанавливает все прежние replay entries.

Shallow rollback запрещён: cleanup/TTL/8MiB eviction мутирует существующие `ConversationSegment` objects. Tested candidate использует `copy.deepcopy(self._items)` перед strict durable batch либо должен строить полностью non-mutating candidate state.

Пределы кандидата: replay TTL 6h, 512 KiB per response, 8 MiB total, 32 stale fingerprints.

## V9 — streaming projection defect

Новый reproduced defect: даже после V8 current `stream_openai_responses()` не был бы exact-idempotent. Он создаёт новый `reasoning_id = rs_<uuid>` на каждый streaming request и после получения canonical result вставляет этот request-local reasoning item в `response.completed.output`. Два повтора одного и того же durable canonical response поэтому завершаются разными final Responses objects.

Local verdict: `DURABLE_REPLAY_V9_STREAM_PROJECTION_LOCAL_PASS`.

Новый обязательный инвариант:
1. provider completion/correction;
2. один canonical Responses payload со ВСЕМИ IDs, которые попадут в final `response.completed`;
3. strict NCM28 publication progress + exact rendered replay;
4. только после успеха memory-only TurnAffinityStore;
5. только после успеха reserve/clear foreground account;
6. только после успеха identity-bearing HTTP/SSE.

До durable publication нельзя отдавать `resp_`, `call_`, `fc_`, `ctc_`, `msg_` или `rs_`. Если соединение нужно поддерживать, допустимы только identity-free SSE comments; совместимость ранних comments с текущим Codex пока `UNPROVEN`, поэтому безопасный fallback — вообще ничего не выдавать до commit.

После durable publication streaming и non-streaming должны быть проекциями одного и того же canonical persisted response. Самый простой путь — не добавлять request-local reasoning item в final response; если reasoning item нужен протоколу, его id/content тоже должны быть частью canonical persisted response.

Current `responses_sse(response, item)` уже умеет строить stream из готового canonical response без отдельного случайного reasoning item и выглядит предпочтительной post-commit границей; проверить на exact server fixture.

## Server ordering — ещё не продуктовый PASS

Fresh server по-прежнему делает операции в неправильном аварийном порядке: foreground reservation -> memory-only `TurnAffinityStore` -> `conversation_segments.put`; canonical `response_id/item_id/call_id` создаются лишь после этого. Fresh `ConversationSegmentStore._save_locked()` также всё ещё проглатывает NCM28 write error и лишь ставит `persistence_blocked`, поэтому сервер не может знать, был ли commit успешным.

V8+V9 интеграция должна сделать strict/fail-visible durable put и запрещать cache/reservation/client output при write failure.

## Codex shell-env safety

Fresh product probe blob `2f6d5873606975771b5ab418d5f9d45cd602304c` всё ещё передаёт полный `os.environ` в Codex и не задаёт `[shell_environment_policy]`. Обязательный кандидат остаётся: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY` и `RUNTIME_STATE_KEY`. Предыдущий local verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`; live Codex до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Materialize exact fresh `conversation_segments.py + server.py` fixture, наложить V8 store и V9 ordering/projection.
3. На настоящем server path прогнать same-turn retry/restart/distinct-turn/stale retry/tool/forced-write/stream-nonstream/size eviction; forced write обязан оставлять zero cache + zero reservation + zero identity-bearing response; provider call_count после successful durable replay = 1.
4. Проверить post-commit `responses_sse()` как deterministic projection canonical response. Если нужны pre-commit heartbeat, сначала проверить Codex fixture; иначе не посылать pre-commit events.
5. Встроить shell-environment policy в exact local Codex probe fixture и расширить contract test.
6. Product push не делать при ZERO-MINUTE. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
