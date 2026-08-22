# Qwen — надёжность / финишный handoff

Обновлено QWEN_RELIABILITY 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh PR head при последней сверке: `aab492abc9ce0dd71bdd58392ed2d653c3d0e490`.

Reliability product/test commits этого прохода:
- `af1bc26a9169be7f8a1e7529950e1d283edd9626` — исправлен устаревший `account-store-mutation-atomicity-test.js`;
- `5e5cdf4a9253a087bfaad6d19edd0e71448070e9` — `account-store-noncanonical-filename-test.js` подключён в обычный `npm test` только после исполняемого green.

После `5e5cdf4a...` QWEN_CORE добавил только `scripts/tool-required-terminal-frame-test.js`, получив `aab492ab...`; Reliability-файлы этим коммитом не менялись. Core handoff содержит отдельный RED по `requireToolCall + data:true`; Reliability не трогает `chat-adapter/session/subagent/system-prompt`.

## Главный boundary — noncanonical durable account filename: ДОКАЗАН
Product fix остаётся `e21baa6c29edfc2b592db01106fcd9c32f752a21`: `load()` принимает managed account file только если имя уже равно `${safeId(stem)}.json`. `alpha.beta.json` больше не может нормализоваться в `alpha-beta`.

В этом проходе удалось обойти прежнее ограничение hosted checkout без semantic-модели: нужные product/test файлы были материализованы по exact GitHub blob bytes, а локальные Git blob SHA сверены с GitHub перед исполнением.

Exact account/cooldown cluster сначала дал один FAIL:
- `account-store-mutation-atomicity-test.js` ожидал, что `markSuccess()` очистит `failures` при уже активном cooldown.
- Это противоречило более свежему и отдельному `account-success-cooldown-race-test.js`: поздний успех старого in-flight запроса обязан сохранять более свежую CAPTCHA/rate-limit паузу и error state.
- Product был правильным; устарел тест.

Минимальный root fix `af1bc26a...`: положительный post-rollback путь в mutation-atomicity теперь проверяется через `reset('alpha')`, который по контракту действительно очищает cooldown. После fresh-read blob `e07b15b26eed623f81759b7ca5d417e39b6cbc70` совпал с исполняемыми байтами.

После этого exact executable account/cooldown cluster PASS:
1. `account-store-noncanonical-filename-test.js` — PASS;
2. `account-store-filename-identity-test.js` — PASS;
3. `account-store-persistence-test.js` — PASS;
4. `account-store-interrupted-replacement-recovery-test.js` — PASS;
5. `account-store-mutation-atomicity-test.js` — PASS;
6. `account-store-cooldown-test.js` — PASS;
7. `account-cooldown-wall-clock-jump-test.js` — PASS;
8. `account-success-cooldown-race-test.js` — PASS.

После этого, и только после green, regression подключён к штатному `npm test` коммитом `5e5cdf4a...`; package blob после записи fresh-read = `42cb82971b86032ddc3bc0361e01fc8840ba7d04`.

## Provider cluster — 7/8 exact source tests green
На тех же неизменённых `src/provider-circuit.js` bytes (Git blob `014b681c8032c86401801c6f0a6405f0b2149192`) byte-exact materialization + execution дали PASS:
- `provider-circuit-monotonic-test.js`;
- `provider-circuit-wall-clock-jump-test.js`;
- `provider-circuit-trip-wall-clock-jump-test.js`;
- `provider-circuit-missing-state-fail-closed-test.js`;
- `provider-circuit-missing-state-retrip-restart-test.js`;
- `provider-circuit-persistence-test.js`;
- `provider-circuit-clear-durability-test.js`.

Остался `provider-safety-test.js`. Его exact test bytes прочитаны (blob `b593a77fe73b9041081c2cc6de90195ffe074952`), но он загружает `src/qwen-client.js`, который в свою очередь требует npm `axios`. Hosted filesystem не имеет axios и не имеет DNS к npm/GitHub. Семантической заглушкой это не объявлять exact dependency-tree PASS. Внешний CI ради одного targeted теста не запускать; сначала искать уже доступный exact dependency materialization path.

## Координация с QWEN_CORE
Fresh Core handoff на `aab492ab...` содержит отдельный намеренно RED regression `tool-required-terminal-frame-test.js`; product Core fix ещё pending. Reliability не менял его файлы.

Следовательно full `npm test` и final Circle gate пока преждевременны независимо от Reliability: на общем свежем SHA есть осознанный Core RED.

## Следующий обязательный порядок Reliability
1. Fresh-read PR #6 и QWEN_CORE перед любой записью.
2. Закрыть точное исполнение `provider-safety-test.js` без подмены exact PASS семантической моделью; не использовать live provider.
3. Затем на одном свежем SHA выполнить актуальный account/failover/replay cluster.
4. Один ограниченный red-team по Windows/path/rename/file-lock/process/env; новый код только при серьёзном воспроизводимом контрпримере.
5. Когда Core RED закрыт и Core+Reliability targeted green на одном стабильном SHA — full exact-tree Linux `npm test`.
6. Только после Linux PASS — один disposable `ci/qwen-final-gate`: locked Linux full suite -> настоящий Windows Server 2022 full locked suite на тех же product bytes. Недоступный результат != PASS; старый gate `246dcfc...`/`ee1c596...` не финальный.

## CircleCI
В этом проходе CircleCI/GitHub Actions не запускались. Это соответствует `autonomy/ci/CIRCLECI_GATE_POLICY.md`: Circle не development loop и final gate сейчас блокируется Core RED + незавершённым `provider-safety` exact proof/full Linux.

## Постоянная память / v4 CAS
Worker: `QWEN_RELIABILITY`.
Fresh-read проверенного указателя:
- `LATEST.json` blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`;
- capsule `20260822T115554Z-8763a42805`;
- archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`.

Предыдущий orphan-кандидат с несовпавшим read-back не чинить и не публиковать. В этом проходе новый `LATEST/PREVIOUS` намеренно не форсировался: обязательный полный `restore -> pack v4 -> upload -> readback byte verify -> CAS` цикл не был завершён через безопасный byte transport. Force-write не использовался. Точные новые product commits и handoff являются источником восстановления поверх прежнего проверенного LATEST.

## Запреты/границы
Live Qwen/provider traffic, реальные аккаунты, секреты, Cloudflare и production не трогались. AI Mirrors и Kontur product code не трогались.
