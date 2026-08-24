# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~13:55 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `a658eec49dfb353f53fa5779347d446d8aaba950`.
- Drift от предыдущего общего `d9420bba...` — только Core-тест `scripts/server-late-stream-captcha-test.js`: исправлена CRLF-переносимость старого Windows harness; product/server/Reliability code не менялся.
- Исторический Windows PR #59 относится только к `d9420bba...`; его FAIL локализован к CRLF-чувствительности команды #3 и не переносится на текущий head.

## Exact-current Reliability proof — PASS

Disposable draft PR #61 `CI: exact a658 Qwen reliability sync`:
- base/product SHA `a658eec49dfb353f53fa5779347d446d8aaba950`;
- trigger head `129fd53517c93ab386f5cb929e2b38ecf595e672`;
- changed_files=1, только `.circleci/config.yml`;
- job после Circle checkout переключает рабочее дерево на detached exact product SHA и проверяет clean worktree до `npm ci`/tests;
- Circle `ci/circleci: qwen-reliability-targeted = success`;
- workflow `b44094d9-3ae6-4d69-b79c-988bad628936`;
- job `7469c06f-c981-45d3-b014-7cb33b3510e7`.

Locked `npm ci` + owned Reliability cluster PASS: account pool/candidates/cooldown/CAPTCHA, bounded failover/retry, preferred/current/thread affinity, provider-wide circuit, persistence/durability, restart/replay and unresolved-tool side-effect safety.

No provider/live/runtime/real-account/secret/Windows/main/merge/production activity.

## Gate position

- QWEN_RELIABILITY GREEN on exact current `a658eec...`.
- Старые SAME-SHA Core/Linux доказательства на `d9420bba...` теперь historical после head drift, даже несмотря на test-only характер изменения.
- QWEN_CORE должен доказать текущий Core targeted cluster на **том же** `a658eec...`, включая исправленный `server-late-stream-captcha-test.js`.
- Когда Core + Reliability green на одном стабильном `a658eec...` (или свежем then-current SHA), разрешён ровно один corrected full Linux `npm test`: disposable trigger config отделён от проверяемых product bytes, перед install/test checkout/reset к exact product SHA.
- Только current-head full Linux PASS -> один native Windows Server 2022 full на тех же product bytes -> owner-doctor harness.
- PR #59 не повторять и не расширять; он доказал причину старого Windows FAIL, но не current-head gate.

## Safety

Circle connectivity доказана; reconnect не повторять. `RUNTIME_STATE_KEY`/Cloudflare key для offline gates не нужны. No live Qwen/provider traffic, real-account mutation, secret disclosure, direct-main, merge, production or CAS bypass.

## v4 / CAS

Новая capsule/LATEST в этом проходе не форсировалась. Durable truth: этот handoff + свежий `kontur#9` + exact product/trigger/Circle SHA выше.
