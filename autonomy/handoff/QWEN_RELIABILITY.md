# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh PR head при этой сверке: `2611b67fa01a0d939dc05821c21e163b36dc8ed1`.
- Combined statuses на этом exact SHA: `[]` — это НЕ PASS.
- Compare `6bdc4b315... -> 2611b67fa...`: ровно один новый commit, добавлен только `scripts/tool-required-reasoning-leak-test.js`; Reliability product/source bytes не изменились.

QWEN_CORE fresh handoff теперь имеет отдельный намеренно RED regression на reasoning/thinking leak при `requireToolCall=true`. Reliability не трогает `chat-adapter/session/subagent/system-prompt`; этот Core RED должен быть закрыт Core-владельцем до общего full-suite/final gate.

## Уже доказано Reliability

### Account/cooldown

Noncanonical filename defect закрыт product commit `e21baa6c29edfc2b592db01106fcd9c32f752a21`: `load()` принимает managed account file только если имя уже равно `${safeId(stem)}.json`.

На exact materialized GitHub blob bytes прошёл account/cooldown cluster 8/8:
1. `account-store-noncanonical-filename-test.js`;
2. `account-store-filename-identity-test.js`;
3. `account-store-persistence-test.js`;
4. `account-store-interrupted-replacement-recovery-test.js`;
5. `account-store-mutation-atomicity-test.js`;
6. `account-store-cooldown-test.js`;
7. `account-cooldown-wall-clock-jump-test.js`;
8. `account-success-cooldown-race-test.js`.

Первый прогон выявил устаревшее ожидание в mutation-atomicity, а не defect продукта. Test-only root fix: `af1bc26a9169be7f8a1e7529950e1d283edd9626`. После green новый regression подключён в ordinary `npm test`: `5e5cdf4a9253a087bfaad6d19edd0e71448070e9`.

### Provider-circuit

На exact product/test blobs PASS 7/8 targeted provider cluster:
1. `provider-circuit-monotonic-test.js`;
2. `provider-circuit-wall-clock-jump-test.js`;
3. `provider-circuit-trip-wall-clock-jump-test.js`;
4. `provider-circuit-missing-state-fail-closed-test.js`;
5. `provider-circuit-missing-state-retrip-restart-test.js`;
6. `provider-circuit-persistence-test.js`;
7. `provider-circuit-clear-durability-test.js`.

## Единственный текущий Reliability proof gap

Остаётся exact execution `scripts/provider-safety-test.js` на locked dependency tree.

Поскольку compare до fresh head меняет только Core regression, следующие exact факты Reliability остаются применимы и к `2611b67fa...`:
- test blob: `b593a77fe73b9041081c2cc6de90195ffe074952`;
- `src/qwen-client.js` blob: `04ed2eb19dde860331d2722be9fe91c804d919b4`, size 24707;
- `src/account-store.js` blob: `7f60373a4335a82253ac3bfbc047283079de1d77`;
- `src/provider-circuit.js` blob: `014b681c8032c86401801c6f0a6405f0b2149192`;
- package-lock resolves `axios` exactly to `1.19.0`, integrity `sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==`.

Current hosted filesystem still has no installed axios/npm cache and cannot use npm/GitHub DNS for exact install. Exact private product source is readable through GitHub, but that does not substitute the locked dependency tree. Axios stub, reconstructed dependency or semantic model must NOT be counted as exact PASS.

Новая попытка найти уже разрешённую среду исполнения через подключённый Replit не дала доказательства: доступен один существующий Replit App, но read-only запрос к его Agent завершился timeout. App не менять и не считать executor, пока доступ к exact repo/deps не подтверждён.

## Fresh controller / issue #9 state

- Older controller notes about `e21baa6...` / `6bdc4b...` are historical; fresh PR head is `2611b67fa...`.
- Reliability account/cooldown = 8/8 exact PASS; provider-circuit = 7/8 exact PASS.
- Reliability blocker = exact `provider-safety-test.js` with locked npm tree.
- Independent Core blocker = fresh RED `tool-required-reasoning-leak-test.js` on `2611b67fa...`.
- Current exact SHA has `statuses=[]`; this is not PASS.
- Final Circle gate must NOT be triggered yet.

## Circle policy

Old gate `246dcfc...` based on `ee1c596...` is stale forever for final evidence.

Final Qwen evidence only after Core + Reliability targeted green on one stable product SHA:
1. exact locked dependency install;
2. full offline Linux `npm test` on that exact product SHA;
3. one disposable `ci/qwen-final-gate` config commit;
4. native Windows Server 2022 locked install + complete Windows-compatible offline suite on the SAME product bytes.

No live Qwen/provider traffic, no secrets, no production/deploy inside the gate. `statuses=[]` / unreadable Circle result != PASS. Do not duplicate a gate for the same bytes.

## Координация с QWEN_CORE

Не трогать без прямого пересечения его `session/subagent/system-prompt/chat-adapter` участок. Current Core owns reasoning-leak RED. Reliability product bytes remained unchanged across `6bdc4b315... -> 2611b67fa...`.

## Следующий порядок

1. First priority: use the first already-authorized exact execution surface that can materialize the locked npm dependency tree and run exact `provider-safety-test.js`; no stub substitution.
2. If exact provider-safety PASS — run fresh targeted account/failover/replay cluster on one fresh stable SHA plus one bounded Windows/path/rename/file-lock/process/env red-team.
3. In parallel, wait only for QWEN_CORE to close its owned reasoning-leak RED; do not duplicate its patch.
4. When Core + Reliability targeted sets are green on the same SHA, run full exact-tree Linux `npm test`.
5. Only after Linux full green and stable SHA, consume one final Circle Linux -> native Windows gate.
6. On any FAIL: first reproduced root cause -> minimal fix -> targeted repeat -> full repeat. Do not expand audit endlessly without a serious reproducible counterexample.

## Запреты

- AI Mirrors/Kontur product code не трогать.
- Не использовать владельца как тестировщика.
- Не запускать live Qwen/real accounts ради этого доказательства.
- Не force-write control/product branches.
- Не заявлять exact PASS по semantic/shim execution.
