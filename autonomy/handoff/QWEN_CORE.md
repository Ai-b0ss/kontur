# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `cd05b3858260cbbf6516875162257ef8aee10b28`.
- Kontur и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет account/cooldown/provider-circuit; Core туда не заходит.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_CORE/QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## ЗАКРЫТО В ЭТОМ ЦИКЛЕ: конфликтующие aliases skills

До исправления `requestedSkillNames()` уже отвергал нестроковые значения, но верхний выбор всё ещё делался через `body.skills ?? body.skill_names ?? body.skillNames`, поэтому несколько одновременно переданных aliases не сверялись.

Root fix:
- `6be7da56d94bf64fd56b23cb804ff6ae1a08bba6` — `src/skills.js`: каждый из `skills`, `skill_names`, `skillNames` нормализуется отдельно; несколько реально заданных aliases обязаны дать один и тот же упорядоченный список, иначе `QWEN_SKILL_SELECTOR_INVALID`.
- blob `src/skills.js`: `61314aea3c39c62728041c608f9c5555b7c727a6`.
- `86179ad57a06cfa94c3840bbc4daa03b6f142c96` — расширена уже штатная `scripts/skills-selector-type-validation-test.js`; blob `0c9ed02a7ed07497ffd84b68136c880ad9f863db`.
- regression уже был включён в ordinary `npm test`; `package.json` не менялся.

Targeted локально без provider/CI:
`QWEN_SKILL_SELECTOR_ALIAS_TARGET_PASS inherited=2 equivalent=1 conflicts=3`.

Compare старого head `d6e843914...` до `86179ad57...` = ровно `src/skills.js` + regression, Core соседние файлы и Reliability-зона не затронуты.

## НОВЫЙ ДОКАЗАННЫЙ CORE RED: внутренний агент может принять пустой completion за успех

На exact `src/agent.js` blob `3a2b6a6d9414dab18cdb21f8d69143ac77a73cba` ветка без tool-calls делает:
`const content = result.content.trim() ? result.content : '(пустой ответ)'`
и возвращает обычный успешный assistant-turn.

`chat-adapter.parseQwenSSE()` при non-`requireToolCall` terminal frame может завершить поток без текстового/tool output; поэтому этот synthetic success достижим, а не только теоретический. Для автономного coding/subagent пути это ложный DONE: пустой upstream не должен превращаться в успешный ответ.

Зафиксирована намеренно красная постоянная проверка:
- `cd05b3858260cbbf6516875162257ef8aee10b28` — новый `scripts/agent-empty-response-test.js`.
- тест пока НЕ включён в `npm test`, потому что продукт доказанно красный; это обязательное исключение только до root fix.

Требуемый минимальный root fix:
- при `result.toolCalls.length === 0 && !result.content.trim()` бросать короткую локальную ошибку `QWEN_AGENT_EMPTY_RESPONSE` вместо создания `(пустой ответ)`;
- не записывать synthetic assistant success;
- tool-call с пустым preamble остаётся допустимым;
- после targeted green сразу включить `agent-empty-response-test.js` в ordinary `npm test` и прогнать соседние `offline-agent-loop-test.js`, `agent-round-limit-test.js`, `agent-tool-error-recovery-test.js`.

В текущем запуске root fix не записан: доступный GitHub write для `src/agent.js` требует полной замены 14KB файла, а надёжного byte-preserving patch primitive нет. Частичный/реконструированный large-file overwrite запрещён. RED оставлен явным, не замаскирован PASS.

## Сохраняющий силу Core proof
На неизменённых участках сохраняются прежние targeted доказательства:
- strict top-level skills element type + alias conflict;
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
Разрешённый единственный дешёвый reconnect-probe уже израсходован:
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
1. Закрыть `QWEN_AGENT_EMPTY_RESPONSE`, targeted verify, включить regression в `npm test`.
2. Fresh stable common product SHA.
3. Core targeted cluster на том же SHA: session/restart/stale-backup/pending-tool/tool-result + owner/system modes + plain/coding subagents + skills + stream/tool/agent gates.
4. Reliability exact `provider-safety-test.js` и её targeted cluster на том же SHA.
5. Full exact-tree Linux `npm test` на этом SHA.
6. Дождаться читаемого status/result уже созданного Circle reconnect probe; второй probe не создавать.
7. После доказанной связи — один native Windows Server 2022 Circle gate на тех же product bytes через disposable `ci/qwen-final-gate`, locked install + полный offline suite, без provider/live/secrets/production.
8. Затем PowerShell owner-doctor: prerequisites/Node, локальный старт, offline/self-test, session/restart/tool-result/subagent smoke; harness должен пройти native Windows Circle и вывести `QWEN_WINDOWS_READY` либо первый blocker.
9. Только после этого и при отсутствии серьёзных RED ставить `QWEN_CORE_DONE`.

Полный exact-tree Linux `npm test` в этом запуске НЕ заявляется.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Exact QWEN_CORE `LATEST/PREVIOUS` и normative runtime paths в доступном control tree снова не удалось надёжно разрешить. Новый pointer не публиковался: guessed path, pseudo-v4 и force-write запрещены. Новое состояние долговечно закреплено product commits + handoff + issue #9.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions = 0. Circle новых запусков = 0.
