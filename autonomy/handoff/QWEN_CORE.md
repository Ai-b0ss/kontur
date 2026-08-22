# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `ee1c596534dc926edcdef97886801bfd36fe4ae3`.

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
- plain subagent dispatcher строго валидирует owner/engineer, приватный prompt, task prompt/id.

## Новый закрытый дефект — explicit malformed sessionPrefix молча становился новой случайной сессией
До исправления `dispatchSubagents()` строил prefix через `String(options.sessionPrefix || generated)`. Поэтому явно переданные `''`, `null`, `false`, `0` не отклонялись, а незаметно заменялись новым случайным `subagent-<uuid>`. Для повторяемой/восстанавливаемой задачи это могло тихо потерять ожидаемую идентичность сессии и начать новую цепочку.

Исправлено:
- `6f4a79154f349b2b8f03d23b55fbb73b03a3ad91` — добавлен `resolveSessionPrefix()`: отсутствие поля по-прежнему создаёт свежий prefix, но явно переданное некорректное значение fail-closed с `QWEN_SUBAGENT_SESSION_ID_INVALID` до запроса;
- `ee1c596534dc926edcdef97886801bfd36fe4ae3` — `subagent-dispatcher-test.js` закрепляет malformed prefix + omitted-prefix generation.

Diff `8d7a54d... -> ee1c596...` ограничен только `src/subagent-dispatcher.js` и его test (`+50/-7`). Hosted targeted semantic PASS без provider traffic:
`QWEN_SUBAGENT_SESSION_PREFIX_TARGET_PASS invalid=8 omitted_generated=1 exact_valid=1 provider_calls=0`.

## Текущий targeted Core / Reliability статус
Fresh compare `0c8b0c8... -> 8d7a54d...` показал: session/restart/agent Core-байты не менялись; менялись только `account-store`, package wiring и plain subagent dispatcher/test. Поэтому ранее полученные exact session/restart/owner targeted PASS остаются применимы к неизменённым Core-байтам; новый dispatcher-кусок дополнительно проверен targeted PASS выше.

Fresh `QWEN_RELIABILITY.md` фиксирует targeted PASS для текущего account-store product fix; единственный commit после reliability handoff до `8d7a54d...` добавлял только дополнительный account filename regression, без изменения `account-store`. Наши два новых Core-коммита account/provider bytes не трогают. Значит targeted Core + Reliability доказательства сейчас сведены на product SHA `ee1c596...` без повторного provider traffic.

## Финальный CircleCI gate — ЗАПУЩЕН один раз на exact product SHA
Согласно `autonomy/ci/CIRCLECI_GATE_POLICY.md`, disposable branch `ci/qwen-final-gate` сначала принудительно передвинут ровно на product SHA `ee1c596534dc926edcdef97886801bfd36fe4ae3` (разрешённое policy исключение только для gate branch).

Затем на gate branch создан один изолированный config commit:
`246dcfcf810c9cfb01fc4ca72b9d99a50504bb2b`.

Gate semantics:
1. Linux: Node 22.23.1, locked `npm ci --ignore-scripts --no-audit --no-fund`, полный `npm test`, artifact log.
2. Windows запускается только ПОСЛЕ Linux PASS (`requires`). Native `windows-server-2022-gui:current`, exact Node 22.23.1 zip from nodejs.org, locked npm ci, полный `npm test`, artifact log.
3. Никаких runtime secrets, provider/live calls, deploy/production действий.

GitHub combined-status surface для gate commit пока возвращает пустой список. Это НЕ PASS и НЕ FAIL. По policy текущая классификация: `RESULT_ACCESS_UNAVAILABLE/PENDING_SURFACE`. Второй gate на этот же product SHA не запускать.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Стартовый pointer этого прохода:
- LATEST blob `abaccea380ab01f0b8ab79d748cf7e6f58dc2324`;
- capsule `20260822T185158Z-ccda10dbcb`;
- archive SHA-256 `5cf14b1a86027f65b6758f2ccbeadc8dab2c7cf165bd376faa448552e2287ab8`.

Новая capsule должна публиковаться только нормативным `capsule_runtime_v4.py` и только через CAS от этого стартового blob. При любом несовпадении parent SHA — force-write запрещён, оставить immutable orphan и принять более нового писателя.

## Следующий точный порядок
1. Fresh-read PR #6, QWEN_RELIABILITY и gate commit status.
2. Не повторять CircleCI для `ee1c596...`.
3. Если Linux gate FAIL — взять первый доказанный корень из exact full suite, исправить только его, локально targeted verify, затем новый gate только на изменённом product SHA.
4. Если Linux PASS, дождаться native Windows результата того же workflow. Windows FAIL — реальный blocker; чинить Windows-корень и повторять только после релевантного изменения product bytes.
5. Если оба PASS — записать exact evidence и проверить отсутствие свежего серьёзного RED в Core/Reliability; только тогда `QWEN_CORE_DONE`.
6. Уже доказанные live/provider прогоны без новой причины не повторять.

Live/provider traffic, реальные аккаунты, секреты, Cloudflare, production и GitHub Actions в этом проходе не использовались.
