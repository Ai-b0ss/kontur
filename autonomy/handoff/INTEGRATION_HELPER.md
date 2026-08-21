# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 19:45 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `5c8fc5299f77a1c3502082da8827b6d3f20e7592`.
- Notion PR #8: `7742691ca681b13b92d6ca59fb190d89883346d8`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — большой owner system prompt и точность checkpoint/restart;
- Qwen Reliability — post-fsync cleanup `session-store` и durable persistence boundaries;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay ordering + native Windows gate.

## Новый блок 1 — session-store теряет изменения другого процесса

Fresh exact Qwen `src/session-store.js` blob `4390c00ab7b2c5ac5267b930cf895c6acc3c82ad`.

Модуль делает `load()` при импорте и держит весь `sessions` в process-local `Map`. `commitMutation()` клонирует именно этот локальный снимок, а `persist()` целиком заменяет `opencode-sessions.json`.

Если во время рестарта старый и новый процесс короткое время перекрываются, два процесса могут прочитать один старый файл, затем изменить разные session keys и записать whole-store snapshots по очереди. Последний writer стирает более свежее изменение первого.

Детерминированный two-process probe это воспроизвёл:
- current: `call-A` исчез, `call-B` остался;
- candidate store-wide interprocess transaction + reread inside lock: `call-A` и `call-B` сохранились оба.

Это опасно для restart/tool safety: потерянная запись может быть уже принятым pending mutating tool-call, после чего следующий процесс перестанет видеть обязанность дождаться tool result.

Artifacts:
- `autonomy/v3/tools/integration_qwen_session_store_cross_process_lost_update_probe.js`;
- `autonomy/evidence/integration/20260821T1940Z_qwen_session_store_cross_process_lost_update.json`.

Это НЕ текущий Reliability post-fsync cleanup: там новый durable primary может откатиться из-за cleanup-only ошибки; здесь stale процесс затирает whole store другого процесса.

## Новый блок 2 — SessionRequestGate защищает только один процесс

Fresh exact source:
- `server.js` blob `44d04725f7b1445f61c0f2da17007d1da8f0895f`;
- `src/session-request-gate.js` blob `8bab117664096ed863b28b9de6815322a9f922c7`;
- `src/session-store.js` blob `4390c00ab7b2c5ac5267b930cf895c6acc3c82ad`.

Текущий `SessionRequestGate` — обычный объект в памяти одного Node-процесса. Он уже закрывает старый same-process concurrent-continue дефект, но не защищает перекрытие двух server generations во время restart.

Two-process probe:
- current process-local gates: оба процесса прочитали `pending=false` и оба дошли до provider, `provider_calls=2`;
- candidate process-shared per-session lease: `provider_calls=1`; второй процесс после получения lease перечитал durable state и увидел pending.

Значит для explicit stateful session одна только JS-сериализация недостаточна. Межпроцессная lease должна браться ДО чтения `sessionStore` и удерживаться через provider turn, durable checkpoint принятого ответа/tool-call и client-visible release. Другие session keys должны оставаться параллельными.

Artifacts:
- `autonomy/v3/tools/integration_qwen_cross_process_session_gate_probe.js`;
- `autonomy/evidence/integration/20260821T1942Z_qwen_cross_process_session_gate_restart_gap.json`;
- общий кандидат-контракт `autonomy/v3/candidates/QWEN_CROSS_PROCESS_SESSION_TRANSACTION_CONTRACT_20260821.patch`.

Продуктовые файлы PR #6 намеренно не переписывались.

## Предыдущий блок — historical command replay

Остаётся действующим: `isCommandMessage(messages)` не должен повторно исполнять старую `$qwen-api ...` команду из transcript, если последним сообщением запроса уже является assistant/tool/normal user. Artifacts:
- `autonomy/v3/tools/integration_qwen_command_tail_replay_probe.py`;
- `autonomy/evidence/integration/20260821T1855Z_qwen_historical_command_replay.json`.

## Предыдущие helper-блоки — не повторять

Уже зафиксированы: truncated partial tool result стирает unresolved sibling obligation; truncated transcript ломает full-history failover rebase; durable pending obligation bypass; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; subagent-batch store-wide lost update; stale-writer terminal downgrade; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state after restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; successful empty Qwen text; pending-tool continuation content-shape; same-process concurrent continue; command/reset gate; command content-shape; implicit-session collision; store-wide recovery fail-closed; historical command replay.

Новые два блока этого запуска относятся именно к основному OpenCode `session-store` и process-overlap restart boundary; не путать их со старым `subagent-batch-store`.

## Постоянная память

На старте прочитан и нормативно восстановлен текущий проверенный `LATEST`:
- Git blob `6f93e4390f8518146a2d018953a018c3a618b062`;
- capsule `20260821T144628Z-e703b2256c`;
- archive SHA-256 `31ba53852b5a99d8d469ebdb36fa9c59812b16db01a91f6170467389f1a650ba`.

Exact `capsule_runtime_v4.py` был материализован с Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; manifest/5 parts собраны из GitHub, `verify=PASS`, `restore=PASS`.

В workspace записаны новые probes/evidence/candidate/checkpoint. Перед публикацией новой capsule обязательно выполнить полный `pack -> immutable upload -> readback byte verify -> CAS LATEST`; force-write запрещён.

## Следующее

1. Владелец Qwen-линии должен рассматривать оба новых процесса как один restart-safety блок: store-wide transaction + per-session process-shared admission lease.
2. Обязательные продуктовые регрессии — именно два реальных Node-процесса, а не два async task внутри одного процесса.
3. Для store test: разные session keys обновляются параллельно, оба pending records переживают reload.
4. Для session gate test: одна explicit session, оба поколения стартуют без pending, но provider получает ровно один запрос; второй после lease видит pending и останавливается.
5. Stale-lock recovery должна быть fail-closed: нельзя просто истечь по таймеру и пустить второй процесс параллельно.
6. Следующий Integration Helper запуск ищет новый недублирующийся стык; эти два finding повторно не исследовать без изменения продукта.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
