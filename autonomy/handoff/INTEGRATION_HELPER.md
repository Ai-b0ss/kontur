# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 13:46 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `861a8f176a6037acaec5721b2f6bbad3041d7dd9`.
- Notion PR #8: `1b4f9eb195f1fc2aadf6344a5e0b55ef7588201e`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — stale-backup recovery / `QWEN_SESSION_RECOVERY_UNCERTAIN`, затем внешний HTTP-контракт этой ошибки;
- Qwen Reliability — локальная подготовка запроса и post-success persistence не должны ошибочно считаться provider failure;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay V8/V9/V10 + Windows rollback/native gate.

Предыдущий Integration Helper блок `QWEN_SAME_SESSION_CONCURRENT_CONTINUE_RACE` уже закрыт Qwen Core через `SessionRequestGate`. Предыдущие helper findings про command/reset gate и command content-shape остаются отдельными кандидатами и в этом запуске не дублировались.

## Новый стыковой дефект — durable pending tool-call можно обойти обычной фразой или неполной явной историей

Fresh Qwen `server.js` blob `b6131886a6ff739eb35765982d778632e25ab689` по-прежнему вычисляет `pendingToolCalls` только когда `isContinuationTurn` совпал с маленьким набором слов (`continue`, `давай`, `proceed` и т.п.). Fresh `session-store.js` blob `d13f79a1c999ca5221cac190ad7b155f4854ae9b` при этом правильно хранит принятые незавершённые tool-calls и умеет долговечно фиксировать matching tool results.

Из этого есть два разных bypass:

1. После restart durable history содержит уже принятый `write_file`, но результата инструмента ещё нет. Пользователь пишет обычную длинную фразу вроде `please keep working on the file and finish the task`. `restoreCheckpoint()` возвращает историю с pending `call-write-2`, однако `isContinuationTurn=false`, поэтому сервер ставит `pendingToolCalls=[]` и идёт к Qwen.
2. Клиент присылает явную multi-message историю той же session, но по ошибке/устаревшему snapshot не включает принятый pending assistant call. Для >1 non-system message текущий `restoreCheckpoint()` возвращает caller messages. В `restoredMessages` pending уже не видно, хотя durable record всё ещё содержит `call-write-2`. Значит простого изменения «проверять pending всегда в restoredMessages» тоже недостаточно.

Риск: Qwen продолжит планирование без авторитетного результата уже принятого изменяющего действия и может повторить/заменить запись или построить новый шаг поверх неизвестного состояния.

### Проверка

Детерминированный офлайн-probe прошёл:

`QWEN_PENDING_TOOL_DURABLE_OBLIGATION_REPRO_PASS`

Он проверяет:
- ordinary non-short turn: current `providerWouldRun=true`, durable pending остаётся;
- explicit multi-message transcript omission: `restoredPending=[]`, durable pending=`[call-write-2]`;
- кандидатный durable-state boundary блокирует оба случая;
- после matching tool result, уже долговечно присутствующего в record, provider work снова разрешён.

Artifacts:
- `autonomy/v3/tools/integration_qwen_pending_tool_durable_obligation_probe.js`;
- `autonomy/evidence/integration/20260821T1336Z_qwen_pending_tool_durable_obligation_gap.json`;
- `autonomy/v3/candidates/QWEN_PENDING_TOOL_DURABLE_OBLIGATION_GUARD_20260821.patch`.

### Минимальный продуктовый контракт

После `restoreCheckpoint()` сервер должен заново прочитать session record, потому что matching incoming tool result мог быть долговечно записан именно внутри restore. Затем перед любым provider call:

- если durable record всё ещё содержит pending accepted tool-call — `409 QWEN_PENDING_TOOL_RESULT` независимо от текста следующего user turn;
- дополнительно проверить `restoredMessages`, чтобы caller-provided unresolved assistant call тоже не прошёл;
- только matching durable tool result, explicit reset или новая session снимают обязательство;
- никакого account cooldown/failover accounting здесь не менять.

Это естественный кусок для Qwen Core после текущего stale-backup блока, а не для Qwen Reliability.

## Ранее открытые интеграционные блоки — не дублировать

Уже зафиксированы: duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape; same-session concurrent continue; command/reset gate; command content-shape.

## Постоянная память

На старте прочитан `LATEST.json` blob `38fc6f534d78db1d9576827acb12755d50573376`, capsule `20260821T124500Z-62bd5739b4`, archive SHA-256 `3d030cd0bf4780a006e7d4c6ab85808f8e31166a536c49e25a00c56ab2109ce2`. Manifest и все пять parts прочитаны отдельно. Для полезной продуктовой работы использован fresh exact-source floor; никаких неизвестных байтов из памяти не реконструировалось.

После работы локальный v4-compatible `pack -> verify -> restore` собрал новую capsule `20260821T134425Z-167e1f9523`, archive SHA-256 `d0617b7ad8718c89073ef5022d8d8af7b24e0c00fd0175fc7ad63e33dccac429`, размер 4460 байт, 3 части `2048/2048/1852` символа. Все загруженные parts и manifest перечитаны; Git blob SHA совпали с локальными: `19f4722e...`, `12197324...`, `7a54a05f...`, manifest `73606589...`.

Непосредственно перед публикацией `LATEST` всё ещё имел исходный blob `38fc6f53...`, поэтому старый указатель сохранён в `PREVIOUS`, а новый `LATEST` опубликован CAS-обновлением ровно от этого parent SHA. Новый `LATEST` blob `835010da75007e1c05388ab6ff6bb0723f0b6f78`. Force-write не использовался.

## Следующее

1. Qwen Core после текущего stale-backup блока забирает durable pending-obligation regression/patch и добавляет product-level provider-call-count=0 для обоих bypass.
2. Integration Helper на следующем запуске ищет следующий недублирующийся стык; приоритет — pending obligation × account/thread failover/retry или Notion lifecycle/rebind × durable replay.
3. Hosted CI, live provider и native Windows не использовать.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
