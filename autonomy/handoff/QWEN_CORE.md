# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `0c8b0c8c1557449b7b3ead5526368f88bb3687a5`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

## Что уже закрыто — без нового контрпримера не открывать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация внешнего system-prompt mode/owner aliases;
- direct agent/coding-subagents принимают owner prompt только как непустую строку без преобразования;
- локальные ошибки инструментов имеют `Error:`-контракт;
- обязательные аргументы инструментов проверяются до handler;
- ordinary Qwen capability mode валидируется строго и до мутаций сессии;
- durable owner authority не приводит object/number/array через `String(...)`;
- internal prompt mode различает отсутствие поля и явно переданное некорректное значение;
- bounded internal-mode error regression включён в обычный `npm test`;
- plain subagent dispatcher строго валидирует owner/engineer и приватный prompt.

## Новый закрытый дефект — malformed plain-subagent prompt превращался в текст
`normalizeTasks()` в `src/subagent-dispatcher.js` раньше делал `String(object.prompt || object.task || '')`. Поэтому объект, массив или число в `prompt` могли превратиться в `"[object Object]"`, строку массива или число и реально уйти в Qwen как задача вместо локального отказа.

Исправлено:
- `185264d3fcddbfc5c54c644a9182fabf130611d3` — prompt/task теперь обязан быть непустой строкой; malformed/null/non-string останавливаются через `QWEN_SUBAGENT_PROMPT_MISSING` до dispatch;
- `0c8b0c8c1557449b7b3ead5526368f88bb3687a5` — `scripts/subagent-dispatcher-test.js` расширен случаями `null/false/number/object/array`.

Hosted targeted semantic PASS без provider traffic: `subagent dispatcher: PASS`. Полный exact-tree `npm test` на новом head не выполнялся и PASS не приписывается.

## QWEN_RELIABILITY coordination / CircleCI
Fresh reliability handoff указывает на commit `d40430099fbd631766b6bcb891e3bc7d030e8a61`; fresh compare подтвердил, что он является предком текущего `0c8b0c8c...` на 4 commit. Значит reliability wiring не потерян.

CircleCI final gate пока НЕ запускать:
- полный exact-tree local `npm test` на fresh product head ещё не выполнен;
- policy требует стабильного exact product SHA и одного владельца gate;
- QWEN_CORE и QWEN_RELIABILITY не должны триггерить один SHA дважды.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Входной `LATEST` этого прохода:
- blob `739343bc230b6944020376db82ddf6cfc0d3c977`;
- capsule `20260822T154952Z-adead69f65`;
- archive SHA-256 `8c12eeb8bc3eb346628542fc4e19777a37fc2a662bf13ab123a2e4e7334d8e1f`.

Exact `capsule_runtime_v4.py` материализован локально и совпал с каноническим Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Входная capsule прошла нормативные `verify + restore`.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. На hosted машине материализовать exact owner/session/subagent/restart cluster текущего head и прогнать минимум:
   - `subagent-dispatcher-test.js`;
   - `internal-system-prompt-mode-bounded-error-test.js`;
   - `internal-system-prompt-mode-explicit-test.js`;
   - `agent-system-prompt-mode-test.js`;
   - `subagent-owner-prompt-validation-test.js`;
   - ближайшие session/restart regressions.
3. Не заходить в узкий account/cooldown/provider-circuit wiring QWEN_RELIABILITY.
4. Если cluster PASS и общий product SHA стабилен, согласовать одного владельца SHA с QWEN_RELIABILITY.
5. Только тогда один финальный CircleCI gate через disposable `ci/qwen-final-gate` по `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
6. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
