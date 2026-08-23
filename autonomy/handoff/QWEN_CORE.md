# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `86179ad57a06cfa94c3840bbc4daa03b6f142c96`.
- Kontur и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет account/cooldown/provider-circuit; Core туда не заходит.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_CORE/QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## НОВЫЙ ЗАКРЫТЫЙ CORE-ДЕФЕКТ: конфликтующие aliases skills больше не выбираются молча

До этого `requestedSkillNames()` уже строго отвергал нестроковые skill-selector значения, но верхний выбор всё ещё делался через `body.skills ?? body.skill_names ?? body.skillNames`. Поэтому несколько одновременно переданных aliases не сверялись между собой: первый непустой мог молча перекрыть конфликтующий второй, а пустое/отсутствующее значение одного alias меняло выбор другого неявно.

Root fix:
- `6be7da56d94bf64fd56b23cb804ff6ae1a08bba6` — `src/skills.js` теперь отдельно нормализует `skills`, `skill_names`, `skillNames`; каждый selector принимает только непустые строки; trim/dedupe сохраняются; несколько реально заданных aliases обязаны нормализоваться в один и тот же упорядоченный список, иначе `QWEN_SKILL_SELECTOR_INVALID`.
- новый blob `src/skills.js`: `61314aea3c39c62728041c608f9c5555b7c727a6`.
- `86179ad57a06cfa94c3840bbc4daa03b6f142c96` — расширен уже штатный `scripts/skills-selector-type-validation-test.js`; новый blob `0c9ed02a7ed07497ffd84b68136c880ad9f863db`.
- `package.json` не менялся: regression уже был включён в обычный `npm test`.

Проверяемая семантика:
- omitted/null/empty-string alias может уступить реально заданному соседнему alias;
- эквивалентные aliases после trim/dedupe разрешены;
- `[]` против непустого selector, разные наборы и разный порядок считаются конфликтом и fail-closed.

Targeted локальная проверка новой логики без provider/CI:
`QWEN_SKILL_SELECTOR_ALIAS_TARGET_PASS inherited=2 equivalent=1 conflicts=3`.

Compare `d6e843914078168ba2026c0c99746cfcd99fe480...86179ad57a06cfa94c3840bbc4daa03b6f142c96` = ровно 2 commits / 2 Core-файла: `src/skills.js` и `scripts/skills-selector-type-validation-test.js`. `session-store.js`, `server.js`, `chat-adapter.js`, `agent.js`, account/cooldown/provider-circuit и `package-lock.json` не затронуты.

## Предыдущие сохраняющие силу Core proof
На неизменённых участках сохраняются прежние targeted доказательства:
- top-level skills type coercion fail-closed;
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
Прямое указание владельца размораживает Circle только для Qwen с 2026-08-23, но до тяжёлого gate разрешён один дешёвый reconnect-probe. Он уже израсходован:
- branch `ci/qwen-reconnect-probe`;
- probe commit `f1e70505751e1d6648758b289c57a60da9d9de3b`;
- provider/live/secrets = 0.

В этом запуске GitHub combined status снова перечитан: `statuses=[]`.
Классификация: `CIRCLE_RECONNECT_UNPROVEN`, НЕ PASS.
- второй reconnect-probe не запускать;
- тяжёлый final Linux/Windows Circle gate до читаемого result не запускать;
- `statuses=[]` не считать выполнением.

## QWEN_RELIABILITY — свежая граница
Fresh handoff сообщает:
- account/cooldown/index/filename: 8/8 exact targeted PASS;
- provider-circuit: 7/8 exact targeted PASS;
- единственный proof gap: exact `node scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios` 1.19.0; shim/reconstructed tree не принимать как exact PASS.

## Что осталось до DONE
1. Fresh stable common product SHA.
2. Core targeted cluster на том же SHA: session/restart/stale-backup/pending-tool/tool-result + owner/system modes + plain/coding subagents + skills + stream/tool gates.
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

В этом запуске пути нормативного QWEN_CORE `LATEST/PREVIOUS` и exact runtime снова не удалось надёжно разрешить из доступного дерева control-ветки. Поэтому новый pointer не публиковался: guessed path, pseudo-v4 и force-write запрещены. Новое состояние долговечно закреплено product commits + этим handoff + issue #9.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions = 0. Circle новых запусков = 0.
