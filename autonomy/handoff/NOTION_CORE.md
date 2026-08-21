# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh read-only head `7742691ca681b13b92d6ca59fb190d89883346d8`. С предыдущей границы `bca2bd16...` пришли два commit и они меняют только `payload/reservation_aware_lease.py` и `tests/test_reservation_aware_lease.py`; нужные Core-стыку `conversation_segments.py/server.py/turn_affinity.py/account_pool.py` не изменились. Не дублировать rotation, prompt modes, delegation или account/thread affinity.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST` остаётся без переключения:
- capsule `20260821T175055Z-bef4130f09`;
- archive SHA-256 `023f5542a5e693795e3d5b28d89ba8a848156603653ccb8639c2fc84f8295703`;
- archive size 17824 bytes;
- 6 parts;
- manifest Git blob `8ca3e2581bbd7a67800648f4945f2b1beefbfa92`;
- `LATEST.json` Git blob `170db9da4c5e92e93a3905264b1de95ce45e4a8c`.

В этом запуске `LATEST`, manifest и все шесть immutable parts были снова прочитаны из GitHub и сверены с manifest-метаданными. Контейнер по-прежнему не имеет DNS к GitHub, а connector-ответы не монтируются как локальные файлы, поэтому обязательный exact `capsule_runtime_v4.py restore -> pack` цикл безопасно выполнить не удалось. Неизвестные bytes не реконструировались и `LATEST` не подменялся. Новая работа долговечно сохранена отдельными evidence/patch файлами и этим handoff.

Новый материал:
- `autonomy/evidence/notion/20260821T1948Z_durable_compaction_replay_v16_evidence.json`;
- `autonomy/evidence/notion/20260821T1948Z_durable_compaction_replay_v16_overlay.patch`;
- `autonomy/evidence/notion/20260821T1955Z_durable_compaction_replay_v16_self_review.json`;
- `autonomy/evidence/notion/20260821T1955Z_durable_compaction_replay_v16_fixup.patch`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Fresh read-only status: все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) по-прежнему `pending`. Hosted Windows/CI в этом запуске не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V12/V14 + V15 + V16

Fresh exact blobs PR #8 остаются:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Текущий product-сервер всё ещё имеет неверный аварийный порядок: reservation и memory-only TurnAffinity меняются до durable publication; `ConversationSegmentStore._save_locked()` глотает NCM28/OSError; final `response_id/item_id/call_id` создаются позже; completion-text cache регенерирует IDs; streaming создаёт `resp_*`/`rs_*` и передаёт provider-derived thinking заранее.

База кандидата:
- `20260821T1640Z_durable_replay_v12_exact_candidate.patch`;
- затем обязательно `20260821T1705Z_durable_replay_v12_candidate_fixup.patch`;
- сохранить V14 требование durable tombstone для ответа >512 KiB, чтобы exact retry после 413 не делал второй provider call;
- затем `20260821T1848Z_durable_replay_v15_overlay.patch`;
- затем `20260821T1948Z_durable_compaction_replay_v16_overlay.patch`;
- затем обязательно `20260821T1955Z_durable_compaction_replay_v16_fixup.patch`.

### Уже доказанная V12/V14 граница

Обязательный порядок:
`provider result -> один canonical Responses payload со всеми IDs -> strict atomic durable publication(progress + exact payload) -> memory TurnAffinity -> validate/re-hydrate reservation -> JSON/SSE projection`.

После successful durable replay: exact retry/restart должны возвращать те же `response_id/item_id/call_id`, `provider call_count=1`. При strict write failure: zero cache, zero reservation, zero identity-bearing/provider-derived client output. Removed persisted tool-owner account => clear ghost reservation + fail closed, без молчаливой подмены account/thread. Stream/non-stream — проекции одного persisted canonical payload.

### V15 — post-get blocked-store gate

V12 делает `require_persistence_ready()` до `ConversationSegmentStore.get()`. Но `get()` запускает cleanup, а cleanup сам может попытаться записать NCM28 state и на ошибке поставить `persistence_blocked=True`. Значит первоначальная проверка может быть зелёной, затем `get()` блокирует persistence, а сервер всё равно идёт к provider.

Fix: после `segment = await conversation_segments.get(conversation_key)` ещё раз вызвать `require_persistence_ready()` до любого provider planning. При blocked store вернуть 503.

### V15 — compaction durable ordering

`handle_openai_compaction()` в product-коде сначала пишет `TurnAffinity`, затем legacy non-strict `conversation_segments.put()`. V15 переставляет это на strict durable state -> TurnAffinity -> client result и переводит write failure в 503.

### V16 — новый blocking gap: exact compaction result не хранится долговечно

V15 закрывает порядок compaction lifecycle, но сохраняет только `awaiting_compacted_history=True`, thread/account/input metadata. Сам `compact_payload(completion.text, turn_key)`, который должен получить Codex, остаётся вне durable transaction.

Crash window: provider уже выдал `summary-1` -> strict durable lifecycle publication успешна -> процесс падает до ответа Codex. После restart memory TurnAffinity пуст. Exact retry не имеет сохранённого compact payload и снова вызывает provider, получая `summary-2`. Локальная модель воспроизвела `provider calls=2`.

V16 использует уже существующий V12 replay slot: fingerprint `durable_replay_fingerprint(body, turn_key, "compaction")`, canonical `compact_payload` формируется до strict put и публикуется вместе с lifecycle state. После crash exact retry возвращает тот же payload, provider count остаётся 1. Новый `turn_id` с тем же input считается новой работой.

Self-review поймал V16-SR-1: pre-replay-schema segment может уже иметь `awaiting_compacted_history=true` и точные `input_fingerprints`, но не иметь exact compact payload. Такой exact legacy retry нельзя повторно планировать: fixup возвращает `restart_replay_unavailable`; appended/new history может идти дальше и обновить schema.

Локальные verdicts:
- `DURABLE_COMPACTION_REPLAY_V16_GAP_REPRODUCED`;
- `DURABLE_COMPACTION_REPLAY_V16_MODEL_PASS`;
- `DURABLE_COMPACTION_REPLAY_V16_SR1_LEGACY_AMBIGUITY_REPRODUCED`.

## Codex shell-env safety

Готовый exact-source candidate остаётся обязательным: во временный Codex config добавить `[shell_environment_policy]`, `inherit="core"`, `ignore_default_excludes=false`, `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`. Bridge key остаётся доступен самому Codex через `env_key`, но не его локальным shell-командам. Живой Codex/Notion до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Материализовать полный exact PR #8 source локально и собрать один combined candidate: V12 exact + SR fixup + V14 oversize tombstone + V15 + V16 + V16 fixup.
3. Прогнать real-class offline tests: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / cleanup-write failure inside get / blocked retry / post-commit reservation failure / account removed / stream↔non-stream / TTL+size / oversize tombstone / compaction exact retry / compaction restart retry / legacy compaction exact retry / compaction write failure.
4. Отдельные обязательные assertions: successful normal replay => provider count 1 и exact IDs; successful compaction replay => provider count 1 и exact compact payload; any durable failure before publication => zero TurnAffinity, zero reservation, zero client IDs/result; stale/legacy ambiguous request => fail closed before provider.
5. Совместить уже готовый shell-env patch локально. Product push не делать при ZERO-MINUTE.
6. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
