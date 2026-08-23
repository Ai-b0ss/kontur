# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `8ef4f0e4740ced01ab1806a3ad086755e8cf1f3b`.
- Kontur и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет account/cooldown/provider-circuit; Core туда не заходит.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_CORE/QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## ЗАКРЫТО В ЭТОМ ЦИКЛЕ №1: конфликтующие aliases skills

До исправления `requestedSkillNames()` уже отвергал нестроковые значения, но несколько одновременно переданных aliases `skills/skill_names/skillNames` не сверялись.

Root fix:
- `6be7da56d94bf64fd56b23cb804ff6ae1a08bba6` — строгая нормализация и сверка aliases в `src/skills.js`; конфликт -> `QWEN_SKILL_SELECTOR_INVALID`.
- blob `src/skills.js`: `61314aea3c39c62728041c608f9c5555b7c727a6`.
- `86179ad57a06cfa94c3840bbc4daa03b6f142c96` — расширен уже штатный `scripts/skills-selector-type-validation-test.js`; blob `0c9ed02a7ed07497ffd84b68136c880ad9f863db`.
- package wiring не требовался: regression уже входил в ordinary `npm test`.

Targeted local PASS без provider/CI:
`QWEN_SKILL_SELECTOR_ALIAS_TARGET_PASS inherited=2 equivalent=1 conflicts=3`.

## ЗАКРЫТО В ЭТОМ ЦИКЛЕ №2: пустой internal-agent completion больше не считается успехом

На exact предыдущем `src/agent.js` blob `3a2b6a6d9414dab18cdb21f8d69143ac77a73cba` ветка без tool-calls делала synthetic success:
`result.content.trim() ? result.content : '(пустой ответ)'`.

RED был воспроизведён на byte-exact materialization: `agent.runTurn()` не отклонял metadata/terminal stream без текста/tool-call и возвращал успешный `assistant` с `(пустой ответ)`.

Постоянная красная проверка сначала добавлена отдельно:
- `cd05b3858260cbbf6516875162257ef8aee10b28` — `scripts/agent-empty-response-test.js`.

Root fix:
- исходный `src/agent.js` был локально реконструирован строго из GitHub line-ranges; `git hash-object` перед mutation точно совпал с `3a2b6a6d9414dab18cdb21f8d69143ac77a73cba`;
- `89a993f8f3454ea43888cf656e634bd2d54ca61f` — если `toolCalls.length===0` и `content.trim()` пуст, агент бросает короткую `QWEN_AGENT_EMPTY_RESPONSE`; synthetic assistant success больше не записывается;
- новый blob `src/agent.js`: `d5daf1f2f269772c7da6ac335ee291de293185b0`;
- `8ef4f0e4740ced01ab1806a3ad086755e8cf1f3b` — regression сразу включён в ordinary `npm test`; `package.json` blob `5099b82edad372c88f450fd86a9816b10d924769`.

Targeted до fix: ожидаемый RED `Missing expected rejection`.
Targeted после fix на том же exact source + minimal patch:
`QWEN_AGENT_EMPTY_RESPONSE_REJECTED provider_calls=1 synthetic_success=0`.
`node --check src/agent.js` = PASS.

Семантика tool-call с пустым preamble не менялась: fail-closed действует только когда нет ни tool-call, ни непустого финального текста.

## Diff-граница этого запуска
Compare исходного head `d6e843914078168ba2026c0c99746cfcd99fe480` -> `8ef4f0e4740ced01ab1806a3ad086755e8cf1f3b` = ровно 5 commits и 5 Core-файлов:
- `src/skills.js`;
- `scripts/skills-selector-type-validation-test.js`;
- `src/agent.js`;
- `scripts/agent-empty-response-test.js`;
- `package.json` test wiring.

`session-store.js`, `server.js`, `chat-adapter.js`, account/cooldown/provider-circuit и `package-lock.json` не затронуты.

## Сохраняющий силу Core proof
На неизменённых участках сохраняются прежние targeted доказательства:
- nested durable session schema fail-closed;
- incremental tool-results сохраняют durable assistant/tool pair;
- owner authority type checks и большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart и duplicate tool-call-id protection;
- stale-backup fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix/batch-state fail-closed;
- execution error classification и required tool arguments.

## CircleCI — reconnect остаётся НЕ ДОКАЗАН
Единственный дешёвый reconnect-probe уже израсходован:
- branch `ci/qwen-reconnect-probe`;
- probe commit `f1e70505751e1d6648758b289c57a60da9d9de3b`;
- provider/live/secrets = 0.

В этом запуске GitHub combined status снова: `statuses=[]`.
Классификация `CIRCLE_RECONNECT_UNPROVEN`, НЕ PASS.
- второй probe не запускать;
- heavy final Linux/Windows Circle gate до читаемого result не запускать.

## QWEN_RELIABILITY — свежая граница
Fresh handoff сообщает:
- account/cooldown/index/filename: 8/8 exact targeted PASS;
- provider-circuit: 7/8 exact targeted PASS;
- единственный proof gap: exact `node scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios` 1.19.0; shim/reconstructed tree не принимать.

## Что осталось до DONE
1. Fresh stable common product SHA.
2. Core targeted cluster на том же SHA: session/restart/stale-backup/pending-tool/tool-result + owner/system modes + plain/coding subagents + skills + stream/tool/agent gates.
3. Reliability exact `provider-safety-test.js` и её targeted cluster на том же SHA.
4. Full exact-tree Linux `npm test` на этом SHA.
5. Дождаться читаемого status/result уже созданного Circle reconnect probe; второй probe не создавать.
6. После доказанной связи — один native Windows Server 2022 Circle gate на тех же product bytes через disposable `ci/qwen-final-gate`, locked install + полный offline suite, без provider/live/secrets/production.
7. Затем PowerShell owner-doctor: prerequisites/Node, локальный старт, offline/self-test, session/restart/tool-result/subagent smoke; harness должен пройти native Windows Circle и вывести `QWEN_WINDOWS_READY` либо первый blocker.
8. Только при отсутствии незакрытого серьёзного воспроизводимого дефекта ставить `QWEN_CORE_DONE`.

Полный exact-tree Linux `npm test` в этом запуске НЕ заявляется.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Exact QWEN_CORE `LATEST/PREVIOUS` и normative runtime paths в доступном control tree снова не удалось надёжно разрешить. Новый pointer не публиковался: guessed path, pseudo-v4 и force-write запрещены. Новое состояние долговечно закреплено product commits + handoff + issue #9.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions = 0. Circle новых запусков = 0.
