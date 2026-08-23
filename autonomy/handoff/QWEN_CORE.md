# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `900499cc3180dde49eb0f2fd56e3e8090052ea5a`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Закрыто: type confusion у skill selectors plain/coding subagents

Fresh review `src/subagent-dispatcher.js` + `src/skills.js` показал, что `normalizeTasks()` принимал произвольные `skills`, а нижний skills-слой затем делал `String(value)`. Malformed selector вроде nested `[['debug-repair']]` мог превратиться в настоящее имя `debug-repair` и молча выбрать технические инструкции.

Исправление:
- root fix `2ab164e166434c4216b92c913ea18e2938db1795`;
- regression `scripts/subagent-skill-type-validation-test.js` на `97ed08d18ac428f2e456c5013dbccc2222ef56b7`;
- regression сразу подключён в ordinary `npm test` на `118a2dcb43790aa36a27c45bb32804751326e4de`.

Новая семантика:
- selector обязан быть непустой строкой;
- `null/false/number/object/nested array/blank` -> `QWEN_SUBAGENT_SKILL_INVALID`;
- malformed selector останавливается до любого subagent/provider request.

Hosted byte-exact targeted PASS:
`QWEN_SUBAGENT_SKILL_TYPE_VALIDATION_PASS rejected=7 normalized=2 provider_calls=0`.

Exact blobs:
- `src/subagent-dispatcher.js` = `21dd74828bd6dfcae27acc6a32c42b6dec12ec2e`;
- regression = `4f61aa013203b43bb637f7e019dfe13b9f986ab1`.

## НОВЫЙ ДОКАЗАННЫЙ CORE RED: orphan tool-result может стереть durable pending pair

Fresh exact `src/session-store.js` review локализовал опасный restart/tool-result boundary.

Текущая логика `restoreCheckpoint()` при `countNonSystem(messages) > 1` считает incoming transcript authoritative и передаёт именно его в `persistCompletedToolProgress()`. Если клиент прислал несколько `role=tool` результатов без уже ранее checkpoint-нутого `assistant.tool_calls`, `hasNewToolResult()` видит прогресс, но `checkpointMessages(authoritativeIncoming)` отбрасывает standalone `tool` messages. В итоге durable история может потерять и pending assistant call, и его tool result; наружу при этом возвращается transcript с orphan `role=tool`.

Hosted semantic reproduction на функциях с exact текущей семантикой:
`QWEN_SESSION_ORPHAN_TOOL_RESULT_BUG_REPRODUCED durable_pair_lost=1 outbound_orphan=1`.

Постоянная RED regression уже добавлена, но намеренно НЕ подключена к `npm test`, пока продукт красный:
- `scripts/session-orphan-tool-result-restart-test.js`;
- commit `900499cc3180dde49eb0f2fd56e3e8090052ea5a`.

Следующий проход обязан начать с этого RED, не с нового аудита.

### Минимальная root-fix семантика
1. Отличить настоящий полный transcript от incremental update, где `role=tool` не имеет соответствующего `assistant.tool_calls` внутри самого incoming списка.
2. Для такого incremental/orphan tool-result использовать durable merged history (`record.history + fresh incoming`), а не authoritative incoming отдельно.
3. И persist, и возвращаемый в текущий запрос transcript должны сохранять пару `assistant.tool_calls -> tool result` атомарно.
4. После targeted green сразу подключить `session-orphan-tool-result-restart-test.js` в ordinary `npm test`.
5. Затем прогнать ближайший cluster: `session-tool-result-progress`, `session-pending-tool-call-restart`, `session-duplicate-tool-call-id`, `session-store-restart`, stale-backup/restart.

Не ослаблять full-history recovery semantics и не принимать orphan tool results без ранее durable pending call.

## Сохраняющий силу Core proof
На неизменённых байтах ранее подтверждены:
- nested durable session schema fail-closed;
- owner authority type checks и большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix fail-closed;
- durable batch id/type + persisted-state conflict + duplicate internal-agent tool-call ids.

Skill fix не менял `session-store`, `server.js`, `chat-adapter`, `agent.js`, account/cooldown/provider-circuit bytes. Новый RED commit добавляет только regression-файл.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact targeted PASS;
- provider-circuit cluster: 7/8 exact targeted PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios`; shim/reconstructed dependency proof не принимается.

Controller fresh-sync подтвердил, что Reliability-owned `src/qwen-client.js`, `src/account-store.js`, `src/provider-circuit.js`, `package-lock.json` не менялись последними Core-коммитами.

## Circle policy
`kontur#9` fresh-read подтверждает `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]`:
- Circle runs/jobs/branch triggers = 0;
- старые Circle результаты только исторические;
- если все non-Circle gates зелёные и остаётся только native gate, статус максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.

## Что осталось до финиша
1. Закрыть `session-orphan-tool-result-restart-test.js` root fix + targeted cluster, затем wire regression в `npm test`.
2. Fresh stable common SHA Core+Reliability.
3. Reliability exact `provider-safety-test.js` на том же product SHA.
4. Full exact-tree Linux `npm test` на стабильном общем SHA.
5. Пока Circle freeze действует — native gate не запускать.
6. После явной разморозки — один native Windows Server 2022 full offline gate на тех же product bytes, locked install, без provider/live/secrets/production.
7. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness; проверить его в native Windows Circle и выводить `QWEN_WINDOWS_READY` либо первый точный blocker.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Новый v4 pointer в этом проходе не публиковался: надёжный exact LATEST/PREVIOUS/runtime path через текущую GitHub-поверхность не был разрешён до записи. Force-write/pseudo-v4 запрещены.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
