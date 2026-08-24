# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~15:43 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `f24ff867bb7b121536e517ff56be8ab2e29c3258`.
- QWEN_CORE: tool-result continuation, OpenCode wiring, session/restart/replay, system-prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY: account/cooldown/provider-circuit. Core туда не заходит.
- Kontur / AI Mirrors product не трогать.

Перед следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Текущий обязательный Windows-дефект закрыт и проверен на current head
Предыдущий exact product SHA `a658eec49dfb353f53fa5779347d446d8aaba950` имел SAME-SHA Core + Reliability targeted GREEN и полный Linux `npm test` PASS. Native Windows Server 2022 full на этих байтах честно упал. Ordered Windows diagnostics дали:
- prefix17 = SUCCESS;
- prefix21 = SUCCESS;
- prefix23 = SUCCESS;
- prefix24 = FAILURE.

Первая падающая штатная команда была точно #24 `node scripts/session-request-gate-test.js`. Root cause — Windows-переносимость самого теста: он читал `server.js` с исходными окончаниями строк и искал LF-only литерал `finally {\n    releaseSessionRequest();\n  }`. На Windows checkout тот же файл может иметь CRLF, при неизменной семантике сервера.

Root fix уже в product PR#6:
- commit `f24ff867bb7b121536e517ff56be8ab2e29c3258` (`test: make session request gate check CRLF portable`);
- compare `a658eec... -> f24ff867...` = ровно один файл `scripts/session-request-gate-test.js`, +13/-2;
- `server.js`, session runtime и Reliability-owned файлы не менялись;
- current test blob = `84f4f5f92dd1d61852283a943429b8180b256e11`;
- current canonical `.circleci/config.yml` blob = `3f5fe95c89aece28ad63965d848a554c78b0d61f`;
- `package.json` по-прежнему включает `session-request-gate-test.js` в обычный `npm test` (команда #24).

Исправленный тест:
1. нормализует `CRLF -> LF` перед статическими source assertions;
2. отдельно симулирует CRLF-версию `server.js` и требует идентичный нормализованный текст;
3. не ослабляет инварианты: same-session serialization, different-session concurrency, durable re-read после gate acquisition, pending-tool block до provider, release в `finally`, disconnect block до provider.

## Current-head targeted Core proof = PASS
Disposable draft PR #69:
- base/product = `f24ff867bb7b121536e517ff56be8ab2e29c3258`;
- trigger head = `ff0c35b29654c50db304d8ce7cabcccbe8885658`;
- единственное изменение = `.circleci/config.yml`;
- job перед зависимостями переключается на detached exact product `f24ff867...`, требует clean worktree и canonical Circle config blob `3f5fe95c...`;
- locked `npm ci --ignore-scripts --no-audit --no-fund`;
- затем exact Core session/restart cluster.

Circle result:
- context `ci/circleci: qwen-core-session-gate = success`;
- workflow `ba9fd429-c9ba-41f4-b693-7f5c58a9c0c4`;
- job `c21fda22-0bab-4c3d-ac03-2cbdff2f9094`.

Проверены на одних current product bytes:
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

Итог: Windows CRLF root fix executable GREEN на current head; соседние session/restart/replay/pending-tool/tool-result инварианты не сломаны.

## Что из старых acceptance gates стало stale
На `a658eec...` были доказаны:
- current-head Core targeted GREEN;
- QWEN_RELIABILITY targeted GREEN;
- full Linux `npm test` PASS;
- native Windows full FAIL, который и локализовал command #24.

После `f24ff867...` прошлые Reliability/Linux/Windows результаты нельзя автоматически переносить на новый SHA, хотя diff test-only и Reliability/runtime bytes не менялись. По owner-policy нужен SAME-SHA sync.

## Первый оставшийся gate
1. Fresh-read PR#6. Если head != `f24ff867bb7b121536e517ff56be8ab2e29c3258`, stale-stop.
2. QWEN_RELIABILITY должен выполнить exact-current targeted proof на `f24ff867...`; Core не мутирует account/cooldown/provider-circuit.
3. Если Core + Reliability GREEN на одном стабильном `f24ff867...` — ровно один corrected full Linux `npm test`. Disposable config может только запустить job; сам job обязан detach/reset/clean к exact product SHA до `npm ci`/`npm test`, чтобы suite видел canonical product `.circleci/config.yml`.
4. Только full Linux PASS -> ровно один native Windows Server 2022 full на тех же product bytes.
5. Только Windows PASS -> owner-doctor harness; затем отсутствие незакрытого серьёзного воспроизводимого Core-дефекта -> DONE вместе с Reliability.

## Coordination / safety
- Owner/Circle policy current: Qwen Circle connectivity уже PROVEN (`5c7a2aeb...` reconnect-probe SUCCESS); reconnect не повторять.
- Claim `5394856140` RELEASED после current-head Core targeted PASS.
- PR #69 — текущая доказательная Core surface; не мутировать/дублировать без нового конкретного RED.
- Старые a658 disposable PR#62/#63/#64/#65 и redundant manual-assist #66/#67/#68 не являются current-head acceptance evidence.
- No direct main, merge, production/live-data write, provider/live Qwen call, real account/secret use, force-write или CAS bypass.

## Постоянная память
Этот handoff обновлён после substantial result. Normative v4 capsule/LATEST в этом проходе не переписывались: exact CAS path/pointer не был заново безопасно разрешён. Новая истина закреплена exact product commit `f24ff867...`, executable Circle proof PR#69, `kontur#9` comments `5395338089` / `5395340142` и этим handoff. Никакого pseudo-v4 или force-write не использовать.
