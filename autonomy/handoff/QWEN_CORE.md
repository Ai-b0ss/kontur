# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `dd8481e9a966f4c2a7b03294527b4b0aecf403fb`.

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

## Что перепроверено после QWEN_RELIABILITY
Стартовый Core head был `d4417a49...`. Reliability закрыл оба legacy-migration дефекта и продвинул продукт до `d2540be8...`.

`compare d4417a49... → d2540be8...` показывает изменения только в:
- `src/account-store.js`;
- `package.json`;
- `scripts/account-legacy-stale-source-rollback-test.js`.

Core-байты `session-store.js`, `server.js`, `agent.js`, owner/session/restart wiring этими reliability-коммитами не менялись. Значит exact hosted session/restart cluster прошлого прохода сохраняет силу на текущей Core-линии.

Ранее exact hosted PASS без provider traffic:
- owner authority;
- большой owner/system checkpoint;
- session restart + stale-backup recovery;
- tool-result durable progress;
- pending multi-tool restart semantics.

Полный exact-tree `npm test` всё ещё НЕ выполнялся; PR целиком зелёным не объявлять.

## Новый воспроизводимый Core-дефект — internal prompt mode explicit downgrade
Fresh source на `d2540be8...` показал отдельную внутреннюю неоднозначность, не закрытую внешней строгой валидацией сервера.

Текущие функции:
- `agent.resolveAgentSystemPromptMode(settings)` использует `String(settings.systemPromptMode || 'engineer')`;
- `subagent-agent-runner.resolveSubagentPromptMode(options)` использует `String(options.mode || 'engineer')`.

Поэтому явно переданные `''`, пробельная строка, `null` или `false` могут молча стать `engineer`. Если рядом передан приватный `ownerSystemPrompt`, он просто игнорируется вместо fail-closed отказа.

Hosted reproduction:
`QWEN_INTERNAL_PROMPT_MODE_EMPTY_REPRODUCED direct_owner_downgraded=1 subagent_owner_downgraded=1`.

Добавлен постоянный намеренно RED regression:
- `scripts/internal-system-prompt-mode-explicit-test.js`;
- commit `dd8481e9a966f4c2a7b03294527b4b0aecf403fb`;
- compare к `d2540be8...`: только новый тест, product source пока не менялся;
- тест пока НЕ включать в `npm test`, пока source fix не внесён и targeted PASS не получен.

Требуемая семантика исправления:
1. Полное отсутствие `systemPromptMode`/`mode` может по-прежнему означать default `engineer`.
2. Если поле явно присутствует, оно обязано быть непустой строкой `engineer|owner`.
3. `''`, whitespace, `null`, `false`, object/array и неизвестное значение — стабильная локальная ошибка до provider call.
4. Для `owner` приватный prompt остаётся точной непустой строкой без переписывания.
5. После исправления прогнать новый regression + `agent-system-prompt-mode-test.js` + `subagent-owner-prompt-validation-test.js`, затем подключить новый regression к `npm test`.

## QWEN_RELIABILITY coordination / CircleCI
Fresh reliability head до Core regression: `d2540be894fa8e1a3dc4527e188010c6dd9e62e5`.
Reliability legacy migration RED закрыты, но их exact targeted cluster ещё должен подтвердить QWEN_RELIABILITY. Core эту account/cooldown-зону не перехватывает.

Финальный CircleCI gate сейчас НЕ запускать:
- Core только что добавил новый намеренно RED regression на `dd8481e9...`;
- policy требует targeted local PASS и стабильный exact product SHA;
- QWEN_CORE и QWEN_RELIABILITY не должны оба триггерить один SHA.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Вход этого прохода:
- LATEST blob `6d83335e69ceb5e16ce3ccd8303e932f38996f86`;
- capsule `20260822T135230Z-7a41167f77`;
- archive SHA-256 `f150922523962811f7926a79d0504dd9316e4115fd862fb880bf797116336787`;
- exact `capsule_runtime_v4.py` Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- local `git hash-object` exact runtime совпал;
- v4 verify + restore PASS.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. Исправить только internal explicit-mode downgrade в `src/agent.js` и `src/subagent-agent-runner.js`, не трогая reliability account logic.
3. Targeted local PASS: новый regression + существующие `agent-system-prompt-mode-test.js` + `subagent-owner-prompt-validation-test.js`.
4. Подключить новый regression в `npm test` только после PASS.
5. После стабилизации общего SHA и закрытия reliability targeted cluster — один CircleCI final gate через disposable `ci/qwen-final-gate`, с одним владельцем SHA.
6. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
