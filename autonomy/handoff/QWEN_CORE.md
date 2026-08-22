# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `bd9ba4f6bbc936e858e4a64d11f0038a38b75b38`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

## Уже закрыто — не открывать без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6, строгая ранняя валидация внешнего system-prompt mode/owner aliases;
- direct agent/coding-subagents принимают owner prompt только как непустую строку без преобразования;
- локальные ошибки инструментов имеют `Error:`-контракт;
- обязательные аргументы инструментов проверяются до handler;
- ordinary Qwen capability mode валидируется строго и до мутаций сессии;
- durable owner authority больше не приводит object/number/array через `String(...)`.

## Закрыт старый RED — internal prompt mode explicit downgrade
Fresh PR source на `7d22a71e...` уже содержит исправление в обоих местах:
- `agent.resolveAgentSystemPromptMode()` различает отсутствие поля и явно переданное некорректное значение;
- `subagent-agent-runner.resolveSubagentPromptMode()` делает то же самое.

Явные `''`, whitespace, `null`, `false`, object/array и неизвестное значение больше не должны молча становиться `engineer`; отсутствие поля по-прежнему означает default `engineer`.

Hosted targeted semantic PASS без provider traffic:
`QWEN_INTERNAL_PROMPT_MODE_TARGET_PASS explicit_fail_closed=16 omitted_default=2 owner_valid=2`.

Постоянный regression `scripts/internal-system-prompt-mode-explicit-test.js` теперь подключён к обычному `npm test` коммитом `6d6bee3d010fa162cc2c3e1e5509d86da539e549`.

Полный exact-tree `npm test` всё ещё НЕ выполнялся; PR целиком зелёным не объявлять.

## Новый воспроизводимый Core-дефект — unbounded internal mode error
Fresh `src/agent.js` и `src/subagent-agent-runner.js` всё ещё включают нормализованное неизвестное значение режима прямо в текст ошибки:
- `Unsupported agent system prompt mode: ${mode}`;
- `Unsupported subagent system prompt mode: ${mode}`.

Для входа длиной 200000 символов это даёт ошибку примерно такой же длины. Hosted reproduction:
`QWEN_INTERNAL_PROMPT_MODE_ERROR_BLOAT_REPRODUCED direct_len=200038 subagent_len=200041`.

Добавлен намеренно RED regression, пока НЕ подключать к `npm test`:
- `scripts/internal-system-prompt-mode-bounded-error-test.js`;
- commit `bd9ba4f6bbc936e858e4a64d11f0038a38b75b38`.

Требуемый минимальный фикс:
1. Сохранить прежние стабильные коды `QWEN_AGENT_SYSTEM_PROMPT_MODE_INVALID` и `QWEN_SUBAGENT_MODE_INVALID`.
2. Не включать клиентское неизвестное значение целиком в message; сообщение должно быть коротким и постоянным.
3. Targeted local PASS: новый bounded-error regression + `internal-system-prompt-mode-explicit-test.js` + `agent-system-prompt-mode-test.js` + `subagent-owner-prompt-validation-test.js`.
4. Только после PASS подключить bounded-error regression в `npm test`.

## QWEN_RELIABILITY coordination / CircleCI
Fresh reliability handoff на входе этого прохода: product head `0da402a5...`, отдельный RED `late success clears newer cooldown`; это зона QWEN_RELIABILITY, Core её не меняет.

CircleCI final gate сейчас НЕ запускать:
- новый Core RED на `bd9ba4f6...` ещё не исправлен;
- reliability имеет свой незакрытый targeted gate;
- policy требует targeted local PASS и стабильный exact product SHA;
- QWEN_CORE и QWEN_RELIABILITY не должны оба триггерить один SHA.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

На входе этого прохода:
- LATEST blob `99bc841354ba629744dfd860974c85685a920905`;
- capsule `20260822T145339Z-0b65fe8863`;
- archive SHA-256 `b93b20218adf5c34105d3f3c00ccc9a704ac8f08459e643a22ff95d74fd488d9`;
- exact `capsule_runtime_v4.py` Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- local `git hash-object` exact runtime совпал;
- v4 verify + restore PASS.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. Минимально убрать unbounded echo режима в `src/agent.js` и `src/subagent-agent-runner.js`, не трогая reliability account logic.
3. Targeted local PASS bounded-error + explicit-mode + owner-mode tests.
4. После PASS подключить bounded-error regression в `npm test`.
5. Затем перечитать reliability targeted result и свежий общий SHA.
6. Только на стабильном SHA — один CircleCI final gate через disposable `ci/qwen-final-gate`, с одним владельцем SHA.
7. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
