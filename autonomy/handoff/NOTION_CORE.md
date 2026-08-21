# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `a78c9e1c881265a9f6df9919efc12038f79e795b`. От ранее записанного `a5792c1...` пришли 10 коммитов только в `payload/delegated_tool_loop.py`, `tools/materialize_agent_wiring.py` и их тесты; Core-стык `conversation_segments.py/server.py/turn_affinity.py/account_pool.py` не менялся. Не дублировать rotation, prompt modes, delegation или account/thread affinity.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` пока НЕ переключался:
- capsule `20260821T175055Z-bef4130f09`;
- archive SHA-256 `023f5542a5e693795e3d5b28d89ba8a848156603653ccb8639c2fc84f8295703`;
- archive size 17824 bytes, 6 parts;
- manifest blob `8ca3e2581bbd7a67800648f4945f2b1beefbfa92`;
- `LATEST.json` blob, запомненный в начале текущего запуска: `170db9da4c5e92e93a3905264b1de95ce45e4a8c`.

В этом запуске `LATEST` перечитан первым и родительский blob сохранён. Полный v4 restore/pack не объявлялся: connector по-прежнему не монтирует полученные GitHub bytes в filesystem контейнера, а неизвестные bytes вручную не реконструировались. Новый материал долговечно сохранён отдельными immutable evidence/patch файлами и этим handoff. При следующей среде, где connector-file можно материализовать локально, первым делом восстановить этот LATEST через exact v4 и только затем перепаковать.

Новый материал этого запуска:
- `autonomy/evidence/notion/20260821T2240Z_durable_replay_v18_stale_prefix_gate.patch`;
- `autonomy/evidence/notion/20260821T2240Z_durable_replay_v18_stale_prefix_evidence.json`.

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
3. `20260821T2042Z_durable_replay_v17_detached_get_fixup.patch`;
4. сохранить V14 durable tombstone для ответа >512 KiB;
5. `20260821T1848Z_durable_replay_v15_overlay.patch`;
6. `20260821T1948Z_durable_compaction_replay_v16_overlay.patch`;
7. `20260821T1955Z_durable_compaction_replay_v16_fixup.patch`;
8. **`20260821T2240Z_durable_replay_v18_stale_prefix_gate.patch`**.

### V17 — detached get

V12 spec требовал, чтобы `ConversationSegmentStore.get()` возвращал отделённую глубокую копию записи, но exact V12 candidate + V12 fixup этого фактически не сделали. V17 меняет возврат на `copy.deepcopy(item)`, чтобы изменение сервером precommit-объекта не повреждало in-memory durable preimage до строгой записи.

### V18 — старый retry после вытеснения SHA из bounded ring

V12 держит максимум `MAX_STALE_REPLAY_FINGERPRINTS = 32`. Локально воспроизведено: после 40 последовательных durable запросов SHA самого первого запроса уже отсутствует в stale-ring. Без дополнительного правила запоздалый точный retry такого старого запроса может попасть в `history_rewritten` и снова дойти до provider planning.

При этом существующие `input_fingerprints` дают более сильный content-free признак: внутри неизменного segment contract старый полный Responses input является строгим префиксом более нового durable input. V18 поэтому fail-closed блокирует более короткую входную историю, если она является строгим префиксом текущей durable истории и модель/контракт сегмента не менялись. Для обычного turn переход после compaction освобождён от этого правила, потому что Codex там законно может заменить историю более коротким compacted context. Для compaction старый strict-prefix всегда блокируется.

Локальный verdict: `DURABLE_REPLAY_V18_STALE_PREFIX_GATE_MODEL_PASS`:
- самый старый retry после выпадения из 32-entry ring — BLOCKED;
- нормальный appended new request — ALLOWED;
- changed tool/prompt contract — не ловится prefix-gate и остаётся существующей rollover-логике.

V18 не хранит новый пользовательский текст/ответы/аргументы: использует только уже существующие SHA-256 `input_fingerprints`.

### Общие инварианты V12/V14/V15/V16/V17/V18

Правильный порядок:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После успешной публикации exact retry/restart обязаны вернуть те же `response_id/item_id/call_id`, provider count остаётся 1. При durable failure до публикации: ноль TurnAffinity, ноль reservation, ноль клиентских IDs/result. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread. Stream/non-stream — проекции одного persisted canonical payload.

V15 дополнительно требует повторную `require_persistence_ready()` после `get()`, потому что cleanup внутри `get()` сам может обнаружить ошибку записи, и strict durable-before-ephemeral порядок для compaction.

V16 хранит точный `compact_payload` в том же durable replay transaction. Legacy exact compaction, для которого на диске уже есть lifecycle-state, но нет exact payload, fail-closed до provider.

V14 сохраняет content-free tombstone для exact oversized request, чтобы повтор после 413 не запускал provider второй раз.

V18 не позволяет очень старому append-history retry снова стать исполнимым только из-за вытеснения его SHA из bounded stale-ring.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. В среде с полноценным exact checkout собрать combined candidate: V12 -> V12 fixup -> V17 -> V14 -> V15 -> V16 -> V16 fixup -> V18.
3. Real-class offline tests: detached `get()` + strict rollback; same retry / restart / distinct turn / stale retry >32 historical requests / tool / final / forced NCM28 write / cleanup-write failure inside get / blocked retry / post-commit reservation failure / account removed / stream↔non-stream / TTL+size / oversize tombstone / compaction exact+restart+legacy retry / compaction write failure.
4. Assertions: normal replay provider count 1 + exact IDs; compaction provider count 1 + exact payload; any prepublication durable failure => zero ephemeral mutation/client result; stale/legacy ambiguous => fail closed before provider.
5. Совместить shell-env patch локально. Product push не делать при ZERO-MINUTE.
6. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
