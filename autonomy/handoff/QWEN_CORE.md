# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `61303e10274a4f4011c26dc142ec466d4f871226`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` всё ещё действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Закрытый Core-дефект этого прохода: persisted `batchId` принимал неправильный тип

До исправления `persistedBatchContext()` делал `String(options.batchId).trim()`. Поэтому явно ошибочные значения могли стать настоящими идентификаторами долговечного batch-состояния:
- `42` -> `"42"`;
- `false` -> `"false"`;
- `['batch']` -> `"batch"`.

Это restart/replay boundary: неверный тип входа мог выбрать/создать реальный сохранённый batch вместо локального fail-closed отказа.

### Исправление
- red regression уже существовал: `scripts/subagent-batch-id-type-test.js`, blob на старом head `1173fe7ea8de6711ef42b7f261d7d0097b30f640`;
- root fix commit `104cd5092b6ac502ea96fa31c306a6cdafd26152`;
- current `src/subagent-agent-runner.js` blob `db3c008a5f9f615b7173fd634d4f9b2810ef7a16`;
- после hosted targeted green regression сразу подключён в штатный `npm test` commit `61303e10274a4f4011c26dc142ec466d4f871226`.

Новая семантика:
- `batchId` отсутствует -> persistence выключен;
- legacy `batchId: null` -> persistence выключен;
- если `batchId` передан и не `null`, он обязан быть строкой;
- нестроковые значения -> `QWEN_SUBAGENT_BATCH_ID_INVALID` до `batchStore.ensure()`;
- строковый SAFE_BATCH_ID продолжает работать как раньше.

Hosted targeted check без provider/CI:
`QWEN_SUBAGENT_BATCH_ID_TYPE_PASS invalid=4 omitted=1 null=1 store_calls=0`.

Постоянный regression не оставлен standalone: `package.json` на head `61303e...` запускает `scripts/subagent-batch-id-type-test.js` в обычном `npm test` сразу после canonical `subagent-agent-runner-test.js`.

## Сохраняющий силу Core proof
До текущего прохода на неизменённых Core bytes были подтверждены:
- nested durable session schema fail-closed;
- owner authority type checks и большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix fail-closed.

Текущий root fix менял только `src/subagent-agent-runner.js`; второй commit менял только `package.json`. `session-store`, `server`, `chat-adapter`, tool-result/restart bytes не затронуты.

## QWEN_RELIABILITY — не пересекать
Fresh handoff перед работой:
- account/cooldown/index/filename cluster: 8/8 exact targeted PASS;
- provider-circuit cluster: 7/8 exact targeted PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios`; shim/reconstructed dependency proof не принимается.

Core не менял `account-store`, cooldown, `qwen-client` или provider-circuit.

## Circle policy
`kontur#9` fresh-read подтверждает `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]`:
- Circle runs/jobs/branch triggers = 0;
- старые Circle результаты только исторические;
- если все non-Circle gates зелёные и остаётся только native gate, статус максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.

## Что осталось до финиша
1. Fresh stable common SHA.
2. Локально прогнать exact Core cluster: owner/session/restart/stale-backup/pending-tool + stream/tool-result + plain/coding subagents, включая новый batch-id invariant.
3. Reliability exact `provider-safety-test.js` на том же product SHA.
4. Full exact-tree Linux `npm test` на стабильном общем SHA.
5. Пока Circle freeze действует — не запускать native gate.
6. После явной разморозки — один native Windows Server 2022 full offline gate на тех же product bytes, locked install, без provider/live/secrets/production.
7. Только после Linux + native Windows green — простой PowerShell owner-doctor/acceptance harness; он сам должен пройти native Windows Circle и вывести `QWEN_WINDOWS_READY` либо первый точный blocker.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из fresh-read handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Фактический путь LATEST/PREVIOUS/runtime через доступную GitHub-поверхность в этом проходе надёжно не разрешён. Force-write и pseudo-v4 запрещены, поэтому pointer не подменялся.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
