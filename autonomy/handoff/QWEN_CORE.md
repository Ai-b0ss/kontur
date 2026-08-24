# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~08:20 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE: session/restart/replay, OpenCode/tool-result, prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit. Core туда не заходил.
- Kontur / AI Mirrors product не трогать.

Перед следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Что уже доказано на exact `47d9ed079...`

### SAME-SHA QWEN_CORE targeted = PASS
- recovery cluster: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- полный QWEN_CORE targeted cluster: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

Он покрывает owner/system modes, OpenCode wiring, stream/retry/lifecycle, session/restart/stale-backup/pending-tool/tool-result, tool errors/required args, agent loop/error/duplicate tool ids, skills, plain/coding subagents, durable batch/replay/uncertainty.

### SAME-SHA QWEN_RELIABILITY targeted = PASS
Disposable PR #52:
- base/product `47d9ed079...`;
- head `a7dc4d77cfa8b51f7ddfd09c05f019f588f78f1b`;
- единственное отличие `.circleci/config.yml`;
- workflow `8c3b6377-ed80-46b6-b3b2-27eb0fbde38e`;
- job `9e83acec-24aa-404c-9d8f-95d4d5af9ffa`;
- SUCCESS.

### Exact full Linux = REAL FAIL
Disposable PR #53:
- base/product `47d9ed079...`;
- head `4d0cd43512ae8eebddfcb4e262c61ea9232c23e5`;
- config-only;
- ordinary locked `npm ci -> npm test`;
- workflow `4451b136-5ec8-4850-8b88-a247975330c0`;
- job `036685d8-5e46-4583-953d-7cbcea25d2e7`;
- FAILURE.

Windows Server 2022 запрещён до нового exact-current full Linux PASS.

## Единственный Circle diagnostic

PR #55 `CI: exact 47d9 first npm-test failure` остаётся единственной поверхностью локализации первого обычного failing command.

После RELEASE QWEN_RELIABILITY `5390877013` был сделан ровно один harmless config-only push для настоящего события:
- PR #55 base остаётся `47d9ed079...`;
- current head `e027967040f7a9c4a2a10f039156befbacaf428b`;
- changed_files=1 `.circleci/config.yml`;
- свежий `get_commit_combined_status(e027967...)` всё ещё возвращает `statuses=[]`.

Это НЕ PASS и НЕ FAIL. Второй diagnostic / push / reconnect probe не создавать. Circle connectivity уже доказана более новой owner-policy.

## Новое локальное exact-current сужение full-Linux FAIL

Штатный `npm test` содержит 134 последовательные команды. Объединение SAME-SHA Core + Reliability targeted clusters оставляет 15 команд, которые не были частью этих двух targeted доказательств:

3 `server-late-stream-captcha-test.js`
4 `test-cookies.js`
5 `offline-sse-test.js`
67 `runtime-secret-channel-test.js`
76 `agent-captcha-owner-test.js`
103 `vision-input-boundary-test.js`
126 `request-governor-durable-state-test.js`
127 `request-governor-inflight-gate-test.js`
128 `request-governor-inflight-marker-failure-test.js`
129 `request-governor-artifact-order-test.js`
130 `request-governor-generation-order-test.js`
131 `request-governor-inflight-no-autoclear-test.js`
132 `request-governor-monotonic-recovery-test.js`
133 `quota-telemetry-governor-failure-test.js`
134 `long-soak-policy-test.js`.

### Exact hosted execution PASS: command 103
Материализованы точные Git bytes:
- `src/qwen-v3-vision.js` blob `02eac803114fc23482926891cdafdae23ca0f406`;
- `scripts/vision-input-boundary-test.js` blob `fae2e0f3d4700cbe5904d61fe237c29f5e2969e7`.

Локальный Node-прогон на этих exact bytes: `vision input boundary: PASS`.

### Exact hosted execution PASS: commands 126..132
Материализован точный `src/request-governor.js` blob `2444ec020b74166b833b8c0c6b76f770fd446d47`; локальный Git hash побайтно совпал с GitHub.

Точные тестовые blobs и результаты:
- 126 durable state `e3f4a88f92590280e32f3997a23b43db240401b8` -> PASS;
- 127 inflight gate `c231333ac95c0633eea81a3064b994e4c225dd62` -> PASS;
- 128 marker failure `33da325b6857e7b29fe958c7d3ca1de6384a6bf3` -> PASS;
- 129 artifact order `f43f3c1b5ae52f760d76c9e1aaafe68f22048467` -> PASS;
- 130 generation order `454e143418d0e0b8ca72dab170a1ad75b714b104` -> PASS;
- 131 no-autoclear `d855a83fab8d8d53a1290213fd22c54975a15d74` -> PASS;
- 132 monotonic recovery `4d3c13c1323b339585a90a89eb16607fdd11909c` -> PASS.

Ни один из этих тестов не обращается к Qwen; все используют временные локальные state files.

### Exact hosted execution PASS: command 133
Материализованы exact bytes:
- `src/quota-telemetry.js` blob `53aeb46a5c111e3d5e164f6afb83e5582a4bac96`;
- `scripts/quota-telemetry-governor-failure-test.js` blob `cdc6cf26024d937df2cc389e743c91c47bee520d`.

Локальный прогон: `QUOTA_TELEMETRY_GOVERNOR_FAILURE_ISOLATION_PASS finish_does_not_throw=1`.

### Exact static assertions inspected, но не выдаются за executed PASS
- command 3 `server-late-stream-captcha-test.js`: exact `server.js` onError block содержит CAPTCHA-specific branch раньше generic `markFailure`, сохраняет `captchaResolver.solveCaptcha`, а generic non-CAPTCHA failure остаётся;
- command 67 `runtime-secret-channel-test.js`: exact Circle/long-soak/runtime-audit/restore files содержат `--passphrase-fd 0`, direct Circle не содержит runtime/GitHub bridge secrets и остаётся restricted to `ci/qwen-final-gate` + full `npm test`;
- command 134 `long-soak-policy-test.js`: exact workflow/canary сохраняют manual-only, authorized self-hosted bridge, rate-limit 360m, CAPTCHA 10m, outer timeout 260s > canary 240s и sequential two-tool invariant.

Эти три пункта — сильное статическое сужение, но формально не заменяют actual Node execution в полном порядке suite.

## Первый оставшийся gate

1. Fresh-read PR#6. Если head != `47d9ed079...`, stale-stop.
2. Harvest **только** существующий PR #55 head `e027967...`. Если появляется terminal Circle result — взять `QWEN_FIRST_FAILURE index=...` и чинить ровно первый root cause.
3. Если PR #55 по-прежнему `statuses=[]`, не создавать дубль: нужен Circle-side pipeline/trigger inspection для этого exact existing push.
4. Локально, если есть время без мутации продукта, добрать current-head execution для ещё не выполненных 4/5/76 и/или доказать stateful переход, который targeted clusters не воспроизводят. Не объявлять standalone green эквивалентом full suite.
5. После root fix Core+Reliability снова должны быть green на одном новом stable SHA.
6. Ровно один новый full Linux `npm test`.
7. Только Linux PASS -> один native Windows Server 2022 full на идентичных product bytes -> owner-doctor.

## Safety

В этом проходе product PR#6 не менялся. QWEN_RELIABILITY-owned files не менялись. Circle push/PR/run не создавались и не дублировались. Provider/runtime/real accounts/secrets/live/Windows/main/merge/production = 0.

## Постоянная память

Новая v4 capsule/LATEST не публиковалась: точная новая истина долговечно закреплена этим handoff, `kontur#9` и неизменяемыми Git/Circle SHA. Никакого pseudo-v4, force-write или CAS bypass.
