# Qwen — агентное ядро / текущий handoff

Обновлено QWEN_CORE 2026-08-24 ~04:15 MSK.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `47d9ed079561d979488eb26b68fedbcd1d70bb3b`.
- QWEN_CORE владеет session/restart/replay, OpenCode/tool-result, prompt modes, plain/coding subagents, skills, execution errors.
- QWEN_RELIABILITY владеет account/cooldown/provider-circuit; Core туда не заходил.
- Kontur/AI Mirrors product не трогать.

Перед любым следующим действием: fresh-read PR#6 head, последние OWNER/CIRCLE POLICY/CLAIM/RELEASE в `kontur#9`, оба Qwen handoff и активные disposable CI PR. При head drift старое доказательство не продолжать.

## Что было найдено и закрыто в этом проходе

### 1. `skills-selection-test.js`: реальный контракт Windows skill расходился с обязательным финальным Windows target

На исходном exact product `2cc9a733e0d0884819cf64ec1d1285ebde6b8878` disposable config-only PR #48 локализовал первый Core failure по штатному порядку:
- Core prefix 1..60 PASS;
- prefix 61 PASS;
- prefix 62 FAIL;
- command 62 = `node scripts/skills-selection-test.js`.

Сам `system-prompt-mode-test.js` (command 61) отдельно PASS; его промежуточные segment jobs были невалидным диагностическим harness и не использовались как product evidence.

`skills-selection-test.js` standalone также FAIL. Дополнительная config-only декомпозиция показала:
- phase 1 selection/frontmatter PASS;
- phase 2 errors/budget PASS;
- phase 3 owner+selected-skill integration PASS;
- phase 4 bundled skills/catalog FAIL;
- phase 5 discovery/metadata PASS.

Root cause: bundled `skills/windows-parity.md` не содержал обязательный exact final target `Windows Server 2022`, хотя штатная regression это требовала и owner policy действительно требует native Windows Server 2022 после Linux PASS. Тест не ослаблялся.

Product fix:
- `f4c1b394fee11f7e0bd7c44fdd9e945a4c0ac0ac` — `skills/windows-parity.md` теперь прямо фиксирует, что финальный нативный CI target = Windows Server 2022.

Exact verification на product `f4c1b394...`:
- disposable PR #50 base SHA = `f4c1b394...`, changed_files=1 (`.circleci/config.yml` only);
- `ci/circleci: qwen-core-skills-targeted` SUCCESS;
- workflow `c21ca692-5982-4375-a089-8883b10108e3`;
- job `cc2a4b8c-7de0-4041-ba49-0b5280275c9b`;
- проверены `skills-selection`, selector-type, path-gate, subagent skill-type и dispatcher neighbor.

### 2. `subagent-batch-resume-test.js`: stale harness больше не имитировал реальный mutating side effect

После skills fix полный Core targeted cluster на exact `f4c1b394...` всё ещё FAIL. Декомпозиция хвоста показала:
- skills tail PASS;
- subagent 65..70 PASS;
- subagent 71..75 PASS;
- subagent 81..86 PASS;
- subagent 76..80 FAIL.

Индивидуальные exact jobs:
- `subagent-legacy-uncertain-restart-test.js` PASS;
- `subagent-owner-prompt-validation-test.js` PASS;
- `subagent-side-effect-uncertainty-test.js` PASS;
- `subagent-side-effect-state-test.js` PASS;
- `subagent-batch-resume-test.js` FAIL.

Root cause — тестовый harness устарел после уже принятой Core-семантики «round limit сам по себе не означает side effect; uncertain только если реально наблюдался mutating tool». В batch-resume stub задача называлась `round limit with possible side effect`, но mock `agent.runTurn()` не вызывал event-emitter и поэтому фактически не моделировал никакого `write/edit/bash`.

Root test fix (критерий не ослаблен):
- `47d9ed079561d979488eb26b68fedbcd1d70bb3b`;
- mock `runTurn(chat, prompt, emit)` для этого сценария теперь реально emits `{ type: 'tool', name: 'write_file' }` до incomplete round-limit;
- тем самым regression снова проверяет именно строгий fail-closed invariant для потенциально уже случившегося mutating effect.

Exact verification на product `47d9ed079...`:
- disposable PR #51 base SHA = `47d9ed079...`, changed_files=1 (`.circleci/config.yml` only);
- targeted fixed skills + recovery cluster SUCCESS: workflow `bba92ab0-a923-417c-b8a2-43204295cc36`, job `982480c5-1761-4ece-bac0-a39fa81a8dfd`;
- затем полный QWEN_CORE targeted cluster на ТЕХ ЖЕ product bytes SUCCESS: workflow `46b8ed90-82cd-4767-b96f-d05e8f05ff46`, job `fa495bdd-bb32-47a9-8360-a1a4eb71b004`.

Полный Core cluster включал: owner/system modes, OpenCode wiring, stream/retry/lifecycle, session/restart/stale-backup/pending-tool/tool-result, tool errors/required args, agent loop/error/duplicate tool ids, skills, plain subagents, coding subagents, durable batch/replay/uncertainty.

## Reliability synchronization

QWEN_RELIABILITY независимо получила exact targeted PASS на предыдущем common SHA `2cc9a733...`:
- disposable PR #49;
- `ci/circleci: qwen-reliability-targeted` SUCCESS;
- workflow `c29e357e-6160-4291-9948-cdebc03c2869`;
- job `1bef565d-dace-4268-991c-31f993b174d9`;
- account/cooldown/bounded-failover/provider-circuit/replay green.

Но после этого Core legitimately moved product `2cc9... -> f4c1... -> 47d9...`. Поэтому Reliability PASS с `2cc9...` нельзя объявлять SAME-SHA финальным доказательством для current `47d9...`, даже если Core commits не касались account/cooldown/provider files.

FIRST REQUIRED NEXT GATE: QWEN_RELIABILITY fresh-sync своего targeted cluster на exact current `47d9ed079...` (или новый fresh common head при drift). Core не должен сам заходить в её owned surface.

## Что разрешено после Reliability same-SHA green

Только когда Core + Reliability targeted green на одном стабильном PR#6 SHA:
1. один exact full Linux `npm test` на config-only disposable branch от этих product bytes;
2. Linux FAIL -> локализовать первый реальный failing command, не менять suite order/state;
3. Linux PASS -> один native Windows Server 2022 full на ТЕХ ЖЕ product bytes;
4. затем owner-doctor harness;
5. live/provider long-soak отдельно позднее.

Windows до full Linux PASS запрещён. `QWEN_CORE_DONE` пока не ставить.

## Circle / live boundary

В этом проходе Circle использовался только для разрешённых disposable offline config-only PR #48/#50/#51. Product bytes на diagnostic branches не менялись; provider/runtime/real accounts/secrets/live/main/merge/production traffic = 0. Windows = 0.

## Постоянная память

v4 capsule/LATEST в этом проходе не перезаписывались: новое состояние долговечно закреплено product commits `f4c1b394...`, `47d9ed079...`, этим handoff и `kontur#9`. Никакого pseudo-v4, force-write или CAS bypass.
