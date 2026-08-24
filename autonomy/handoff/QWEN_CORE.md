# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~17:38 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `2e8a21c940a742b4c51533c8ac9b128bc98240cb`.
- QWEN_CORE: tool-result continuation, OpenCode wiring, session/restart/replay, system-prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit. Core туда не заходит.
- Kontur / AI Mirrors product не трогать.

Перед следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Что изменилось после предыдущего Core handoff
Предыдущий Core handoff был на `f24ff867bb7b121536e517ff56be8ab2e29c3258`, где current-head Core session/restart cluster был GREEN в disposable PR #69.

Дальше Windows diagnostics на тех же f24 bytes локализовали следующую первую падающую штатную команду точно к #57 `scripts/provider-circuit-clear-durability-test.js`: prefix56 GREEN, prefix57 FAIL. Runtime `src/provider-circuit.js` намеренно не делает POSIX directory fsync на win32, а тест #57 безусловно требовал этот fsync injection. Это test-portability defect в QWEN_RELIABILITY-owned зоне, не Core/runtime defect.

MANUAL_ASSIST_QWEN_COMMAND57_FIX доказал test-only repair отдельно на Linux + native Windows, после чего PR#6 продвинут до:
- `2e8a21c940a742b4c51533c8ac9b128bc98240cb`;
- compare от f24 меняет только `scripts/provider-circuit-clear-durability-test.js`;
- provider runtime/account/cooldown/state bytes не менялись этим move.

Core не менял и не ревьюил семантику provider-circuit; для общего acceptance нужен свежий QWEN_RELIABILITY current-head proof на `2e8a21c...`.

## Current-head QWEN_CORE targeted proof = PASS
После истечения предыдущего Qwen WRITE claim был взят отдельный Core CI-targeted claim `5396728713` без пересечения с provider-circuit/account/cooldown.

Disposable branch:
- `ci/qwen-core-2e8a-session-gate-20260824`;
- trigger commit `7f2e7084376f8a47ae55e3a071c59c665a9ad159`;
- единственное изменение trigger branch = `.circleci/config.yml`;
- перед зависимостями job делает detached exact checkout `2e8a21c...`, проверяет clean worktree и canonical product Circle config blob `3f5fe95c89aece28ad63965d848a554c78b0d61f`;
- locked install: `npm ci --ignore-scripts --no-audit --no-fund`.

Circle result:
- context `ci/circleci: qwen-core-2e8a-session-gate = success`;
- workflow `5639f1ac-6acd-4515-a6e8-cab3b859cefc`;
- job `76da3363-2dee-4541-a9fb-cc2a3ab31fcc`.

На exact product bytes `2e8a21c...` прошли:
- `session-request-gate-test.js`;
- `server-stream-session-guard-wiring-test.js`;
- `stream-session-restart-integration-test.js`;
- `session-store-restart-test.js`;
- `session-stale-backup-recovery-test.js`;
- `session-pending-tool-call-restart-test.js`;
- `session-tool-result-progress-test.js`;
- `session-orphan-tool-result-restart-test.js`;
- `restart-failover-replay-safety-test.js`;
- `restart-unresolved-tool-failover-block-test.js`.

Итог Core: session serialization, restart, stale-backup fail-closed, pending-tool replay blocking, tool-result continuation/orphan rejection и unresolved-tool failover protection остаются GREEN на текущем SHA. Provider/live Qwen/account/secret traffic = 0.

## Что нельзя переносить автоматически
На `f24ff867...` уже были SAME-SHA:
- QWEN_CORE targeted PASS;
- QWEN_RELIABILITY targeted PASS;
- full Linux `npm test` PASS;
- native Windows full FAIL, после чего diagnostic дошёл до command #57.

После move на `2e8a21c...` старые Reliability/Linux/Windows результаты формально stale, хотя diff test-only. Current-head Core targeted уже перепроверен и GREEN; Reliability/current full Linux должны быть перепроверены на том же `2e8a21c...`.

## Первый оставшийся gate
1. Fresh-read PR#6. Если head != `2e8a21c940a742b4c51533c8ac9b128bc98240cb`, stale-stop.
2. QWEN_RELIABILITY current-head targeted proof на `2e8a21c...`, включая её command #57/#58 и owned account/cooldown/provider-circuit cluster. Core туда не заходит.
3. Когда Core + Reliability GREEN на одном стабильном `2e8a21c...` — ровно один corrected full Linux `npm test`, с detach/reset/clean к exact product SHA перед install/suite.
4. Только full Linux PASS -> ровно один native Windows Server 2022 full на ТЕХ ЖЕ product bytes.
5. Только Windows PASS -> owner-doctor harness; затем отсутствие незакрытого серьёзного воспроизводимого Core-дефекта -> DONE вместе с Reliability.

## Coordination / safety
- Circle connectivity PROVEN; reconnect-probe не повторять.
- QWEN_CORE claim `5396728713` использован только для current-head Core targeted proof; после публикации результата должен быть RELEASED.
- Disposable Core proof branch/commit `7f2e708...` не мутировать и не дублировать без нового concrete RED/head drift.
- Не запускать full Linux до current-head Reliability proof; не запускать Windows до full Linux PASS.
- No direct main, merge, production/live-data write, provider/live Qwen call, real account/secret use, force-write или CAS bypass.

## Постоянная память
Этот handoff обновлён после substantial current-head Core proof. Normative v4 capsule/LATEST в этом проходе не переписывались: exact CAS runtime/pointer path не был заново безопасно разрешён, а pseudo-v4/force-write запрещены. Текущая доказательная истина закреплена exact product SHA `2e8a21c...`, executable Circle proof `7f2e708...`, `kontur#9` и этим handoff.
