# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `118a2dcb43790aa36a27c45bb32804751326e4de`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Новый закрытый Core-дефект — типы skill selectors у plain/coding subagents

Fresh review `src/subagent-dispatcher.js` + `src/skills.js` показал type-confusion boundary: `normalizeTasks()` до этого принимал любое `skills` значение и передавал его дальше. Нижний skills-слой затем делал `String(value)`, поэтому malformed selector мог превратиться в реальное имя навыка: например nested `[['debug-repair']]` строкифицируется как `debug-repair`. Это позволяло ошибочному типу входа молча выбрать технические инструкции вместо fail-closed отказа.

Исправление:
- root fix `2ab164e166434c4216b92c913ea18e2938db1795`;
- новый regression `scripts/subagent-skill-type-validation-test.js` на `97ed08d18ac428f2e456c5013dbccc2222ef56b7`;
- regression сразу подключён в ordinary `npm test` на `118a2dcb43790aa36a27c45bb32804751326e4de`.

Новая семантика:
- skill selector обязан быть непустой строкой;
- `null/false/number/object/nested array/blank` -> `QWEN_SUBAGENT_SKILL_INVALID`;
- валидные имена trim-ятся и передаются как строки;
- malformed selector останавливается до любого subagent/provider request.

Hosted exact targeted PASS на GitHub-byte-identical source/test:
`QWEN_SUBAGENT_SKILL_TYPE_VALIDATION_PASS rejected=7 normalized=2 provider_calls=0`.

Exact blobs после записи:
- `src/subagent-dispatcher.js` = `21dd74828bd6dfcae27acc6a32c42b6dec12ec2e`;
- `scripts/subagent-skill-type-validation-test.js` = `4f61aa013203b43bb637f7e019dfe13b9f986ab1`.

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

В этом проходе не менялись `session-store`, `server.js`, `chat-adapter`, `agent.js`, account/cooldown/provider-circuit bytes.

## Следующий серьёзный Core-кандидат
Fresh session review выявил потенциально опасный boundary, пока НЕ исправленный и НЕ объявленный доказанным продуктовым FAIL: при full-ish incoming history с `role=tool`, но без соответствующего `assistant.tool_calls`, `restoreCheckpoint()` выбирает authoritative incoming при `countNonSystem > 1`. `persistCompletedToolProgress()` затем может checkpoint-ить входящую историю отдельно от ранее сохранённого pending tool-call. Следующий проход должен сначала воспроизвести это на exact `session-store.js` + restart harness. Если pending call/tool-result pair теряется — минимальный root fix должен отличать настоящий full transcript от incremental/orphan tool result и сохранять пару атомарно.

Не менять этот участок по одной гипотезе без exact reproduction.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact targeted PASS;
- provider-circuit cluster: 7/8 exact targeted PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios`; shim/reconstructed dependency proof не принимается.

Controller fresh-sync в `kontur#9` подтвердил, что Reliability-owned `src/qwen-client.js`, `src/account-store.js`, `src/provider-circuit.js`, `package-lock.json` не менялись между её proof boundary и последними Core-коммитами.

## Circle policy
`kontur#9` fresh-read подтверждает `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]`:
- Circle runs/jobs/branch triggers = 0;
- старые Circle результаты только исторические;
- если все non-Circle gates зелёные и остаётся только native gate, статус максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.

## Что осталось до финиша
1. Fresh stable common SHA Core+Reliability.
2. Локально exact Core cluster: owner/session/restart/stale-backup/pending-tool + stream/tool-result + plain/coding subagents, включая новый skill-type invariant.
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

В этом проходе новый v4 pointer не публиковался: надёжный exact LATEST/PREVIOUS/runtime path через текущую GitHub-поверхность не был разрешён до записи. Force-write/pseudo-v4 запрещены, поэтому продуктовый head + этот handoff являются точкой продолжения, а существующий LATEST не подменялся.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
