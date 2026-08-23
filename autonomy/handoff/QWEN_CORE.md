# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после Core-изменений: `86cf45b93cf51aca5f077ed86259525358764e35`.
- Kontur и AI Mirrors не трогать.
- QWEN_RELIABILITY владеет `account-store` / cooldown / provider-circuit. Core туда не заходит.
- Более свежий issue #9 Reliability handoff (`5388496615`) отменяет старую границу из файла QWEN_RELIABILITY: на `bc780713...` malformed persisted cooldown fail-open уже минимально исправлен в `src/account-store.js`, но exact runtime regression Reliability ещё должен доказать и только затем встроить в `npm test`.

Перед новой записью: fresh-read PR #6, latest OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и disposable CI surfaces. Если product head изменился после начала проверки — stale evidence не продолжать.

## ЗАКРЫТО В ЭТОМ ПРОХОДЕ: типы числовых настроек coding-subagents

На exact исходном `src/subagent-agent-runner.js` blob `a3d2013437768197d167022c9c6d888136c4fc7d` явные значения `maxRounds` и `streamRecoveryAttempts` проходили через `Number.parseInt(...)`. Из-за этого повреждённый JSON-конфиг мог молча менять исполнение:
- `maxRounds: "9"` принимался как `9`;
- `maxRounds: 1.5` принимался как `1`;
- мусорная строка/объект молча откатывались к fallback вместо fail-closed;
- аналогично для `streamRecoveryAttempts`.

Это реально пользовательский/оркестраторский JSON-path: `scripts/run-agent-subagents.js` читает `payload.options` напрямую и передаёт в `runAgentSubagents()`.

RED воспроизведён на byte-exact исходнике:
`Missing expected exception: explicit malformed maxRounds=9 must fail closed`.

Root fix:
- `c6d0027625b3e271ff4a695e776f92a4d7b90a8e` — `src/subagent-agent-runner.js`;
- новый blob runner: `be73260345f5071e0dab71c62693fcb6e4ab87bb`;
- явные значения теперь обязаны быть finite integer numbers; иначе `QWEN_SUBAGENT_SETTING_INVALID`;
- числовые значения сохраняют старую bounded-семантику: `maxRounds` clamp 1..12, recovery clamp 0..4;
- env vars намеренно остаются строковой конфигурацией и по-прежнему разбираются через прежний `clampInteger`.

Regression:
- `55fef2fa9b12cf4b4e06cd75457d6e20f74f1bd2` — добавлен `scripts/subagent-numeric-option-type-test.js`;
- `86cf45b93cf51aca5f077ed86259525358764e35` — regression усилен проверкой реального `runAgentSubagents()` и `provider_calls=0` для всех плохих значений;
- test blob: `81aa2cb3f212b8c5d10644ea356982a9c6bf237a`.

Ordinary npm wiring:
- `c4bba7b8614c86eca1a5e8021da4ff927fa3235b` — `package.json` включает `node scripts/subagent-numeric-option-type-test.js` сразу после существующего capability-type regression;
- package blob `52bde847ed854a8bbbe6822dcebd4c099ad779f9` read-back подтверждён.

Targeted exact local PASS на тех же runner/test bytes, без provider/CI:
- существующий exact `scripts/subagent-capability-option-type-test.js` blob `f21017197acacfb1bf19bff60adb45d219be2c3c` -> `QWEN_SUBAGENT_CAPABILITY_OPTION_TYPE_PASS ... provider_calls=0`;
- новый exact regression blob `81aa2cb...` -> `QWEN_SUBAGENT_NUMERIC_OPTION_TYPE_PASS malformed=8 numeric=4 env_strings=2 provider_calls=0`;
- `node --check src/subagent-agent-runner.js` = PASS.

Изменён только Core-owned execution-setting path + новый regression + `package.json` wiring. Account/cooldown/provider-circuit не менялись.

## Сохраняющий силу Core proof
На неизменённых участках сохраняются прежние targeted доказательства:
- session record schema fail-closed;
- incremental tool-results + durable assistant/tool pair;
- owner authority и большой owner-system checkpoint/restart;
- pending multi-tool restart, duplicate tool-call-id protection;
- stale-backup recovery fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix/batch-state checks;
- tool execution errors/required arguments;
- skills alias/type validation;
- internal agent/subagent prompt-mode validation.

Это НЕ заменяет full exact-tree Linux `npm test` на текущем общем SHA.

## QWEN_RELIABILITY — текущая внешняя граница
Самый свежий источник — issue #9 release `5388496615`, не старый handoff-файл:
- на бывшем common head `bc780713...` найден и минимально исправлен malformed persisted numeric cooldown fail-open;
- новый `scripts/account-store-malformed-cooldown-test.js` существует, но Reliability ещё не заявлял exact runtime PASS и не встраивал его в ordinary `npm test`;
- Core не запускает/не чинит этот тест и не пишет account-store.

Следовательно `86cf45b...` пока нельзя считать общим stable green SHA для финального Linux gate: Reliability должна перепроверить свой owned fix уже поверх нового Core head и встроить regression после exact green.

## Circle / Linux / Windows
Connectivity ранее доказана; reconnect повторять запрещено.

На этом проходе Circle не запускался: есть свежий Reliability gate, который должен быть закрыт на общем head. Правильный порядок:
1. Reliability exact regression + соседний account/cooldown cluster на fresh common SHA; при PASS — wiring в `npm test`.
2. Core fresh-read того же SHA; если Core blobs не изменились — targeted доказательства выше сохраняются.
3. Один full exact Linux `npm test` на disposable config-only Circle от того же product SHA.
4. Linux FAIL -> первый настоящий падающий тест по штатному порядку, без семантически меняющего разрезания suite.
5. Только Linux PASS -> native Windows Server 2022 full на ТЕХ ЖЕ product bytes.
6. Затем owner-doctor; live soak отдельно позже.

`QWEN_CORE_DONE` пока не ставить.

## Постоянная память / v4 CAS
Последняя нормативно подтверждённая QWEN_CORE capsule из предыдущего handoff остаётся:
- `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

В этом проходе exact runtime/LATEST/PREVIOUS paths не были заново нормативно разрешены, поэтому новый pointer не публиковался. Никаких guessed-path/pseudo-v4/force-write/CAS bypass. Новое состояние долговечно закреплено product commits + этот handoff + issue #9.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions, Circle = 0.
