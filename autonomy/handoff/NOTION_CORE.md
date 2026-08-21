# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head `1af495a6c1ae6406b5fe9d7e18699e81a1b29500`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T104749Z-a683d83179`;
- archive SHA-256 `083888cb89c46cc26b3c632d094c1b1941b5a102865b542cd22d61353d15e97f`;
- 4 parts: 2048/2048/2048/1016 chars;
- manifest Git blob `655a2dea80ecad887cdb3d377dc888dfd81f402d`;
- part blobs: `bfad929c186ae7bceb1a8048c7a7085f70a38952`, `7b487bb921efbaad0ac4508d03511d731fdb3b33`, `08971f1b9ce274db1cc5ee318414b67f43a74e80`, `e82a19ac38529ddcf2bedc20844f34b649524725`;
- `LATEST.json` Git blob `d66e28d52257fe5026a97893e513cf85416b7edd`.

Все parts перечитаны после публикации и совпали с локальными Git blob SHA. Manifest сначала был опубликован с другим форматированием; обязательная byte-проверка это поймала, manifest был заменён exact local bytes и повторно прочитан с ожидаемым blob `655a2d...`. Старый `LATEST` `20260821T095818Z-2a04c03b2d` сохранён как `PREVIOUS`; переключение `LATEST` выполнено CAS с exact parent blob `4fe1fe0d71a39d491403ed65e70c073ef4c8986c`.

Капсула содержит checkpoint, V8 patch для `conversation_segments.py` и два локальных regression harness.

Долговечное evidence: `autonomy/evidence/notion/20260821T1047Z_durable_replay_v8_exact_store.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В свежей read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout.

Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8 exact-store candidate

Fresh PR #8 exact blobs на прочитанной границе:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`.

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

Новый важный дефект, найденный при self-review: **shallow rollback недостаточен**. Cleanup/TTL/8MiB eviction мутирует существующие `ConversationSegment` objects. Если затем NCM28 write падает, `dict(self._items)` не восстанавливает их старое содержимое. Tested candidate использует `copy.deepcopy(self._items)` перед strict durable batch; альтернатива — полностью non-mutating candidate state.

Пределы кандидата: replay TTL 6h, 512 KiB per response, 8 MiB total, 32 stale fingerprints.

## Server ordering — ещё не продуктовый PASS

Fresh server по-прежнему сначала делает foreground reservation, затем memory-only `TurnAffinityStore`, затем `conversation_segments.put`, а canonical `response_id/item_id/call_id` создаёт уже после этого. Streaming выдаёт `response.created` до durable commit. Это противоречит V8.

Следующий exact server порядок:
1. provider completion/correction;
2. один canonical Responses payload со всеми IDs;
3. strict NCM28 publication progress + rendered replay;
4. только после успеха memory-only TurnAffinityStore;
5. только после успеха reserve/clear foreground account;
6. только после успеха identity-bearing HTTP/SSE.

До durable publication streaming может использовать только identity-free heartbeat. Codex compatibility таких ранних comments/heartbeat пока `UNPROVEN`.

## Codex shell-env safety

Fresh product probe всё ещё должен получить подготовленную policy:
`inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY` и `RUNTIME_STATE_KEY`. Предыдущий local verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`; live Codex до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Встроить exact V8 store candidate в локальный свежий server fixture и изменить ordering `render -> durable put -> affinity -> reservation -> client`.
3. На настоящем server path прогнать same-turn retry/restart/distinct-turn/stale retry/tool/forced-write/stream-nonstream/size eviction; forced write обязан оставлять zero cache + zero reservation + zero tool response.
4. Отдельно проверить identity-free pre-commit SSE shape против доступного Codex fixture; если текущий Codex не принимает comments, не посылать pre-commit events вообще.
5. Встроить shell-environment policy в exact local Codex probe fixture.
6. Product push не делать при ZERO-MINUTE. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
