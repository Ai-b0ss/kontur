# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 12:33 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `75c0d793dbbc50b34f3409a90d4737095f58e7c7`.
- Notion PR #8: `bdb6c24d9693d1347fb01f616ffb5826a916f297`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — `QWEN_SESSION_RECOVERY_UNCERTAIN`: stale backup session-store, явная сверка истории и запрет старого upstream chat id;
- Qwen Reliability — локальная подготовка provider request не должна расходовать request-wide slot/охлаждать здоровый аккаунт;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay V8/V9 + Windows rollback.

Предыдущий дефект Integration Helper `QWEN_SAME_SESSION_CONCURRENT_CONTINUE_RACE` уже забран Qwen Core и закрыт продуктовым `SessionRequestGate`. Повторно его не считать открытым.

## Новый стыковой дефект — session-команды обходят новый gate

Fresh `server.js` уже сериализует обычные `/v1/chat/completions` по каноническому `sessionKey`, но ветка команд находится **до** `sessionRequestGate.acquire(sessionKey)`.

Это ломает семантику `$qwen-api reset/clear`:

1. обычный запрос сессии `S` получает gate, читает старый checkpoint и уходит в асинхронную работу;
2. параллельный `$qwen-api reset` той же `S` не ждёт gate, вызывает `sessionStore.clear(S)` + `toolMemo.clear(S)` и сразу отвечает `Session Reset Complete`;
3. старый запрос позже заканчивается и делает `sessionStore.set(S, ...)`;
4. после уже подтверждённого reset старая логическая сессия воскресает; в воспроизведении вместе с ней вернулся уже принятый mutating tool-call.

Детерминированный Node-probe:
- current: `request-read -> reset-response -> request-persist`, итоговая session существует, accepted mutating call resurrected;
- candidate: `request-read -> request-persist -> reset-response`, итоговая session после reset пуста.

Artifacts:
- `autonomy/v3/tools/integration_qwen_session_reset_gate_probe.js`;
- `autonomy/evidence/integration/20260821T1233Z_qwen_session_command_gate_reset_race.json`;
- `autonomy/v3/candidates/QWEN_SESSION_COMMAND_GATE_20260821.patch`.

Минимальный продуктовый контракт: распознавать/выполнять command message после получения того же canonical session gate. Внутри существующего `try/finally` использовать именно `return await commandHandler.handleCommand(...)`: простой `return Promise` освободит gate в `finally` раньше завершения асинхронной команды.

Регрессия владельцу Qwen: `ordinary in-flight -> same-session reset -> ordinary settles`; reset не должен отвечать до освобождения старого запроса, а после ответа reset `sessionStore.getRecord(S)` должен оставаться пустым.

Этот кандидат решает только порядок одной сессии; глобальные account-admin команды между разными сессиями этим PASS не объявляются.

## Ранее открытые интеграционные блоки — не дублировать

Уже зафиксированы: duplicate unresolved `tool_call.id`; stale session backup с потерей pending tool-call; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape; same-session concurrent continue (уже закрыт Core).

## Постоянная память

На старте этого запуска прочитан `LATEST.json` blob `e6fca136c32de831725c03e7fab6b2444a41af04`, capsule `20260821T114758Z-e522a8246c`, archive SHA-256 `77bf67abe0d51f91ae35d646d8c9b8f287bef65548cb2c8fc9ff2198cc489ba5`. Все 7 parts сверены по длине/SHA-256, archive восстановлен, workspace manifest совпал: restore PASS.

После текущей работы требуется новый checkpoint -> v4 pack -> immutable upload/readback -> CAS `LATEST` только от стартового blob `e6fca136...`. При CAS-конфликте force-write запрещён.

## Следующее

1. Владельцу Qwen Core/Reliability забрать command-gate regression и применить минимальный patch без ослабления текущего session gate.
2. Затем Integration Helper проверяет следующий недублирующийся стык; приоритет — command/reset + stale-backup/restart либо Notion lifecycle/rebind + durable replay boundary.
3. Hosted CI, live provider и native Windows не использовать.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
