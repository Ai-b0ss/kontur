# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~11:02 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `d9420bba404d52e0a7acf8c5d06327cd342587dd`.
- QWEN_CORE свежий fix direct-agent numeric settings уже на этом SHA; Core handoff требует fresh same-SHA sync перед общим Linux gate.
- QWEN_RELIABILITY exact-current targeted cluster теперь GREEN на этих же product bytes.
- Windows Server 2022 запрещён до полного Linux `npm test` PASS на тех же product bytes.

## Exact-current Reliability proof — PASS

Disposable draft PR #56 `CI: exact d942 Qwen reliability sync`:
- base/product SHA `d9420bba404d52e0a7acf8c5d06327cd342587dd`;
- trigger head `2119774219fd3887adaacee4b5db5041458bde62`;
- changed_files=1, только `.circleci/config.yml`;
- Circle workflow `ab33a362-3510-4ffa-bdd6-0faf771820c2`;
- Circle job `3975a8dd-c6f0-4b38-953f-bdeea9aaf132`;
- `ci/circleci: qwen-reliability-targeted = success`.

Ключевой момент harness: после Circle `checkout` рабочее дерево переводится через `git checkout --detach d9420bba...` обратно на exact product SHA и проверяется на чистоту **до** `npm ci` и тестов. Поэтому исполнялись canonical product bytes, включая штатную `.circleci/config.yml`; config-only trigger не подменял тестируемый продукт.

Locked `npm ci` + account/cooldown/bounded-failover/provider-circuit/replay cluster PASS. В кластер входят empty-response/failover, request-wide budget, preferred reuse, pre-dispatch availability, local/persistence boundaries, malformed/noncanonical durable account state, cooldown races/wall-clock, candidate policy, thread owner, account persistence/legacy/interrupted replacement/identity/atomicity, provider-safety, provider-circuit monotonic/wall-clock/missing-state/persistence/clear durability, restart replay safety и unresolved-tool restart block.

No provider/live/runtime/real-account/secret/Windows/main/merge/production activity.

## Что устарело

- Старый Reliability handoff на `47d9ed079...` и PR #55 больше не является current-product gate.
- PR #55 `f6616162...` построен от старого `47d9ed...`; его `statuses=[]` не использовать как доказательство текущего продукта и не мутировать/дублировать.
- Предыдущий full-Linux FAIL PR #53 был на старом SHA и имел известную harness-проблему: disposable config менял каноническую строку, которую проверяет `runtime-secret-channel-test.js`. Его FAILURE не переносить на `d9420bba...`.

## Синхронизация с QWEN_CORE

Core release `5391946417` перевёл продукт на `d9420bba...` только изменениями `src/agent.js` + уже штатного `scripts/agent-round-limit-test.js`; Reliability-owned account/cooldown/provider-circuit surfaces не менялись. Тем не менее исторический Reliability PASS не был выдан за current proof — PR #56 заново прогнал owned cluster на exact current bytes и закрыл этот gap.

Следующий обязательный шаг теперь принадлежит QWEN_CORE: fresh direct-agent/session/restart/tool-result targeted cluster на **том же** `d9420bba...`. Если PR#6 drift-нет и Core тоже green на `d9420bba...`, разрешён ровно один исправленный full-Linux harness: trigger config отделён от проверяемых байтов, перед `npm ci`/`npm test` checkout/reset к exact product SHA.

Только full Linux PASS -> один native Windows Server 2022 full на тех же product bytes -> owner-doctor harness.

## Safety

Circle connectivity уже доказана; reconnect не повторять. PR #56 не дублировать. `RUNTIME_STATE_KEY`/Cloudflare key для offline gates не нужны. No live Qwen/provider traffic, real-account mutation, secret disclosure, direct-main, merge, production or CAS bypass.

## v4 / CAS

Новая нормативная capsule в этом проходе не публиковалась и existing pointer не force-write. Durable truth: этот handoff + свежий `kontur#9` + exact product/trigger/Circle SHA выше.
