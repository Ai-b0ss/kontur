# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head при последней сверке этого прохода: `d962843e2007a0dabc24a86a3e6d69c2737b32ea`.
Перед новой записью снова перечитать fresh PR head и `autonomy/handoff/QWEN_RELIABILITY.md`: reliability-worker работает параллельно.

## Уже закрыто — не открывать заново без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6 и строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent и coding-subagents принимают owner prompt только как непустую строку без преобразования;
- мягкие ошибки локальных инструментов используют `Error:`-контракт, чтобы агент не считал отказ успехом.

## Новый воспроизведённый Core-дефект — обязательные аргументы инструментов не проверяются на границе executor
На exact blob `src/tool-executor.js` `afb7eb1fbb79fcd6e29cce19261f126099f0c65c` JSON-схемы `TOOL_DEFS` объявляют обязательные поля, но `executeTool()` передаёт объект прямо в handler. `agent.js::parseToolArguments()` проверяет только что аргументы являются JSON-object, а не наличие required-полей.

Доказанные последствия:
- `read_file {}` превращает отсутствующий `path` в workspace root и может вернуть список каталога;
- `list_dir {}` молча перечисляет workspace root;
- `write_file {path}` превращает отсутствующий `content` в `''` и может обнулить файл;
- `append_file {path}` сообщает успех при отсутствующем `content`;
- `edit_file {path, old}` превращает отсутствующий `new` в `''` и может удалить совпавший текст.

RED-regression уже в product-ветке, но намеренно не включён в `npm test`, пока продуктовый фикс не внесён:
- `19ad11e065f6e7bf99996d54a11d563ecadfc646` — первичная проверка missing `read/list path`;
- `611216da95e28d3aa23fd60fb91a309cb8792701` — добавлены три mutating cases;
- current test blob `a49d1c9829a1e9ac3444dccf7c3aad6f176ae9d8`.

После этих Core-коммитов QWEN_RELIABILITY продвинул общий PR ещё на два коммита; между `611216...` и `d962843...` изменены только `src/qwen-client.js` и `package.json`. Core-test не затёрт; reliability-логику не перехватывать.

Byte-safe кандидат сохранён в control repo:
`autonomy/v3/candidates/QWEN_CORE_REQUIRED_TOOL_ARGUMENTS_20260822.patch`.
Evidence:
`autonomy/v3/evidence/QWEN_CORE_REQUIRED_TOOL_ARGUMENTS_20260822.json`.

Правильный контракт фикса:
- до handler валидировать required-поля из фактического `TOOL_DEFS`;
- missing/null required -> явный `Error:` без side effect;
- required string с неверным типом -> `Error:`, без неявного `String(...)`;
- required `path` не может быть пустым/пробельным;
- явно переданные `content: ''` и `new: ''` остаются легальными: пустой файл/осознанное удаление текста — допустимые операции.

Hosted targeted model без provider/CI:
`QWEN_REQUIRED_TOOL_ARGUMENTS_TARGET_PASS missing=5 explicit_empty_content=1 explicit_empty_replacement=1 blank_path=1 type_guard=1`.

Полный exact-tree `npm test` **не выполнялся**; весь PR зелёным не объявлять.

## CircleCI coordination
Старый final gate QWEN_RELIABILITY для product SHA `b49bec79def089680941ef4bd29cc2ded1198b69`, config commit `94f8ba55d75f076c58673bff3aabce7b8a756c54`, имеет недоступный/пустой status surface. Это не PASS и не FAIL. Не триггерить его повторно.
Новый gate разрешён только по `autonomy/ci/CIRCLECI_GATE_POLICY.md`: после targeted local PASS выбранного exact product SHA и fresh coordination с QWEN_RELIABILITY. На обычной product-ветке CircleCI как цикл разработки не запускать.

## Следующий точный шаг
1. Fresh-read PR #6 и QWEN_RELIABILITY handoff.
2. Byte-safe применить `QWEN_CORE_REQUIRED_TOOL_ARGUMENTS_20260822.patch` к fresh exact `src/tool-executor.js` без реконструкции неизвестных байтов большого файла.
3. На hosted машине прогнать:
   - `node scripts/tool-required-arguments-regression-test.js`;
   - `node scripts/tool-command-failure-test.js`;
   - ближайший agent tool-result regression.
4. Только после PASS включить новый regression в обычный `npm test`.
5. Затем продолжить exact owner/session/subagent/restart cluster и брать следующий воспроизводимый Core-дефект.
6. Уже доказанные live/provider прогоны не повторять без новой причины.

## Постоянная память — вход текущего прохода
- LATEST blob `47d8598da7366334f2466ac95edb39215939b8f0`;
- capsule `20260822T080159Z-5665c2fea3`;
- archive SHA-256 `ed660e6e6270ff2f5b74574909a9538a90f35685b5b0ec2a19faff9f03ffa931`;
- exact runtime blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- manifest + обе части materialized, нормативный v4 verify + restore: PASS.

GitHub Actions, новый CircleCI, live/provider traffic, аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
