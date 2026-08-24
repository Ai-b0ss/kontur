# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~05:00 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE targeted cluster GREEN на этих же product bytes; Core claim RELEASED (`kontur#9` `5389617186`, `5389617801`).
- QWEN_RELIABILITY targeted cluster GREEN на этих же product bytes.
- Первый полный offline Linux `npm test` на этих exact product bytes завершился FAILURE. Windows запрещён.
- Сейчас разрешена только локализация первого реального failing command без изменения product bytes/suite order.

## SAME-SHA Reliability proof — PASS

Disposable PR #52:
- base/product SHA: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head: `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`;
- единственное отличие: `.circleci/config.yml`;
- Circle `ci/circleci: qwen-reliability-targeted` = SUCCESS;
- workflow `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`;
- job `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`.

Locked `npm ci` + owned account/cooldown/bounded-failover/provider-circuit/replay cluster green. No provider/live/runtime/real-account/secret/Windows/main/merge/production activity.

## SAME-SHA Core proof — PASS

Exact product SHA `47d9ed079...`:
- recovery cluster SUCCESS: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- complete QWEN_CORE targeted cluster SUCCESS: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

Таким образом prerequisite Core+Reliability green on one exact SHA был честно закрыт до full Linux.

## Full Linux gate — FAIL

Disposable PR #53:
- base/product SHA: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`;
- changed file only `.circleci/config.yml` (+1/-1 branch filter);
- locked `npm ci` -> ordinary full `npm test`;
- Circle `ci/circleci: qwen-final-offline` = FAILURE;
- workflow `4451b136-5ec8-4850-8b88-a247975330c0`;
- job `036685d8-5e46-4583-953d-7cbcea25d2e7`.

Следствие: Windows Server 2022 gate ЗАПРЕЩЁН до нового full Linux PASS на одной свежей версии. Нельзя чинить наугад: сначала первый failing ordinary command.

## First-failure localization — WAIT_VERIFY

Disposable PR #54:
- base/product SHA `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head `1024afa5df3ffdf7a9ae638ca6f3c973f7363bd3`;
- compare подтверждает ровно один изменённый файл: `.circleci/config.yml`;
- диагностический config сохраняет исходный порядок `package.json#scripts.test` и запускает cumulative prefixes 40/80/120;
- purpose: сузить первый failure, не меняя product/tests и не полагаясь на отдельные standalone тесты, которые могут не воспроизводить stateful suite failure;
- last observed GitHub combined statuses: `[]` — это НЕ PASS/FAIL и не повод запускать дубль.

Current narrow claim in `kontur#9`: `5389822457`; heartbeat `5389835514`. Если Circle status для PR #54 так и не появится, следующий worker сначала проверяет именно этот commit/status, а не создаёт новую диагностику автоматически.

## Safety / next gate

1. Fresh-read PR#6 head. При drift от `47d9ed079...` вся current-head диагностика stale-stop.
2. Harvest PR #54 statuses if they appear. По prefix bracket локализовать первый failing ordinary command минимальным следующим prefix diagnostic, если нужен.
3. Только после точного root cause — минимальный product/test fix в соответствующей owner zone + targeted neighbor checks.
4. Core+Reliability снова должны быть green на одном новом stable SHA.
5. Ровно один новый full Linux `npm test`.
6. Только Linux PASS -> один native Windows Server 2022 full на идентичных product bytes.

Circle connectivity уже доказана; reconnect не повторять. Pending CI не дублировать. `RUNTIME_STATE_KEY`/Cloudflare key для offline gates не нужны. No live Qwen/provider traffic, real-account mutation, secrets, direct-main, merge, production or CAS bypass.

## v4 / CAS

Новая нормативная capsule не публиковалась. Existing verified pointer не force-write; durable truth сохранена этим handoff + `kontur#9` + exact Git/Circle evidence.
