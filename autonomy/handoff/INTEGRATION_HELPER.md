# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 14:55 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `861a8f176a6037acaec5721b2f6bbad3041d7dd9`.
- Notion PR #8: `cba70d87c2fad9736f4f2cefa1854b3efbf7636d`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — mixed streaming preamble/tool checkpoint и соседние restart/session границы;
- Qwen Reliability — request-wide bounded retry/account accounting и локальная подготовка до provider boundary;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay + native Windows rollback gate.

Предыдущий helper-блок `QWEN_SAME_SESSION_CONCURRENT_CONTINUE_RACE` уже закрыт Qwen Core через `SessionRequestGate`; в этом запуске он не дублировался.

## Новый блок 1 — truncated partial tool result стирает durable sibling obligation

Fresh `src/session-store.js` blob `d13f79a1c999ca5221cac190ad7b155f4854ae9b` в `restoreCheckpoint()` делает:

`progressMessages = countNonSystem(messages) > 1 ? messages : mergedMessages`

и затем `persistCompletedToolProgress(record, progressMessages)`.

Если durable assistant-turn уже содержит два принятых изменяющих вызова `call-A` и `call-B`, а stale/truncated OpenAI-compatible клиент возвращает явный transcript только с `call-A + tool result A`, текущий код считает это новым tool progress и целиком заменяет durable history caller-транскриптом. Результат: незавершённый `call-B` исчезает из долговечного состояния, а сохранённый system/owner prompt тоже теряется.

Офлайн-probe прошёл:
- current pending after persist: `[]`;
- candidate pending after persist: `[call-B]`;
- candidate сохраняет system/owner prompt и matching result A;
- полный exact transcript не дублирует assistant-turn и всё равно оставляет `call-B` pending.

Artifacts:
- `autonomy/v3/tools/integration_qwen_partial_tool_result_truncated_transcript_probe.js`;
- `autonomy/evidence/integration/20260821T1435Z_qwen_truncated_partial_tool_result_durable_sibling_loss.json`;
- `autonomy/v3/candidates/QWEN_TRUNCATED_PARTIAL_TOOL_RESULT_DURABLE_MERGE_20260821.patch`.

Минимальный контракт: durable tool-result progress должен записываться из авторитетной `mergedMessages`, а не из caller transcript, который может потерять уже принятые unresolved obligations.

## Новый блок 2 — тот же truncated transcript ломает account/thread failover rebase

Это отдельный стык Core ↔ Reliability.

Когда владелец upstream-thread (аккаунт A) недоступен, `server.js` правильно делает `existingChatId=null` и обязан начать fresh thread на легитимном sibling-аккаунте с полной локальной историей. Но `restoreCheckpoint()` для явного transcript с >1 non-system message возвращает caller `messages` без merged durable history.

На том же сценарии `call-A + result A`, где durable history содержит system + prior user + `[call-A, call-B]`, новый sibling получает только роли `[assistant, tool]`: owner/system prompt, предыдущая пользовательская задача и unresolved `call-B` отсутствуют.

Та же проблема возможна при late failover: A был доступен в начале, `qwenClient` сменил chat/account после transport/CAPTCHA, а rebase строится из уже урезанного `effectiveBody`.

Офлайн-probe прошёл:
- current fresh sibling payload: `[assistant, tool]`, pending=`[]`;
- candidate fresh payload сохраняет system + prior user + pending=`[call-B]`;
- same healthy owner/currentOnly path может оставить нынешнее incremental-поведение.

Artifacts:
- `autonomy/v3/tools/integration_qwen_truncated_tool_result_failover_rebase_probe.js`;
- `autonomy/evidence/integration/20260821T1448Z_qwen_truncated_tool_result_failover_rebase_gap.json`;
- `autonomy/v3/candidates/QWEN_TRUNCATED_TOOL_RESULT_FAILOVER_REBASE_20260821.patch`.

Продуктовому владельцу лучше объединить оба кандидата в один coherent fix: `restoreCheckpoint` сохраняет merged durable history, а fresh/rebased upstream thread получает merged full local history. Same-owner incremental compatibility можно сохранить отдельно.

## Ранее открытые интеграционные блоки — не дублировать

Уже зафиксированы: durable pending obligation bypass обычной фразой/неполной историей; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape; same-session concurrent continue; command/reset gate; command content-shape.

## Постоянная память

На старте этого запуска прочитан `LATEST.json` blob `835010da75007e1c05388ab6ff6bb0723f0b6f78`, capsule `20260821T134425Z-167e1f9523`, archive SHA-256 `d0617b7ad8718c89073ef5022d8d8af7b24e0c00fd0175fc7ad63e33dccac429`. Manifest и все три parts прочитаны отдельно; архив восстановлен локально с exact SHA и использован как рабочая память.

Финальная v4 capsule этого запуска должна быть опубликована только после `pack -> verify -> restore -> immutable upload/readback -> CAS LATEST` от исходного blob `835010da...`. При CAS-конфликте force-write запрещён.

## Следующее

1. Qwen Core после своей текущей mixed-stream работы забирает оба новых session-store/server regression и предыдущий durable-pending-obligation guard как один набор restart/tool-result safety.
2. Qwen Reliability при интеграции проверяет, что fresh sibling действительно получает full merged history и при этом account cooldown/failure accounting не меняется.
3. Integration Helper в следующем запуске ищет новый недублирующийся стык; эти два сценария повторно не исследовать.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
