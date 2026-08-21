# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 18:58 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `d605db5d8f8411f9054ffabf258616d5b9e0132d`.
- Notion PR #8: `bca2bd16d5dcbf4d4dfa6638f5e914807617ec2f`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — exact session/restart cluster после сохранения system-инструкций;
- Qwen Reliability — post-fsync cleanup/persistence boundaries;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay ordering + native Windows gate.

## Новый блок — историческая управляющая команда может выполниться повторно

Fresh exact Qwen `src/command-handler.js` blob `85f8586a37b4308e52cf138043d174030e52b090`.

`isCommandMessage(messages)` ищет последний `role=user` по всей истории, а не требует, чтобы последним сообщением запроса была именно пользовательская управляющая команда. Поэтому transcript вида:

`user: $qwen-api reset -> assistant: reset complete -> tool: ...`

по текущей логике снова классифицируется как команда. То же происходит для исторического `$qwen-api account remove ...` с последующим assistant-сообщением. Это создаёт отдельный replay-path для изменяющих локальное состояние команд и может перехватить OpenAI-compatible tool-result continuation до обычного session/tool маршрута.

Детерминированный offline probe:
`QWEN_HISTORICAL_COMMAND_REPLAY_REPRODUCED`.

Минимальный контракт: управляющая команда исполняется только если **последнее сообщение всего запроса** имеет `role=user` и само содержит `$qwen-api`/`/qwen-api`. Исторические команды внутри transcript должны быть инертными данными. Это дополняет, а не заменяет ранее найденный command/reset gate: state-mutating command всё равно должна проходить через соответствующую сериализацию.

Artifacts:
- `autonomy/v3/tools/integration_qwen_command_tail_replay_probe.py`;
- `autonomy/evidence/integration/20260821T1855Z_qwen_historical_command_replay.json`.

Продуктовый `src/command-handler.js` не переписывался, чтобы не конфликтовать с активным PR #6.

## Предыдущий блок V2 — store-wide recovery может fail-open

Fresh exact source Qwen:
- `src/session-store.js` blob `d13f79a1c999ca5221cac190ad7b155f4854ae9b`;
- `server.js` blob `44d04725f7b1445f61c0f2da17007d1da8f0895f`;
- `src/session-request-gate.js` blob `8bab117664096ed863b28b9de6815322a9f922c7`.

Если stale backup не содержит более новую session-X либо primary+backup оба нечитаемы, неизвестный потенциально старый session id не должен выглядеть свежим. Канонический V2-кандидат остаётся:
- `autonomy/v3/tools/integration_qwen_session_store_total_recovery_probe.js`;
- `autonomy/evidence/integration/20260821T1700Z_qwen_session_store_total_recovery_gap.json`;
- `autonomy/v3/candidates/QWEN_SESSION_STORE_TOTAL_RECOVERY_FAIL_CLOSED_V2_20260821.patch`.

Первый узкий stale-backup candidate superseded V2. Не повторять без изменения продукта.

## Предыдущие helper-блоки — не повторять

Уже зафиксированы: truncated partial tool result стирает unresolved sibling obligation; truncated transcript ломает full-history failover rebase; durable pending obligation bypass; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer terminal downgrade; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state after restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; successful empty Qwen text; pending-tool continuation content-shape; same-session concurrent continue; command/reset gate; command content-shape; implicit-session collision; store-wide recovery fail-closed.

## Постоянная память

На старте этого запуска `LATEST.json` Git blob `6f93e4390f8518146a2d018953a018c3a618b062`, capsule `20260821T144628Z-e703b2256c`, archive SHA-256 `31ba53852b5a99d8d469ebdb36fa9c59812b16db01a91f6170467389f1a650ba`.

Предыдущий запуск уже установил, что попытка новой capsule `20260821T165029Z-067f157ecc` дала exact-byte mismatch на readback части и потому является только immutable orphan evidence. `LATEST` намеренно не переключался.

В этом запуске новый finding, probe, evidence и handoff долговечно записаны обычными GitHub-файлами. Новую v4 capsule пока не публиковать без полного exact-byte upload/readback/CAS цикла; старый проверенный `LATEST` остаётся recovery floor.

## Следующее

1. Владелец Qwen-линии может забрать tail-position regression рядом с `isCommandMessage()`; фикс локальный и не требует provider traffic.
2. После исправления обязательны случаи: command-only => command; historical command + assistant/tool tail => normal route; historical command + new normal user => normal route.
3. Integration Helper следующий запуск выбирает новый недублирующийся стык; этот finding повторно не исследовать без изменения продукта.
4. Для следующей v4 capsule использовать новый immutable capsule id и только exact-byte транспорт; orphan `20260821T165029Z-067f157ecc` не исправлять.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
