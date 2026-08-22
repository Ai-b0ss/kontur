# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `accc8e48c7860f50ac75173ff9fb662a3d15334a`.

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
- internal prompt mode различает отсутствие поля и явно переданное некорректное значение.

## Закрыт прежний RED — unbounded internal mode error
Fresh PR source на `3f5729180...` уже содержит короткие постоянные сообщения ошибок:
- direct agent: `Unsupported agent system prompt mode`;
- coding subagent: `Unsupported subagent system prompt mode`.

То есть прежнее отражение 200k клиентского значения в ошибку больше не воспроизводится.

Hosted targeted semantic PASS без provider traffic:
`QWEN_INTERNAL_PROMPT_MODE_TARGET_PASS bounded=2 explicit_fail_closed=8 omitted_default=2`.

Постоянный regression `scripts/internal-system-prompt-mode-bounded-error-test.js` уже существовал, но fresh `package.json` его не запускал. В этом проходе он подключён к обычному `npm test` коммитом:
- `accc8e48c7860f50ac75173ff9fb662a3d15334a` — include bounded internal prompt mode regression.

Изменён только `package.json`; product runtime/account logic не трогалась.

Полный exact-tree `npm test` всё ещё НЕ выполнялся; PR целиком зелёным не объявлять.

## QWEN_RELIABILITY coordination / CircleCI
Fresh reliability handoff перед записью: product head `182d09c1...`; late-success/cooldown active-pointer race там считается закрытым. Reliability account-store зону Core не менял.

CircleCI final gate пока НЕ запускать:
- policy требует targeted local PASS и стабильный exact product SHA;
- QWEN_CORE и QWEN_RELIABILITY не должны оба триггерить один SHA;
- в этом проходе закрыт только один пропущенный regression wiring, полного exact-tree local gate ещё нет.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

На входе этого прохода fresh `LATEST`:
- blob `739343bc230b6944020376db82ddf6cfc0d3c977`;
- capsule `20260822T154952Z-adead69f65`;
- archive SHA-256 `8c12eeb8bc3eb346628542fc4e19777a37fc2a662bf13ab123a2e4e7334d8e1f`;
- manifest schema v4, 2 parts; обе части перечитаны отдельно.

Новый v4 checkpoint в этом проходе НЕ публиковался: продуктовая работа была узкой (`package.json` wiring), а exact `capsule_runtime_v4.py` не материализован локально побайтно в этом рантайме. Force-write/ручная псевдо-v4 упаковка не использовались. Exact product state закреплён commit `accc8e48...` и этим handoff.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. На hosted машине материализовать exact owner/session/subagent/restart cluster текущего head и прогнать:
   - `internal-system-prompt-mode-bounded-error-test.js`;
   - `internal-system-prompt-mode-explicit-test.js`;
   - `agent-system-prompt-mode-test.js`;
   - `subagent-owner-prompt-validation-test.js`;
   - ближайшие session/restart regressions.
3. Если cluster PASS и общий product SHA стабилен, согласовать одного владельца SHA с QWEN_RELIABILITY.
4. Только тогда один финальный CircleCI gate через disposable `ci/qwen-final-gate` по политике `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
5. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
