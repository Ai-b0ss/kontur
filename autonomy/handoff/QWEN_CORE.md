# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `f02d39193621ea7c5bf09af6bdd64d53dbdbee48`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Закрыто в этом проходе

### 1. Persisted `batchId` больше не принимает неправильный тип
До исправления `persistedBatchContext()` делал `String(options.batchId).trim()`, поэтому `42`, `false` и `['batch']` могли стать настоящими durable batch id.

Исправление:
- root fix `104cd5092b6ac502ea96fa31c306a6cdafd26152`;
- `scripts/subagent-batch-id-type-test.js` после targeted green подключён в обычный `npm test` коммитом `61303e10274a4f4011c26dc142ec466d4f871226`.

Новая семантика:
- omitted / legacy `null` -> persistence выключен;
- explicit non-null `batchId` обязан быть строкой;
- другой тип -> `QWEN_SUBAGENT_BATCH_ID_INVALID` до `batchStore.ensure()`.

Hosted targeted PASS:
`QWEN_SUBAGENT_BATCH_ID_TYPE_PASS invalid=4 omitted=1 null=1 store_calls=0`.

### 2. Повреждённая durable task-record больше не запускает coding-subagent автоматически
Fresh review существующего `scripts/subagent-persisted-state-conflict-test.js` показал, что `hasPersistedStateConflict()` раньше возвращал `false` для primitive/array record. Синтаксически валидное долговечное состояние вида `tasks.task = "done"`, `42`, `true` или `['done']` могло пройти к `markRunning()` и затем реально повторно запустить subagent. Для уже выполнявшей side-effect задачу это restart/replay defect.

Исправление:
- canonical regression расширен коммитом `273e7505744a119ec1b4b0bbf2f6b390f3ffd972` четырьмя malformed record cases;
- root fix `f02d39193621ea7c5bf09af6bdd64d53dbdbee48`: `null` остаётся «записи нет», но любой non-object или array persisted record считается конфликтным и блокируется через `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT` до agent/provider.

Hosted targeted PASS:
`QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT_TARGET_PASS conflicts_blocked=12 clean_states=3 null_absent=1`.

Regression уже был частью штатного `npm test`, поэтому отдельного standalone-теста не создано. Compare `61303e... -> f02d391...` меняет только `scripts/subagent-persisted-state-conflict-test.js` и `src/subagent-agent-runner.js`.

## Сохраняющий силу Core proof
На неизменённых байтах ранее подтверждены:
- nested durable session schema fail-closed;
- owner authority type checks и большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix fail-closed.

Текущий проход не менял `session-store`, `server`, `chat-adapter`, tool-result/restart или Reliability-owned account/provider bytes.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact targeted PASS;
- provider-circuit cluster: 7/8 exact targeted PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios`; shim/reconstructed dependency proof не принимается.

## Circle policy
`kontur#9` fresh-read подтверждает `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]`:
- Circle runs/jobs/branch triggers = 0;
- старые Circle результаты только исторические;
- если все non-Circle gates зелёные и остаётся только native gate, статус максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.

## Что осталось до финиша
1. Fresh stable common SHA.
2. Локально exact Core cluster: owner/session/restart/stale-backup/pending-tool + stream/tool-result + plain/coding subagents, включая оба новых batch invariants.
3. Reliability exact `provider-safety-test.js` на том же product SHA.
4. Full exact-tree Linux `npm test` на стабильном общем SHA.
5. Пока Circle freeze действует — native gate не запускать.
6. После явной разморозки — один native Windows Server 2022 full offline gate на тех же product bytes, locked install, без provider/live/secrets/production.
7. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness; проверить его в native Windows Circle и выводить `QWEN_WINDOWS_READY` либо первый точный blocker.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из fresh-read handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Фактический путь LATEST/PREVIOUS/runtime через доступную GitHub-поверхность в этом проходе надёжно не разрешён. Force-write и pseudo-v4 запрещены, поэтому pointer не подменялся.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
