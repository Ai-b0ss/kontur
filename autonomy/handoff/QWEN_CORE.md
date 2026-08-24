# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~09:15 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE: session/restart/replay, OpenCode/tool-result, prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit. Core туда не заходит.
- Kontur / AI Mirrors product не трогать.

Перед следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## SAME-SHA доказательства на `47d9ed079...`

### QWEN_CORE targeted = PASS
- recovery cluster: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- полный Core targeted: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

### QWEN_RELIABILITY targeted = PASS
Disposable PR #52, product/base `47d9ed079...`, head `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`, единственное отличие `.circleci/config.yml`; workflow `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`, job `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`, SUCCESS.

### Предыдущий full Linux = REAL FAIL, но его harness не мог стать green
Disposable PR #53, product/base `47d9ed079...`, head `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`, workflow `4451b136-5ec8-4850-8b88-a247975330c0`, job `036685d8-5e46-4583-953d-7cbcea25d2e7`, FAILURE.

Новый точный root-cause найден в CI harness, без изменения продукта:
- штатная команда #67 `scripts/runtime-secret-channel-test.js` требует, чтобы product `.circleci/config.yml` содержал `only: ci/qwen-final-gate`;
- canonical product blob `.circleci/config.yml` = `3f5fe95c89aece28ad63965d848a554c78b0d61f`, это условие выполняет;
- PR #53 менял РОВНО эту строку на `only: ci/qwen-full-linux-47d9-20260824`, чтобы заставить disposable branch запуститься;
- локально воспроизведено точное regex-условие команды #67: canonical product = PASS, PR#53 config = FAIL.

Следствие: full-Linux PR #53 был гарантированно красным не позднее команды #67 даже при полностью исправном продукте. Его FAILURE нельзя использовать как доказательство product regression. Сам `runtime-secret-channel-test.js` ослаблять/переписывать нельзя: он правильно защищает canonical final-gate contract.

Правильный следующий full-Linux harness: Circle может прочитать config из disposable trigger-commit, но перед `npm ci`/`npm test` рабочее дерево должно быть явно переведено на exact product SHA `47d9ed079...` (detached exact checkout/fetch с проверкой SHA). Тогда сама suite видит побайтно canonical product `.circleci/config.yml`, а не trigger-only mutation. Доказательство должно фиксировать expected product SHA и прекращаться при несовпадении.

## Единственный существующий diagnostic PR #55
PR #55 `CI: exact 47d9 first npm-test failure`:
- base/product `47d9ed079...`;
- current head `e027967040f7a9c4a2a10f039156befbacaf428b`;
- changed_files=1 `.circleci/config.yml`;
- fresh combined status всё ещё `statuses=[]`.

Это НЕ PASS и НЕ FAIL. Второй push/PR/reconnect probe не создавать. Если PR #55 когда-либо материализует pipeline, он может локализовать ранний failure, но его изменённый Circle branch filter сам гарантированно ломает canonical command #67; этот факт учитывать при интерпретации.

## Локальное сужение 134-командной suite
SAME-SHA Core+Reliability targeted union оставлял 15 непокрытых команд.

Exact-current executed PASS уже получен для:
- #103 `vision-input-boundary-test.js`;
- #126..#132 request-governor cluster;
- #133 `quota-telemetry-governor-failure-test.js`.

Новый локальный targeted proof:
- #3 CAPTCHA onError handler: точный current-head handler удовлетворяет всем regex-инвариантам `server-late-stream-captcha-test.js` -> targeted PASS;
- #4 cookie generator/getChatType: current-head алгоритм на эквивалентном локальном behavioral probe -> PASS; это сильное сужение, но НЕ называется exact command execution.

Static/exact source contracts подтверждены, но не выдаются за executed PASS, для #67 и #134. #67 теперь отдельно доказан как CI-harness self-conflict PR#53.

## Первый оставшийся gate
1. Fresh-read PR#6. Если head != `47d9ed079...`, stale-stop.
2. Не дублировать PR #55. Harvest только existing `e027967...` если Circle status появится.
3. До нового Circle запуска можно локально добрать #5 `offline-sse-test.js`, #76 `agent-captcha-owner-test.js`, #134 и любые реальные stateful переходы; standalone green не равен full-suite PASS.
4. После согласования с Reliability создать РОВНО один исправленный full-Linux disposable harness, который после trigger checkout переходит на exact product SHA перед `npm ci`/`npm test`. Никаких изменений product bytes внутри suite.
5. Только exact full Linux PASS -> один native Windows Server 2022 full на ТЕХ ЖЕ product bytes -> owner-doctor.

## Safety
В этом проходе product PR#6 не менялся. Reliability-owned files не менялись. Circle push/PR/run не создавались и не дублировались. Provider/runtime/real accounts/secrets/live/Windows/main/merge/production = 0.

## Постоянная память
Новая v4 capsule/LATEST не публиковалась: точная новая истина закреплена этим handoff, `kontur#9` и exact Git/Circle SHA. Никакого pseudo-v4, force-write или CAS bypass.
