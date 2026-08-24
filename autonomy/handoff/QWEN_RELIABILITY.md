# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~04:55 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE targeted cluster GREEN на этих же product bytes; Core claim RELEASED (`kontur#9` comments `5389617186`, `5389617801`).
- QWEN_RELIABILITY targeted cluster также GREEN на этих же product bytes.
- Следующий gate уже запущен: ровно один полный offline Linux `npm test`; Windows запрещён до его PASS на тех же product bytes.

## SAME-SHA Reliability proof — PASS

Disposable PR #52:
- base/product SHA: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head: `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`;
- единственное отличие: `.circleci/config.yml`;
- Circle context: `ci/circleci: qwen-reliability-targeted`;
- workflow: `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`;
- job: `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`;
- result: `SUCCESS`.

Job использовал Node 22.23.1, locked `npm ci --ignore-scripts --no-audit --no-fund`, затем полный owned Reliability cluster: account/cooldown, bounded failover, preferred/current и thread affinity, persistence boundaries, provider-wide circuit, restart/replay и unresolved-tool fail-closed.

Никаких provider/live/runtime/real-account/secret/Windows/main/merge/production действий не было.

## SAME-SHA Core synchronization — PASS

На exact product SHA `47d9ed079...` QWEN_CORE уже имеет полный targeted PASS:
- recovery cluster workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- complete Core targeted workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

Следовательно prerequisite `Core + Reliability green on one exact SHA` закрыт.

## Full Linux gate — IN FLIGHT

Disposable PR #53:
- base/product SHA: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- head: `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`;
- единственное отличие: `.circleci/config.yml` (branch filter for this disposable gate);
- job: locked `npm ci` -> full offline `npm test`;
- Circle context: `ci/circleci: qwen-final-offline`;
- workflow: `4451b136-5ec8-4850-8b88-a247975330c0`;
- job: `036685d8-5e46-4583-953d-7cbcea25d2e7`;
- last observed status: `PENDING`.

Не запускать дубль этого Linux gate. При PASS сначала fresh-read PR#6 head; если он всё ещё `47d9ed079...`, разрешён ровно один native Windows Server 2022 full offline gate на идентичных product bytes. При FAIL — Windows запрещён; локализовать только первый реальный failing command.

## Circle / safety policy

- Circle connectivity уже доказана; не тратить прогоны на reconnect.
- Disposable offline Circle ветки/PR могут отличаться от exact product только `.circleci/config.yml`.
- Pending CI не дублировать.
- `RUNTIME_STATE_KEY`/Cloudflare key для offline gates не нужны.
- No live Qwen/provider traffic, real-account mutation, secret disclosure, direct-main, merge, production or CAS bypass.

## v4 / CAS

Новый нормативный capsule в этом проходе пока не публиковался. Existing verified pointer не force-write. Durable truth: этот handoff + `kontur#9` + exact Git/Circle evidence.
