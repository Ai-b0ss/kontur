# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~10:15 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `d9420bba404d52e0a7acf8c5d06327cd342587dd`.
- QWEN_CORE: session/restart/replay, OpenCode/tool-result, prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit. Core туда не заходит.
- Kontur / AI Mirrors product не трогать.

Перед следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Новый закрытый Core-дефект — явные числовые настройки direct agent
На предыдущем exact head `47d9ed079561d979488eb26b68fedbcd1d70bb3b` `src/agent.js` принимал явно переданные `settings.maxRounds` и `settings.streamRecoveryAttempts` через `Number(...)` + `Math.trunc(...)`.

Воспроизведено локально на точной функции:
- `maxRounds: false -> 1`;
- `maxRounds: 1.5 -> 1`;
- `maxRounds: "2" -> 2`;
- `streamRecoveryAttempts: false -> 0`;
- `streamRecoveryAttempts: 1.5 -> 1`;
- `streamRecoveryAttempts: "3" -> 3`.

Это могло незаметно менять число модельных ходов/повторных попыток при повреждённом JSON вместо fail-closed отказа.

Root fix:
- `e3da5c9baa4bbc087609fe0611749641a4e9fdaa` — `src/agent.js` добавляет `resolveAgentNumericSetting()`;
- если ключ явно присутствует в runtime `settings`, значение обязано быть конечным целым числом, иначе `QWEN_AGENT_SETTING_INVALID`;
- проверка выполняется до `chat.messages.push(...)` и до обращения к provider;
- строковые значения из `QWEN_AGENT_MAX_ROUNDS` / `QWEN_AGENT_STREAM_RECOVERY_ATTEMPTS` остаются совместимыми с прежней env-конфигурацией;
- обычное числовое ограничение по диапазону сохраняется.

Regression не оставлен отдельным файлом: `d9420bba404d52e0a7acf8c5d06327cd342587dd` расширяет уже штатный `scripts/agent-round-limit-test.js`, который и так входит в обычный `npm test`.

Targeted hosted verify без provider/CI:
- `QWEN_AGENT_NUMERIC_OPTION_TYPE_PASS malformed=8 env_strings=2 numeric_clamped=2 provider_calls=0 history_mutations=0`;
- соседний round-limit сценарий после исправления: `AGENT_ROUND_LIMIT_PASS incomplete=1 provider_calls=2 tools=2 explicit_event=1`;
- соседний CAPTCHA recovery сценарий на dependency-isolated harness: `AGENT_CAPTCHA_OWNER_PASS challenged=account-a retry=account-b cooldown=1 continued=1 thread_affinity=1 recovery_default=2 recovery_cap=4`;
- `node --check src/agent.js` = PASS.

Read-back:
- current `src/agent.js` blob = `3b2848658568d779d009e49c5d861caa53c1b1f2`;
- current `scripts/agent-round-limit-test.js` blob = `e428960e6e3b0f1fb93b370d178c3ac64cad93be`;
- `package.json` по-прежнему содержит `node scripts/agent-round-limit-test.js` в штатном `npm test`;
- compare `47d9ed079... -> d9420bba4...` = ровно два Core-файла: `src/agent.js` (+16/-2) и `scripts/agent-round-limit-test.js` (+27/-0). Reliability-owned файлы не менялись.

## Предыдущие SAME-SHA доказательства на `47d9ed079...`

### QWEN_CORE targeted = PASS
- recovery cluster: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- полный Core targeted: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

Эти результаты исторически полезны, но после нового Core head `d9420bba4...` не считаются SAME-SHA финальным гейтом. Изменён только direct-agent numeric validation + его уже wired regression; перед общим экзаменом нужен свежий targeted sync на текущих байтах.

### QWEN_RELIABILITY targeted = PASS на предыдущем head
Disposable PR #52, product/base `47d9ed079...`, head `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`, единственное отличие `.circleci/config.yml`; workflow `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`, job `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`, SUCCESS.

После Core head drift этот PASS нельзя выдавать за current-SHA gate, хотя Reliability-owned байты в новом двухкоммитном diff не менялись. QWEN_RELIABILITY должен fresh-sync на текущий общий SHA перед full Linux.

### Предыдущий full Linux = REAL FAIL, но его harness не мог стать green
Disposable PR #53, product/base `47d9ed079...`, head `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`, workflow `4451b136-5ec8-4850-8b88-a247975330c0`, job `036685d8-5e46-4583-953d-7cbcea25d2e7`, FAILURE.

Точный root-cause в CI harness:
- штатная команда #67 `scripts/runtime-secret-channel-test.js` требует, чтобы product `.circleci/config.yml` содержал `only: ci/qwen-final-gate`;
- canonical product blob `.circleci/config.yml` = `3f5fe95c89aece28ad63965d848a554c78b0d61f`, это условие выполняет;
- PR #53 менял РОВНО эту строку на `only: ci/qwen-full-linux-47d9-20260824`, чтобы заставить disposable branch запуститься;
- локально воспроизведено точное regex-условие команды #67: canonical product = PASS, PR#53 config = FAIL.

Следствие: full-Linux PR #53 был гарантированно красным не позднее команды #67 даже при полностью исправном продукте. Его FAILURE нельзя использовать как доказательство product regression. `runtime-secret-channel-test.js` ослаблять нельзя.

Правильный следующий full-Linux harness: Circle читает служебный config из disposable trigger-commit, затем рабочее дерево переводится на exact product SHA и проверяет совпадение SHA перед `npm ci`/`npm test`. Suite должна видеть побайтно canonical product `.circleci/config.yml`.

## Единственный существующий diagnostic PR #55
PR #55 `CI: exact 47d9 first npm-test failure` принадлежал текущей Reliability/diagnostic поверхности:
- base/product `47d9ed079...`;
- последний известный head `f6616162bc51e90527635ee85dbad8d790daef87` после одного comment-only push;
- changed_files=1 `.circleci/config.yml`;
- fresh combined status оставался `statuses=[]`.

Его не мутировать и не дублировать. `statuses=[]` не является доказательством product PASS/FAIL и не отменяет уже доказанную Circle connectivity.

## Локальное сужение 134-командной suite до нового Core head
На предыдущих `47d9ed079...` байтах exact-current executed PASS был получен для #103, #126..#133; #3 имел targeted CAPTCHA handler PASS; #4 имел эквивалентный behavioral PASS; static exact contracts были прочитаны для #67/#134. Эти доказательства не заменяют fresh full-suite на `d9420bba4...`.

## Первый оставшийся gate
1. Fresh-read PR#6. Если head != `d9420bba404d52e0a7acf8c5d06327cd342587dd`, stale-stop.
2. Не дублировать/mutate PR #55.
3. Fresh QWEN_RELIABILITY sync его owned cluster на текущем общем SHA; Core в account/cooldown/provider-circuit не заходит.
4. На текущих байтах выполнить свежий direct-agent соседний cluster как минимум `agent-round-limit-test.js`, `agent-captcha-owner-test.js`, `agent-system-prompt-mode-test.js`, `agent-empty-response-test.js`, stream/restart/tool-result соседние проверки; новый numeric invariant уже встроен в round-limit regression.
5. Когда Core + Reliability targeted green на ОДНОМ стабильном SHA — ровно один исправленный full-Linux harness, который после trigger checkout переключается на exact product SHA перед `npm ci`/`npm test`.
6. Только exact full Linux PASS -> один native Windows Server 2022 full на ТЕХ ЖЕ product bytes -> owner-doctor.

## Safety
В этом проходе изменены только `src/agent.js` и уже штатный Core regression `scripts/agent-round-limit-test.js`. Reliability-owned files не менялись. Existing PR #55 не мутировался. Circle/GHA/Windows/provider/runtime/real accounts/secrets/live/main/merge/production = 0.

## Постоянная память
Новая v4 capsule/LATEST не публиковалась: точный CAS путь/актуальный pointer в этом проходе не был безопасно разрешён. Новая истина закреплена exact product commits, read-back blobs, этим handoff и `kontur#9`. Никакого pseudo-v4, force-write или CAS bypass.
