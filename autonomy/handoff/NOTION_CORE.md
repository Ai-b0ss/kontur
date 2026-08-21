# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `a5792c1a15027a5f58890a679df738084514e6d1`. От ранее записанного `7742691c...` пришли только изменения `tools/materialize_agent_wiring.py` и его теста; Core-стык `conversation_segments.py/server.py/turn_affinity.py/account_pool.py` не менялся. Не дублировать rotation, prompt modes, delegation или account/thread affinity.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` пока НЕ переключался:
- capsule `20260821T175055Z-bef4130f09`;
- archive SHA-256 `023f5542a5e693795e3d5b28d89ba8a848156603653ccb8639c2fc84f8295703`;
- archive size 17824 bytes, 6 parts;
- manifest blob `8ca3e2581bbd7a67800648f4945f2b1beefbfa92`;
- `LATEST.json` blob, запомненный в начале текущего запуска: `170db9da4c5e92e93a3905264b1de95ce45e4a8c`.

В текущем запуске заново прочитаны `LATEST`, manifest и все 6 immutable parts. Connector отдаёт их как текст ответа, но не монтирует байты в filesystem контейнера; DNS контейнера к GitHub закрыт. Поэтому точный обязательный `capsule_runtime_v4.py restore -> checkpoint -> pack -> readback -> CAS` цикл нельзя было честно завершить без ручной реконструкции байтов из tool-output. Неизвестные bytes не реконструировать. Новый материал долговечно сохранён отдельными immutable evidence/patch файлами и этим handoff. При следующей среде, где connector-file можно материализовать локально, первым делом восстановить этот LATEST через exact v4 и только затем перепаковать.

Новый материал этого запуска:
- `autonomy/evidence/notion/20260821T2042Z_durable_replay_v17_detached_get_fixup.patch`;
- `autonomy/evidence/notion/20260821T2042Z_durable_replay_v17_detached_get_evidence.json`.

## NCM28 / Windows

Существующий digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) всё ещё `pending`. Hosted Windows/CI в текущем запуске не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и полный NCM28 gate. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не доказана.

## Durable Responses replay — объединённый кандидат

Fresh exact blobs PR #8 остаются:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Текущий product-сервер всё ещё имеет неверный аварийный порядок: reservation и memory-only TurnAffinity меняются до durable publication; `ConversationSegmentStore._save_locked()` глотает NCM28/OSError; final `response_id/item_id/call_id` создаются позже; completion-text cache регенерирует IDs; streaming заранее создаёт IDs и выдаёт provider-derived данные.

Обязательная последовательность патчей теперь:
1. `20260821T1640Z_durable_replay_v12_exact_candidate.patch`;
2. `20260821T1705Z_durable_replay_v12_candidate_fixup.patch`;
3. **`20260821T2042Z_durable_replay_v17_detached_get_fixup.patch`**;
4. сохранить V14 durable tombstone для ответа >512 KiB;
5. `20260821T1848Z_durable_replay_v15_overlay.patch`;
6. `20260821T1948Z_durable_compaction_replay_v16_overlay.patch`;
7. `20260821T1955Z_durable_compaction_replay_v16_fixup.patch`.

### V17 — найденный дефект кандидата V12

V12 spec уже требовал, чтобы `ConversationSegmentStore.get()` возвращал отделённую глубокую копию записи. Но exact V12 candidate + V12 fixup этого фактически не сделали: `get()` продолжал возвращать `self._items[...]` напрямую.

Локально воспроизведено на точной семантике blob `553bd349...`: изменение поля у объекта, возвращённого `get()`, сразу меняет внутреннюю `_items` до strict durable publication. Значит при последующем NCM28 write failure in-memory preimage уже повреждён и обещанный rollback ослаблен.

V17 fix: после cleanup брать `item = self._items.get(...)` и возвращать `copy.deepcopy(item)` либо `None`. Локальные verdicts:
- baseline: `LIVE_OBJECT_ALIAS_REPRODUCED`;
- после fixup: `DETACHED_GET_FIXUP_PASS`.

Это Core-only исправление; rotation/failover политики PR #8 не меняет.

### Общие инварианты V12/V14/V15/V16/V17

Правильный порядок:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После успешной публикации exact retry/restart обязаны вернуть те же `response_id/item_id/call_id`, provider count остаётся 1. При durable failure до публикации: ноль TurnAffinity, ноль reservation, ноль клиентских IDs/result. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread. Stream/non-stream — проекции одного persisted canonical payload.

V15 дополнительно требует повторную `require_persistence_ready()` после `get()`, потому что cleanup внутри `get()` сам может обнаружить ошибку записи, и strict durable-before-ephemeral порядок для compaction.

V16 хранит точный `compact_payload` в том же durable replay transaction. Legacy exact compaction, для которого на диске уже есть lifecycle-state, но нет exact payload, fail-closed до provider.

V14 сохраняет content-free tombstone для exact oversized request, чтобы повтор после 413 не запускал provider второй раз.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. В среде с полноценным exact checkout собрать combined candidate: V12 -> V12 fixup -> V17 -> V14 -> V15 -> V16 -> V16 fixup.
3. Real-class offline tests: detached `get()` + strict rollback; same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / cleanup-write failure inside get / blocked retry / post-commit reservation failure / account removed / stream↔non-stream / TTL+size / oversize tombstone / compaction exact+restart+legacy retry / compaction write failure.
4. Assertions: normal replay provider count 1 + exact IDs; compaction provider count 1 + exact payload; any prepublication durable failure => zero ephemeral mutation/client result; stale/legacy ambiguous => fail closed before provider.
5. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
6. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
