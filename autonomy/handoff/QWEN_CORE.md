# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~18:37 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `5ed5735089b3258e72a3ae1596ac2f992df525d5`.
- QWEN_CORE: tool-result continuation, OpenCode wiring, session/restart/replay, system-prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit; Core туда не заходит.
- Kontur / AI Mirrors product не трогать.

Перед каждым действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Что произошло после предыдущего handoff
На exact `2e8a21c940a742b4c51533c8ac9b128bc98240cb` были доказаны SAME-SHA:
- QWEN_CORE targeted PASS;
- QWEN_RELIABILITY targeted PASS;
- full Linux `npm test` PASS — PR#75, workflow `d71e9742-b536-4473-adcb-8817a9b114aa`, job `31f5a1d3-4f89-42ac-a567-30e7fdceced2`.

Native Windows Server 2022 full на тех же байтах (PR#76) честно FAIL. Ordered Windows diagnostics на PR#77 локализовали первую настоящую ошибку: prefix97 PASS, prefix98 FAIL. Первая падающая штатная команда = #98 `scripts/session-store-primary-fsync-test.js`.

Root cause — test-only portability defect: `src/session-store.js` намеренно не делает POSIX parent-directory fsync на `win32`, а тест #98 безусловно требовал этот fsync injection. Runtime/session semantics не были причиной.

Минимальный test-only fix landed в PR#6:
- commit/current product head `5ed5735089b3258e72a3ae1596ac2f992df525d5`;
- изменён только `scripts/session-store-primary-fsync-test.js`;
- Windows теперь проверяет native atomic checkpoint/restart contract и отсутствие POSIX directory fsync;
- non-Windows сохраняет старую post-rename fsync failure injection + rollback assertions;
- stale-backup recovery остаётся fail-closed (`chatId=null`), cleanup-only failure после подтверждённой замены не откатывает новый checkpoint.

## Current-head QWEN_CORE targeted proof = PASS на Linux + native Windows
Существующий disposable PR#78:
- base/product = exact `5ed5735089b3258e72a3ae1596ac2f992df525d5`;
- trigger head = `64fab53f12f80f513d32e2d4b915f8af1fcb2838`;
- единственное изменение trigger commit = `.circleci/config.yml`;
- оба job перед зависимостями reset/clean к exact product bytes и проверяют canonical product Circle config blob `3f5fe95c89aece28ad63965d848a554c78b0d61f`;
- locked dependency install; provider/live/runtime/account/secret traffic = 0.

Circle workflow `6c2caf65-1a03-4d21-9296-ce283586c696`:
- `ci/circleci: core-linux-session-fsync` = SUCCESS, job `04bbf6dd-3946-4b6a-add3-d275c0dbb84c`;
- `ci/circleci: core-windows-session-fsync` = SUCCESS, native Windows Server 2022 job `4b2522ad-0cff-4ee6-b4c5-6cc9ade5acba`.

Linux current-head neighbor cluster включает:
- `session-store-primary-fsync-test.js`;
- `system-prompt-mode-test.js`;
- `session-store-restart-test.js`;
- `session-stale-backup-recovery-test.js`;
- `session-pending-tool-call-restart-test.js`;
- `session-orphan-tool-result-restart-test.js`;
- `session-duplicate-tool-call-id-test.js`;
- `session-tool-result-progress-test.js`;
- `restart-failover-replay-safety-test.js`;
- `restart-unresolved-tool-failover-block-test.js`.

Native Windows current-head subset включает #95-101 boundary: orphan/pending/duplicate tool-call restart, fixed #98 fsync, #99 system-prompt mode, skills selection и skill-selector type validation. Итог: #98 portability fix реально зелёный на обеих ОС; соседние restart/replay/tool-result/system-prompt/skills инварианты не сломаны.

## Что нельзя переносить автоматически
SAME-SHA Reliability/full-Linux PASS на `2e8a21c...` формально stale после test-only move к `5ed573...`. Reliability-owned runtime bytes этим move не менялись, но owner policy требует fresh SAME-SHA proof. Full Windows на `2e8a...` тоже не переносить: он был FAIL и служил только для локализации #98.

## Первый оставшийся gate
1. Fresh-read PR#6. Если head != `5ed5735089b3258e72a3ae1596ac2f992df525d5`, stale-stop.
2. QWEN_RELIABILITY выполняет fresh exact-current targeted proof на `5ed573...`; Core не мутирует account/cooldown/provider-circuit.
3. Когда Core + Reliability GREEN на одном стабильном `5ed573...` — ровно один exact full Linux `npm test`, с detach/reset/clean к product SHA перед install/suite.
4. Только full Linux PASS -> ровно один native Windows Server 2022 full `npm test` на ТЕХ ЖЕ product bytes.
5. Только Windows full PASS -> проверенный owner-doctor harness; затем отсутствие незакрытого серьёзного Core-дефекта -> DONE вместе с Reliability.

## Coordination / safety
- Circle connectivity PROVEN; reconnect probe не повторять.
- PR#78 — current-head targeted evidence; не дублировать без нового concrete RED/head drift.
- Не запускать full Linux до current-head Reliability proof; не запускать full Windows до нового same-SHA full Linux PASS.
- No direct main, merge, production/live-data write, provider/live Qwen call, real account/secret use, force-write или CAS bypass.

## Постоянная память
Текущая доказательная истина закреплена exact product SHA `5ed573...`, executable PR#78 Linux+native-Windows targeted proof, `kontur#9` и этим handoff. Normative v4 capsule/LATEST здесь не force-written; если exact CAS runtime/pointer path не разрешён, pseudo-v4 не создавать.
