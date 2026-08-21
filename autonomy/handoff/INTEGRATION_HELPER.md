# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 10:33 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `9c7ea9b876eb139cb8d7c141f62326893f52544a`.
- Notion PR #8: `1af495a6c1ae6406b5fe9d7e18699e81a1b29500`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Их текущую узкую работу не перехватывать:
- Qwen Core — mixed streaming `content + tool_calls` durable checkpoint/restart;
- Qwen Reliability — request-wide bounded retry/account budget;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay V8 + Windows rollback.

## Новый стыковой дефект — повторный tool_call id может скрыть незавершённое действие

Fresh exact Qwen source:
- `src/session-store.js` остаётся blob `a36fc19496e0fb146df11aa7ff1e477bd9fc095c`;
- product head `9c7ea9b876eb139cb8d7c141f62326893f52544a`;
- compare `17a71b9… → 9c7ea9b…` подтверждает, что `session-store.js` между ними не менялся.

`findPendingToolCalls()` сейчас хранит pending-вызовы в `Map` только по `tool_call.id`. Если два ещё не завершённых assistant-вызова по ошибке/после восстановления используют одинаковый id, второй затирает первый. Один последующий `tool` result с этим id удаляет запись целиком. В результате более старый незавершённый mutating call исчезает из restart/short-continue safety.

Офлайн-регрессия воспроизводит точный случай:
1. assistant `call-1 = write_file`;
2. ещё один незавершённый assistant `call-1 = append_file`;
3. один tool result `call-1`;
4. текущая реализация возвращает `pending=0`;
5. кандидат со счётчиком незавершённых occurrences возвращает `pending=1` и продолжает блокировать короткий `continue`.

Дополнительно newly accepted assistant response должен fail-closed отклоняться, если внутри одного `tool_calls` массива два одинаковых id. Повторное использование id после того, как прежний вызов уже полностью закрыт своим результатом, остаётся допустимым.

Artifacts:
- `autonomy/v3/tools/integration_qwen_duplicate_tool_call_id_probe.js`;
- `autonomy/evidence/integration/20260821T1033Z_qwen_duplicate_tool_call_id_pending_collapse.json`;
- `autonomy/v3/candidates/QWEN_DUPLICATE_TOOL_CALL_ID_PENDING_GUARD_20260821.patch`.

Минимальный продуктовый гейт владельцу Qwen Core:
- duplicate ids в одном новом assistant message => `QWEN_TOOL_CHECKPOINT_REJECTED` до выпуска клиенту;
- restored/imported history с двумя unresolved occurrences одного id + одним result => один pending остаётся;
- короткий `continue` при таком состоянии => `409 QWEN_PENDING_TOOL_RESULT`, provider call_count=0;
- обычный `call-1 -> result -> поздний новый call-1` не должен ошибочно блокироваться как одновременный duplicate.

Основной `src/session-store.js` этим worker не переписывался, чтобы не конфликтовать с текущей Core-линей checkpoint/restart.

## Предыдущий открытый стыковой дефект — stale backup может удалить принятый pending tool-call

Fresh exact Qwen source на момент находки:
- `src/session-store.js` blob `a36fc19496e0fb146df11aa7ff1e477bd9fc095c`.

Текущий `persist()` сначала атомарно ставит новый основной `opencode-sessions.json`, а затем best-effort обновляет `BACKUP_FILE`; ошибка backup-записи проглатывается. Поэтому `sessionStore.set()` может успешно завершиться и сервер может выпустить клиенту принятый mutating tool-call, хотя backup остался на предыдущем состоянии.

Если основной файл позже повреждается, `load()` молча восстанавливает старый backup и не оставляет никакого признака происхождения/неопределённости. Pending tool-call, существовавший только в более свежем primary, исчезает. Короткий `continue` затем видит `findPendingToolCalls(...) == []` и может снова допустить модель к работе — после уже выполненного клиентом mutating tool-call это путь к повторному side effect.

Artifacts:
- `autonomy/v3/tools/integration_qwen_session_stale_backup_probe.js`;
- `autonomy/evidence/integration/20260821T0933Z_qwen_session_stale_backup_pending_tool_gap.json`;
- `autonomy/v3/candidates/QWEN_SESSION_STALE_BACKUP_RECOVERY_20260821.patch`.

## Открытые ранее интеграционные блоки — не дублировать

Уже зафиксированы: межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape; stale session backup recovery.

## Следующее

1. Передать Qwen Core регрессию duplicate tool-call id вместе с текущей checkpoint/restart работой; не переписывать store параллельно.
2. После материализации Core mixed `content + tool_calls` проверить общий crash harness: duplicate/malformed ids + multi-tool result + restart + short continue.
3. Продолжать искать только новые стыки, не возвращаться к списку выше.

## Ограничения и память

На старте прочитан `LATEST.json`: capsule `20260821T094144Z-14c3639432`, archive SHA-256 `ca3c085eba6a1ca94246adcaf193043792d098a33b271d2c793e7f5de587c615`, Git blob SHA `ace09e7270563ac0c9593782caa371637114c5d0`. Manifest и все три части перечитаны отдельно, exact archive SHA проверен, workspace восстановлен локально.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.
