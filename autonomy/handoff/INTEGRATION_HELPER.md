# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 07:05 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `d41bc71ac7875c8bb4a625e128f20d01c2d885c6`.
- Notion PR #8: `75a4a6de243e22e0df3c15e572e7aa09977d1fcb`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Их текущие узкие зоны не перехватывались:
- Qwen Core — streaming/session disconnect + checkpoint lifecycle;
- Qwen Reliability — canonical preferred account/cooldown и `operationCandidates()` без потери thread affinity;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable rendered parent Responses replay + ожидающий native-Windows auth rollback.

## Новый Qwen gap 1 — stale writer может откатить terminal status

Fresh exact blobs:
- `src/subagent-batch-store.js` = `f384b57e52d54e298d466b858831eedb2a0dc4f1`;
- `src/subagent-agent-runner.js` = `53e8682563c39d9d10ccf8d748263ce63fb43e28`;
- `scripts/subagent-persisted-state-conflict-test.js` = `a2d483963550bcb4aae0b88e871356e9e69cac30`.

`updateTask()` сейчас слепо сливает patch в текущую запись. `markRunning/markDone/markFailed/markUncertain` не проверяют ожидаемый предыдущий статус. Поэтому более медленный старый исполнитель после того, как другой уже долговечно записал `done`, может поздно записать `uncertain/failed`; отдельный stale `markRunning` может снова открыть terminal task.

Offline probe PASS: нынешняя семантика разрешает `done -> uncertain` и `done -> running`; кандидат с expected-status guard блокирует оба перехода и сохраняет нормальный `running -> done`.

Материалы:
- `autonomy/v3/tools/integration_qwen_batch_status_transition_guard_probe.js`;
- `autonomy/evidence/integration/20260821T0655Z_qwen_batch_terminal_status_transition_gap.json`.

Обязательное условие: expected-status check должен выполняться ВНУТРИ той же межпроцессной сериализации/CAS, что и read→mutate→replace. Внешняя проверка статуса не закрывает гонку.

## Новый Qwen gap 2 — backup recovery может воскресить `pending`

Тот же `subagent-batch-store.js` при ошибке чтения/JSON canonical-файла безусловно возвращает `readNewestBackup()`. Но backup — это predecessor snapshot. `writeAtomic()` специально допускает оставшийся `.bak-*` после уже совершённого commit, если cleanup backup не удался.

Опасный сценарий:
1. backup содержит `pending`;
2. canonical replacement долговечно записал `running`;
3. после этого локальный инструмент мог выполнить side effect;
4. canonical-файл позже стал нечитаемым;
5. `readState()` возвращает старый backup как обычный `pending`;
6. restart может автоматически выполнить задачу снова.

Offline probe PASS: текущий fallback действительно восстанавливает `pending`; консервативный кандидат помечает non-done запись, восстановленную из predecessor backup, как `uncertain` и блокирует автоматический replay.

Материалы:
- `autonomy/v3/tools/integration_qwen_batch_backup_recovery_failclosed_probe.js`;
- `autonomy/evidence/integration/20260821T0700Z_qwen_batch_backup_recovery_replay_gap.json`.

Минимальный продуктовый контракт:
- backup fallback обязан иметь явный provenance;
- non-terminal predecessor backup нельзя считать replay-authoritative;
- без более сильного generation/commit proof он должен fail-closed (`uncertain`/explicit recovery), а не молча становиться runnable;
- coherent predecessor `done` можно сохранить resumable;
- regression: `pending backup -> committed running -> possible side effect -> canonical corruption -> restart`, executor count после restart должен оставаться 0.

## Связь с уже доказанным store-wide gap

Предыдущим запуском подготовлен `autonomy/v3/tools/integration_qwen_batch_store_interprocess_lock_candidate.js`: два реальных Node-процесса доказали, что store-wide lock вокруг полного read→mutate→atomic-replace убирает lost update. Это отдельный слой. Для целостного product fix нужны одновременно:
1. store-wide interprocess serialization/CAS;
2. expected predecessor status внутри этой транзакции;
3. fail-closed provenance при восстановлении predecessor backup.

Только lock без пунктов 2–3 всё ещё допускает stale terminal downgrade и unsafe backup replay.

## Notion styk — не потерять предыдущий открытый блок

Сохраняется предыдущий доказанный дефект: `DelegatedToolLoopSession`/`SubagentLifecycle` держат child execution state только в памяти, поэтому process death после mutating local tool и до durable tool result может повторить side effect после restart. Материалы остаются:
- `autonomy/v3/tools/integration_notion_delegated_restart_side_effect_probe.py`;
- `autonomy/evidence/integration/20260821T0630Z_notion_delegated_restart_side_effect_gap.json`.

Не смешивать этот child-state с Notion Core parent Responses replay или provider account/thread state.

## Ранее доказанные стыки — не дублировать

Сохраняются: same-task claim race; global batch-store lost update; process-global tool workspace; persisted workspace identity; Notion rebind global parallelism и same-account overlap; parent-scoped child identity; stable Qwen taskId/batchId/sessionPrefix; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; Notion 24 vs Qwen 12 turns; successful Qwen result с пустым text; selected-skill content fingerprint; delegated tool-capability policy; cross-parent bare task-id conflict.

## Следующий безопасный интеграционный шаг

1. Когда Qwen-владелец материализует store-wide serialization, прогнать единый exact-store offline harness: same task => один executor; unrelated batches не теряют updates; stale worker не откатывает `done/uncertain`; backup fallback не делает predecessor `pending` runnable; restart не повторяет mutating side effect.
2. До product merge дополнительно проверить explicit `retryUncertain=true`: он должен оставаться осознанным escape hatch, но не позволять старому процессу перезаписать более новый terminal result.
3. Для Notion продолжить только независимый durable child-state contract/regression, не переписывая активные server/account-pool materializers основного Agent-worker.

## Ограничения и память

Run-start `LATEST.json`: capsule `20260821T054341Z-e45fead477`, archive SHA-256 `e21ac51d8884aa1970c0cc072e36aa2a1b422379400126ec0bb87cad3f3904b7`, Git blob SHA `ffc3e9d98b387fe9cb9cdb76fae80050027468cd`. Manifest и 7 parts получены отдельно; длины и SHA частей, archive size/SHA совпали с manifest. Product work опирался на fresh exact GitHub source; неизвестные байты из памяти не реконструировались.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.
