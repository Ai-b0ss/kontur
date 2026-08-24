# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~08:55 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE targeted cluster GREEN на этих же product bytes.
- QWEN_RELIABILITY targeted cluster GREEN на этих же product bytes.
- Exact full offline Linux `npm test` на этих же product bytes имеет настоящий FAILURE (PR #53). Windows Server 2022 запрещён до нового full Linux PASS на идентичных product bytes.
- Продукт сейчас не мутировать наугад: нужен первый реально упавший ordinary `npm test` command.

## SAME-SHA Reliability proof — PASS

Disposable PR #52:
- base/product SHA `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`;
- единственное отличие `.circleci/config.yml`;
- Circle `ci/circleci: qwen-reliability-targeted` = SUCCESS;
- workflow `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`;
- job `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`.

Locked `npm ci` + account/cooldown/bounded-failover/provider-circuit/replay cluster green. No provider/live/runtime/real-account/secret/Windows/main/merge/production activity.

## SAME-SHA Core proof — PASS

Exact product SHA `47d9ed079...`:
- recovery cluster SUCCESS: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- complete QWEN_CORE targeted cluster SUCCESS: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

## Full Linux gate — REAL FAIL

Disposable PR #53:
- base/product SHA `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`;
- only `.circleci/config.yml` differs;
- locked `npm ci` -> ordinary full `npm test`;
- Circle `ci/circleci: qwen-final-offline` = FAILURE;
- workflow `4451b136-5ec8-4850-8b88-a247975330c0`;
- job `036685d8-5e46-4583-953d-7cbcea25d2e7`.

## Единственная актуальная first-failure диагностика — PR #55

PR #54 устарел как control-plane surface и НЕ должен быть восстановлен.

Disposable PR #55 `CI: exact 47d9 first npm-test failure`:
- base/product `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- current head `e027967040f7a9c4a2a10f039156befbacaf428b`;
- branch `ci/qwen-first-failure-47d9-20260824`;
- changed_files=1, только `.circleci/config.yml`;
- config читает обычный `package.json#scripts.test`, запускает команды строго по порядку и при первом ненулевом коде пишет `QWEN_FIRST_FAILURE index=... status=... command=...`;
- после первого config commit был сделан ровно один harmless config-only push `e027967...` для настоящего push-event;
- PR открыт, branch существует, branch filter в config точно совпадает с именем ветки;
- fresh combined status `e027967...` по-прежнему `statuses=[]`; PR comments пусты.

Это НЕ PASS и НЕ FAIL. Второй diagnostic / push / reconnect probe не создавать.

### Что нового установлено про `statuses=[]`

- Circle connectivity уже доказана owner-policy (`5c7a2aeb...`, reconnect-probe success); не проверять её заново.
- PR #52 на том же репозитории и той же product-base успешно запускался через аналогичный branch-filtered config, поэтому сам паттерн disposable branch + `.circleci/config.yml` рабочий.
- Config PR #55 синтаксически обычный Circle 2.1 и branch filter совпадает с `ci/qwen-first-failure-47d9-20260824`.
- Git commit `e027967...` — настоящий новый commit на этой ветке, не branch-creation-only event.
- По актуальной документации Circle trigger создаётся на уровне Project Settings / GitHub event; branch/job filters в `.circleci/config.yml` управляют уже созданной pipeline/workflow. Поэтому отсутствие GitHub status само по себе не доказывает ошибку теста или config execution. Текущая недоказанная граница — Circle-side trigger/pipeline/status-reporting для именно этого existing push.
- У доступного GitHub-коннектора нет Circle pipeline-list API, поэтому нельзя честно различить `pipeline не создан` и `pipeline создан без VCS status` только по `statuses=[]`.

## Локальное сужение full-Linux FAIL от QWEN_CORE

Обычный `npm test` на exact `47d9ed...` содержит 134 команды. SAME-SHA Core+Reliability targeted union оставлял 15 непокрытых команд.

Exact-current executed PASS уже получен для:
- #103 `vision-input-boundary-test.js`;
- #126..#132 request-governor cluster;
- #133 `quota-telemetry-governor-failure-test.js`.

Exact static contracts подтверждены, но не выдаются за execution PASS, для:
- #3 `server-late-stream-captcha-test.js`;
- #67 `runtime-secret-channel-test.js`;
- #134 `long-soak-policy-test.js`.

Оставшаяся интересная поверхность без full ordered proof включает ранние команды вроде #4 `test-cookies.js`, #5 `offline-sse-test.js`, #76 `agent-captcha-owner-test.js` и возможную межтестовую зависимость состояния. Standalone PASS не равен full-suite PASS.

## Следующий gate

1. Fresh-read PR#6 head. При drift от `47d9ed079...` stale-stop и перестроить план.
2. Harvest только existing PR #55 head `e027967...`.
3. Если terminal Circle result появится — взять `QWEN_FIRST_FAILURE index=...` и чинить только первый воспроизводимый root cause в соответствующей owner zone.
4. Если status остаётся пустым — не делать ещё один push/PR. Нужна Circle-side inspection именно existing branch/pipeline trigger state; GitHub-side config/branch mismatch уже исключён.
5. После root fix Core+Reliability снова должны быть green на одном новом stable SHA.
6. Ровно один новый full Linux `npm test`.
7. Только full Linux PASS -> один native Windows Server 2022 full на тех же product bytes -> owner-doctor.

## Safety

Circle reconnect не повторять. Pending/existing CI не дублировать. `RUNTIME_STATE_KEY`/Cloudflare key для offline gates не нужны. No live Qwen/provider traffic, real-account mutation, secret disclosure, direct-main, merge, production or CAS bypass.

## v4 / CAS

Новая нормативная capsule в этом проходе не публиковалась. Existing verified pointer не force-write. Durable truth: этот handoff + свежий `kontur#9` + exact Git/Circle SHA.
