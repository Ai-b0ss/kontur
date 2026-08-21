# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `ce610b78f38a6f33dbdc5d0b6a46a25bbae907d9`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T175055Z-bef4130f09`;
- archive SHA-256 `023f5542a5e693795e3d5b28d89ba8a848156603653ccb8639c2fc84f8295703`;
- archive size 17824 bytes;
- 6 parts: 4096/4096/4096/4096/4096/3288 chars;
- part Git blobs: `41fbdc7a93a30a602cfc19015dccafa126208800`, `c6e51cce300daa89b50138d965071f0217ddf557`, `5abc4719f572fb874130513c0ce19d4aa813c71e`, `e46b09478a01aeb050feb9ed27d351747fd6dfa9`, `fd9e9072ead6c56ad51d16b0f8a962caabf20d05`, `0c60cb027009211b061395e3d66aa45c31288d21`;
- manifest Git blob `8ca3e2581bbd7a67800648f4945f2b1beefbfa92`;
- `LATEST.json` Git blob `170db9da4c5e92e93a3905264b1de95ce45e4a8c`.

На старте этого запуска предыдущий `LATEST` `20260821T171838Z-f0922fe343` был материализован и восстановлен по точной логике `capsule_runtime_v4.py`: все части, archive SHA и workspace проверены. Перед публикацией нового указателя прежний `LATEST` был повторно прочитан на exact blob `0824aa1d8c84afe7dcd4b460352bd5ee5f531074`, сохранён как `PREVIOUS`, затем новый `LATEST` опубликован CAS и перечитан.

Новая capsule содержит текущий checkpoint, exact V12 store candidate и два локальных harness-а. Все шесть частей и manifest после публикации перечитаны, их Git blob SHA совпали с локально рассчитанными.

Новый долговечный материал:
- `autonomy/evidence/notion/20260821T1749Z_v12_exact_local_integration_evidence.json`;
- предыдущие V12 spec/store evidence остаются канонической историей.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) по-прежнему `pending`. Hosted Windows/CI в этом запуске не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V12 exact local integration

Fresh exact blobs PR #8:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Текущий product-сервер всё ещё имеет неверный аварийный порядок: reservation и memory-only TurnAffinity меняются до durable publication; `ConversationSegmentStore._save_locked()` глотает NCM28/OSError; final `response_id/item_id/call_id` создаются позже; completion-text cache регенерирует IDs; streaming создаёт `resp_*`/`rs_*` заранее.

В этом запуске V12 проверен на exact-source-shaped локальных классах.

`DURABLE_REPLAY_V12_EXACT_NCM_STORE_PASS`:
- outer state остаётся `version=2`, replay marker находится внутри записи;
- `get()` возвращает detached copy;
- exact canonical response переживает restart с теми же IDs;
- stream/non-stream имеют одну request identity;
- owner-mode ignored Codex instructions не влияют на identity;
- strict NCM write failure полностью откатывает память и переводит store в blocked;
- следующий strict retry можно остановить до provider;
- per-response cap 512 KiB сохранён.

`DURABLE_REPLAY_V12_EXACT_SERVER_LIFECYCLE_PASS`:
- exact retry и restart возвращают тот же canonical response при `provider call_count=1`;
- stream использует те же IDs;
- write failure оставляет zero TurnAffinity, zero reservation, zero client result;
- второй retry после blocked store останавливается до provider;
- post-commit reservation failure восстанавливается следующим retry без второго provider call;
- removed account across restart => fail closed, без ghost reservation и без молчаливой замены account/thread;
- persisted final response очищает stale reservation.

Обязательный порядок остаётся:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

### Новая streaming-граница

Текущий `stream_openai_responses()` не только выдаёт `resp_*`/`rs_*` до durable commit, но и передаёт клиенту **provider-derived thinking deltas** через `on_thinking_delta_async` ещё до завершения `handle_openai_responses`.

Для crash-safe deterministic replay этого недостаточно исправить только ID. Provider-derived reasoning тоже нельзя публиковать до durable commit: его нужно буферизовать до commit либо включить в один канонический persisted response. До commit допустимы только нейтральные identity-free heartbeat/comment данные. После commit JSON и SSE должны быть детерминированными проекциями одного сохранённого payload.

Это зафиксировано в `20260821T1749Z_v12_exact_local_integration_evidence.json`.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: во временный Codex config добавить `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Локальный verdict ранее: `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Превратить exact локальный V12 candidate в apply-ready diff для реальных `payload/conversation_segments.py + payload/server.py`, не меняя NOTION_AGENT policy.
3. В server patch обязательно: replay lookup до completion-text cache/provider, one canonical payload before side effects, strict observable durable commit, post-commit TurnAffinity, current-account validation/rehydration, deterministic stream projection и буферизация provider thinking до commit.
4. Локально на exact source прогнать: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / blocked retry / post-commit reservation failure / account removed / stream↔non-stream / TTL+size / provider-thinking precommit buffer. После successful durable replay `provider call_count=1`; при write failure zero cache, zero reservation, zero identity-bearing/provider-derived client output.
5. Затем совместить уже готовый shell-env patch локально. Product push не делать при ZERO-MINUTE.
6. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
