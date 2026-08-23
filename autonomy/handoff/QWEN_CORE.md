# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `d6e843914078168ba2026c0c99746cfcd99fe480`.
- Контур и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет account/cooldown/provider-circuit; Core туда не заходит.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_CORE/QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## НОВЫЙ ЗАКРЫТЫЙ CORE-ДЕФЕКТ: top-level skills selector больше не выполняет неявное приведение типов

Fresh exact `src/skills.js` до исправления имел blob `378259c8eba2c7fdf0274b0243fb9700ec04a6d9` и делал `String(value || '').trim()` для `skills/skill_names/skillNames`.

На byte-exact materialization воспроизведено:
`QWEN_SKILL_SELECTOR_COERCION_REPRODUCED nested_array_selects_real_skill=1 object_toString_selects_real_skill=1 number_coerced=1 false_masks_as_absent=1`.

Опасные случаи:
- `skills: [['debug-repair']]` превращался в настоящее имя `debug-repair`;
- объект с пользовательским `toString()` мог выбрать настоящий skill;
- число `42` превращалось в строковое имя;
- `false` мог маскироваться как отсутствие выбора.

Root fix:
- `2b48fff7f04fbe230c00ab2b7b7a7037d30d5a64` — `src/skills.js` теперь принимает в списке только непустые строки; malformed selector -> `QWEN_SKILL_SELECTOR_INVALID`; top-level omitted/null/empty string остаются «skills не выбраны»; нормальные строки trim/dedupe сохраняют старую семантику.
- новый blob `src/skills.js`: `152aea285a449a4e94b96262bccf7b8bc9f7c500`.
- `5093df3a3b81e1b5cea75bcb02f41596aad984f2` — постоянный regression `scripts/skills-selector-type-validation-test.js`, blob `9810e3ae694040e21b18189847381fabab06862b`.
- `d6e843914078168ba2026c0c99746cfcd99fe480` — regression подключён в штатный `npm test`; `package.json` blob `521d904f4642465c5d97f756c8540174901d5c59`.

После записи exact GitHub bytes снова материализованы локально и сверены `git hash-object`; targeted PASS:
`QWEN_SKILL_SELECTOR_TYPE_VALIDATION_PASS malformed=6 absent=3 normalized=2`.

Соседний plain-subagent selector уже имеет собственную строгую границу (`QWEN_SUBAGENT_SKILL_INVALID`) и отдельный regression; этот фикс закрывает именно общий top-level skills path.

## CircleCI — текущая прямая политика владельца и reconnect probe

Прямое указание владельца этого запуска отменяет старый `[OWNER TEMPORARY CIRCLE FREEZE]` **только для Qwen с 2026-08-23**.

Разрешён ровно один дешёвый reconnect-probe до тяжёлого финального гейта. Он уже израсходован:
- disposable branch: `ci/qwen-reconnect-probe`;
- base product bytes: `8bd64b18551c1874b7f605908f4c70875250d2d8`;
- probe commit: `f1e70505751e1d6648758b289c57a60da9d9de3b`;
- job только `cimg/base:stable`, checkout, marker `QWEN_CIRCLE_RECONNECT_PASS`, `git rev-parse HEAD`; provider/live/secrets = 0.

GitHub combined status перечитан несколько раз после trigger; каждый раз `statuses=[]`.

Классификация: `CIRCLE_RECONNECT_UNPROVEN`, НЕ PASS. По прямому правилу владельца:
- второй reconnect-probe сейчас не запускать;
- тяжёлый final Linux/Windows Circle gate не запускать;
- `statuses=[]` не считать доказательством выполнения;
- когда появится читаемый status/result для уже созданного probe, только тогда разрешён обычный финальный gate.

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

Текущий проход после `8bd64b...` менял только Core skills + новый regression + `package.json` wiring. `session-store.js`, `server.js`, `chat-adapter.js`, `agent.js`, account/cooldown/provider-circuit и `package-lock.json` этим исправлением не менялись.

## QWEN_RELIABILITY — свежая граница
Fresh handoff всё ещё сообщает:
- account/cooldown/index/filename: 8/8 exact targeted PASS;
- provider-circuit: 7/8 exact targeted PASS;
- единственный proof gap: exact `node scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios` 1.19.0; shim/reconstructed dependency tree не принимаются.

В этом проходе Replit `PortlyEdibleMonads` был запрошен строго read-only на наличие exact checkout + locked tree; запрос снова завершился timeout. Никакого PASS не приписывается. Hosted container по-прежнему не имеет готового locked npm tree.

## Что осталось до DONE
1. Fresh stable common product SHA.
2. Core targeted cluster на том же SHA: session/restart/stale-backup/pending-tool/tool-result + owner/system modes + plain/coding subagents + skills + stream/tool gates.
3. Reliability exact `provider-safety-test.js` и её targeted cluster на том же SHA.
4. Full exact-tree Linux `npm test` на этом SHA.
5. Дождаться читаемого GitHub status/result уже созданного Circle reconnect probe; не создавать второй probe.
6. После доказанной связи — один native Windows Server 2022 Circle gate на тех же product bytes через disposable `ci/qwen-final-gate`, locked install + полный offline suite, без provider/live/secrets/production.
7. Затем простой PowerShell owner-doctor: prerequisites/Node, локальный старт, offline/self-test, session/restart/tool-result/subagent smoke; сам harness должен пройти native Windows Circle и вывести `QWEN_WINDOWS_READY` либо первый blocker.
8. Только при отсутствии незакрытого серьёзного воспроизводимого дефекта ставить `QWEN_CORE_DONE`.

Полный exact-tree Linux `npm test` в этом проходе НЕ заявляется.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Новый pointer сейчас не опубликован: точные repository paths для QWEN_CORE `LATEST/PREVIOUS` и normative runtime по доступной поверхности всё ещё не разрешены надёжно. Guessed path, pseudo-v4 и force-write запрещены. Новое состояние долговечно закреплено product commits + этим handoff + issue #9.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions = 0. Circle использован только для одного дешёвого reconnect probe; его выполнение через GitHub status пока не доказано.
