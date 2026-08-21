# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 20:32 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `5cc928607cf4d001cbf9adbc007277dccbdefe4b`.
- Notion PR #8: `a5792c1a15027a5f58890a679df738084514e6d1`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — большой owner system prompt и точность checkpoint/restart;
- Qwen Reliability — stale-backup uncertainty в `subagent-batch-store` после закрытого session primary cleanup;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay/compaction ordering + native Windows gate.

## Новый блок — смена системной политики не разрывает upstream thread affinity

Fresh exact Qwen source на `5cc928607...`:
- `server.js` blob `44d04725f7b1445f61c0f2da17007d1da8f0895f`;
- `src/session-store.js` blob `8dc3c2b144cd40fd5d9bd7f29d49b3c827bd24d3`;
- `src/qwen-v3-capabilities.js` blob `d91782d8199f4fcd7a0f0eeb995831f4dd328321`.

`server.js` повторно использует сохранённый `record.chatId` для обычного нового запроса, если прежний account всё ещё доступен и запрос не считается rollover. В `session-store` сохраняются `chatId/accountId/toolPromptHash/history`, но нет отпечатка прикладной/system-политики. Одновременно `qwen-v3-capabilities` разрешает сменить `engineer <-> owner` либо точный `owner_system_prompt` и добавляет новую политику в следующий upstream message.

Следствие: одна explicit local session может продолжить старый Qwen thread, который уже содержит policy A, а новый ход добавит policy B. Для owner-mode это оставляет две конкурирующие прикладные инструкции в одном удалённом треде. Точная локальная checkpoint-сохранность старый upstream context не удаляет.

Детерминированный offline probe воспроизвёл:
- current: старый `chatId` повторно используется; модель удалённого thread видит и `OWNER_POLICY_A`, и `OWNER_POLICY_B`;
- candidate: изменение content-free prompt fingerprint принудительно создаёт fresh upstream thread;
- exact fingerprint match сохраняет sticky affinity;
- legacy record без fingerprint делает один fail-closed rebase вместо угадывания.

Artifacts:
- `autonomy/v3/tools/integration_qwen_prompt_thread_affinity_probe.js`;
- `autonomy/evidence/integration/20260821T2032Z_qwen_system_prompt_thread_affinity_gap.json`.

Требование к продуктовому fix:
1. Рассчитать content-free SHA-256 фактической прикладной/system-политики, доходящей до Qwen: режим + exact owner prompt (либо engineer-base identity) + сохраняемый project/system context.
2. Хранить в session state только fingerprint, не plaintext приватного owner prompt.
3. Разрешать reuse `chatId` только при валидном account ownership и точном совпадении fingerprint.
4. При mismatch создать fresh Qwen thread и отправить полную актуальную локальную историю уже под новой политикой; старый remote thread id не переносить.
5. Legacy record без fingerprint должен один раз rebase fail-closed.
6. Все stream/non-stream/retry checkpoint paths должны сохранять fingerprint именно того prompt policy, под которым ответ был принят и выпущен клиенту.

Обязательные регрессии: owner A→owner B; engineer→owner; owner→engineer; same exact prompt сохраняет thread; legacy no-fingerprint rebase; account failover + prompt change; plaintext owner prompt отсутствует в durable metadata/evidence.

Это НЕ текущая узкая работа Qwen Core: Core чинит точность сохранения большого prompt в checkpoint. Здесь checkpoint может быть абсолютно точным, но удалённый Qwen thread всё равно остаётся привязан к старой прикладной политике.

## Предыдущий блок 1 — session-store теряет изменения другого процесса

Fresh exact прошлой границы показал process-local `Map` + whole-store replace. При кратком перекрытии старого/нового процесса разные session keys могут затереть друг друга. Two-process probe: current потерял `call-A`; кандидат с store-wide interprocess transaction + reread сохранил оба pending records.

Artifacts:
- `autonomy/v3/tools/integration_qwen_session_store_cross_process_lost_update_probe.js`;
- `autonomy/evidence/integration/20260821T1940Z_qwen_session_store_cross_process_lost_update.json`.

## Предыдущий блок 2 — SessionRequestGate защищает только один процесс

Process-local `SessionRequestGate` не защищает перекрытие двух server generations. Two-process probe: current дал два provider call для одной explicit session; кандидат process-shared per-session lease дал один provider call, второй процесс после lease увидел durable pending.

Artifacts:
- `autonomy/v3/tools/integration_qwen_cross_process_session_gate_probe.js`;
- `autonomy/evidence/integration/20260821T1942Z_qwen_cross_process_session_gate_restart_gap.json`;
- `autonomy/v3/candidates/QWEN_CROSS_PROCESS_SESSION_TRANSACTION_CONTRACT_20260821.patch`.

## Предыдущие helper-блоки — не повторять

Уже зафиксированы: truncated partial tool result стирает unresolved sibling obligation; truncated transcript ломает full-history failover rebase; durable pending obligation bypass; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; subagent-batch store-wide lost update; stale-writer terminal downgrade; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state after restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; successful empty Qwen text; pending-tool continuation content-shape; same-process concurrent continue; command/reset gate; command content-shape; implicit-session collision; store-wide recovery fail-closed; historical command replay; cross-process main session-store lost update; cross-process session admission gap.

## Постоянная память

На старте прочитан текущий проверенный `LATEST`:
- Git blob `6f93e4390f8518146a2d018953a018c3a618b062`;
- capsule `20260821T144628Z-e703b2256c`;
- archive SHA-256 `31ba53852b5a99d8d469ebdb36fa9c59812b16db01a91f6170467389f1a650ba`;
- manifest и все пять immutable parts прочитаны отдельно из GitHub и совпадают с ожидаемыми manifest metadata.

Exact `capsule_runtime_v4.py` перечитан, blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. В текущем hosted container прямой DNS к GitHub отсутствует, а connector-ответы не монтируются как файлы, поэтому безопасный exact runtime `restore -> pack -> immutable upload/readback -> CAS LATEST` в этом проходе не завершён. Неизвестные байты не реконструировались и `LATEST` не переключался. Новый finding долговечно сохранён отдельными probe/evidence и этим handoff.

## Следующее

1. Qwen-владелец должен добавить prompt-policy fingerprint к thread affinity одновременно с будущей межпроцессной session transaction, чтобы два механизма не создали конкурирующие state fields.
2. Перед reuse `chatId` проверка fingerprint должна выполняться до provider call и после любого restart/reload.
3. Prompt mismatch — это routing/rebase, не account/provider failure: не охлаждать легитимный аккаунт и не расходовать failover budget.
4. Fresh thread получает полную актуальную локальную историю под новой policy; старый Qwen thread не переиспользуется.
5. Следующий Integration Helper запуск ищет новый недублирующийся стык; этот finding повторно не исследовать без изменения продукта.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
