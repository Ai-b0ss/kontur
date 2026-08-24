# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `2cc9a733e0d0884819cf64ec1d1285ebde6b8878`.
- Kontur и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет `account-store` / cooldown / provider-circuit. Core туда не заходит.
- Последний Reliability claim из `kontur#9` (`5389185790`) был exact-bound к `86cf45b...` с явным stale-stop. После Core-движения его старый disposable diagnostic нельзя переносить на текущие product bytes.

Перед новой записью: fresh-read PR #6, latest OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и disposable CI surfaces. При head drift stale evidence не продолжать.

## ЗАКРЫТО В ЭТОМ ПРОХОДЕ №1: plain-subagent numeric options fail-closed

На исходном `src/subagent-dispatcher.js` blob `10f65fef621fc5b267b77e9fcdcd3d5e21aa40e7` явные JSON-настройки `concurrency` и `timeoutMs` проходили через `Number.parseInt`.

Воспроизведено локально:
- `concurrency: "2" -> 2`;
- `concurrency: 1.5 -> 1`;
- `concurrency: false -> fallback`;
- `timeoutMs: "120000" -> 120000`;
- `timeoutMs: 1500.5 -> 1500`;
- `timeoutMs: false -> fallback`.

Root fix:
- RED regression `94f5de4b9cee67966706219f828b65ecbcfacea1` — `scripts/subagent-dispatcher-numeric-option-type-test.js`;
- product fix `a185a58b5cdbd47c4c71a299e5c8d303eab57109`;
- new dispatcher blob `1fa0a67d9947954e66106992be68c68990519404`;
- explicit numeric options теперь обязаны быть finite integer numbers; иначе `QWEN_SUBAGENT_SETTING_INVALID` до provider execution;
- env vars намеренно сохраняют прежнюю строковую конфигурацию и bounded parsing.

Targeted local PASS:
`QWEN_PLAIN_SUBAGENT_NUMERIC_OPTION_TYPE_PASS malformed=8 numeric=2 provider_calls=1`.

Regression wiring:
- `5a213d60c3cbda08b42fab2d1a38f04630cebf8e` — новый тест включён в ordinary `npm test`;
- package read-back подтверждён.

## ЗАКРЫТО В ЭТОМ ПРОХОДЕ №2: plain-subagent endpoint/model type validation

Тот же dispatcher молча преобразовывал/маскировал явные `endpoint` и `model` через `String(options.x || fallback)`: объект мог стать `[object Object]`, `false`/пустая строка — незаметно включить fallback.

Root fix:
- RED regression `f2f38cac4e7ca73eaac54a12cdcd72c479a93155` — `scripts/subagent-dispatcher-string-option-type-test.js`;
- product fix `99d7f58ba39c71b2ec67c5b86fbf81efe7587323` — explicit `endpoint/model` обязаны быть непустыми строками, нормальные значения trim-ятся, malformed -> `QWEN_SUBAGENT_SETTING_INVALID` до provider;
- targeted local PASS: `QWEN_PLAIN_SUBAGENT_STRING_OPTION_TYPE_PASS malformed=10 normalized=2 provider_calls=1`;
- соседний existing `subagent-dispatcher-test.js` остаётся green локально;
- `e7bd37160f1e47b004e2dd6e27e576e6b8815464` — regression включён в ordinary `npm test`.

## ЗАКРЫТО В ЭТОМ ПРОХОДЕ №3: coding-subagent model type validation

`run-agent-subagents.js` читает `payload.options` напрямую. В `subagent-agent-runner.js` модель раньше вычислялась через `String(options.model || env || default)` и в runtime chat, и в durable execution signature. Явный объект/число мог превратиться в строку, а пустое/false — незаметно включить fallback.

Root fix:
- RED regression `6f27d13306312a4df074851dea0f576aafb25bb8` — `scripts/subagent-model-option-type-test.js`;
- product fix `772524408f42818172dfdb00f2be259f571052ae`;
- diff от RED head: только `src/subagent-agent-runner.js`, +15/-2;
- добавлен единый `resolveSubagentModel()`; explicit model обязан быть непустой строкой и нормализуется trim;
- validation вызывается через `runtimeAgentSettings()` до durable batch state/provider execution; тот же normalized model используется для chat и execution signature;
- isolated target PASS: `QWEN_CODING_SUBAGENT_MODEL_OPTION_TARGET_PASS malformed=7 normalized=1 env=1 default=1`;
- `2cc9a733e0d0884819cf64ec1d1285ebde6b8878` — regression включён в ordinary `npm test`.

## Соседняя проверка

На исправленном plain dispatcher локально повторно прошли:
- numeric option regression;
- string option regression;
- existing `subagent-dispatcher-test.js`.

Это targeted proof, НЕ full exact-tree Linux `npm test`.

## Сохраняющий силу Core proof

Core-файлы session/restart/tool-result/streaming в этом проходе не менялись, поэтому прежние targeted доказательства на неизменённых байтах сохраняют силу до fresh exact recheck:
- durable session record schema fail-closed;
- incremental tool-results + assistant/tool pairing;
- owner authority и большой owner-system checkpoint/restart;
- pending multi-tool restart + duplicate tool-call-id protection;
- stale-backup recovery fail-closed;
- required-tool terminal/reasoning gates;
- tool execution errors/required arguments;
- skills alias/type validation;
- internal prompt-mode validation.

## Что дальше

1. Fresh-read PR#6 и QWEN_RELIABILITY после её stale-stop/release; не использовать старый Reliability Circle result как current-head proof.
2. На одном стабильном common SHA прогнать exact Core cluster: owner/session/restart/stale-backup/pending-tool/tool-result + plain/coding subagents + skills + stream/tool/agent execution errors.
3. Reliability должна доказать свой account/cooldown/provider-circuit cluster на тех же product bytes.
4. Только когда обе линии green на одном SHA — один full exact Linux `npm test`.
5. Linux FAIL -> первый реальный падающий тест по штатному порядку. Linux PASS -> native Windows Server 2022 full на ТЕХ ЖЕ product bytes.
6. Затем owner-doctor; live long-soak/runtime acceptance отдельно позже.

`QWEN_CORE_DONE` пока не ставить.

## Постоянная память / v4 CAS

Последняя нормативно подтверждённая capsule из предыдущего handoff остаётся:
- `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

В этом проходе v4 pointer не переписывался: exact runtime/LATEST/PREVIOUS path не был заново нормативно восстановлен. Никакого pseudo-v4, force-write или CAS bypass. Новое состояние долговечно закреплено product commits + этот handoff + `kontur#9`.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions, Circle, Windows = 0.
