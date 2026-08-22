# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE после fresh-head сверки 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head: `36dcf2424923de926e3e04848ae2e5dfa6402645`.
Перед любой записью перечитать fresh head, `server.js`, `src/session-store.js`, `src/qwen-v3-capabilities.js`.

## Уже доказано — не исследовать заново
- tool-result continuation/restart и pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint и `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V5 семантика уже в продукте: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode fail-closed, project-only recovery block, owner checkpoint bound.

## Explicit owner regression gate
На head `36dcf242...` присутствуют и включены в обычный `npm test`:
- `scripts/session-explicit-owner-authority-test.js`
- `scripts/session-explicit-owner-recovery-test.js`
- `scripts/server-explicit-owner-rehydrate-test.js`

Full exact-tree `npm test` на этом head ещё не заявлен зелёным: hosted container не имеет прямого доступа к private GitHub, внешние CI по правилам не запускались.

## Новый воспроизводимый Core-дефект: malformed/ambiguous detached owner prompt
Fresh `server.js` на `36dcf242...` содержит `explicitOwnerSystemPrompt(body)`, который возвращает значение только если `owner_system_prompt`/`ownerSystemPrompt` уже строка; наличие поля неверного типа молча трактуется как «поля нет». Затем `restoreDurablePromptAuthority()` при `system_prompt_mode=owner` может подставить старый сохранённый `record.ownerSystemPrompt`.

Офлайн воспроизведение на hosted-машине, без Qwen/CI:
`QWEN_OWNER_PROMPT_MALFORMED_REPRODUCED malformed_falls_back_to_stale=1 conflicting_alias_silently_prefers_snake=1`

Доказаны два случая:
1. Сессия хранит `OLD_PRIVATE_OWNER`; клиент явно шлёт `system_prompt_mode=owner` и malformed `owner_system_prompt={text:"NEW_PRIVATE_OWNER"}`. Текущий код игнорирует malformed поле и восстанавливает `OLD_PRIVATE_OWNER`.
2. Если одновременно переданы `owner_system_prompt="A"` и `ownerSystemPrompt="B"`, текущий код молча выбирает snake_case `A`.

### Требуемая семантика исправления
Сделать одну раннюю проверку detached owner authority ДО `restoreCheckpoint`, ДО восстановления старого owner prompt, ДО provider traffic и без мутации session state:
- если ни одного alias нет — текущее наследование остаётся как есть;
- если присутствует ровно один alias — значение обязано быть строкой;
- если присутствуют оба alias — оба обязаны быть строками и побайтно совпадать; иначе fail-closed;
- стабильный bounded HTTP 400, например `QWEN_OWNER_SYSTEM_PROMPT_INVALID`, без отражения огромного/объектного входа в ошибке;
- provider calls = 0, session mutations = 0;
- тот же validator использовать в `src/qwen-v3-capabilities.js`, чтобы standalone/не-server callers не имели другой семантики.

Обязательный regression:
- malformed snake alias при сохранённом старом owner prompt → 400, старый prompt не наследуется;
- malformed camel alias → 400;
- conflicting A/B → 400;
- identical A/A → допустимо и exact;
- один корректный alias → прежняя lossless семантика;
- bounded error payload;
- provider_calls=0 и session_mutations=0 для rejected случаев.

Не вносить частичное исправление только в `qwen-v3-capabilities.js`: `server.js` способен восстановить старый detached prompt раньше `prepareInput`.

## Следующий обязательный Core gate
1. Fresh-read PR head; не перетирать параллельные Reliability изменения.
2. Исправить malformed/alias-conflict owner authority как один атомарный Core-пакет + regression, только из exact bytes.
3. Материализовать exact session/restart cluster на hosted машине.
4. Выполнить targeted owner/recovery/system tests + `node --check` для затронутых файлов.
5. После targeted PASS прогнать максимально полный local session/restart/system-prompt cluster; только затем считать explicit-owner gate закрытым.
6. После зелёного Core offline gate переходить к финальным restart/recovery/failover/live E2E, не повторяя уже доказанные provider-прогоны без необходимости.

## Постоянная память / capsule
Стартовый LATEST этого запуска:
- pointer blob SHA `ee6b002aa75c6d081cab14757552228d3aff1e98`;
- capsule `20260821T220228Z-52165ac56c`;
- archive SHA-256 `6b78f650eda0d20e184dc048a4818036b2879181bea8d1f30609de78fa07502e`.

Нормативный `capsule_runtime_v4.py` теперь УСПЕШНО материализован на hosted-машине точными байтами: size 8079, Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`, совпадает с каноном. Обе части стартовой capsule были повторно получены exact через GitHub, их длины/SHA совпали с manifest. `verify` и `restore` через exact v4 прошли PASS. Предыдущий handoff о невозможности exact runtime materialization устарел.

После текущей существенной работы создан нормативный v4 checkpoint:
- capsule `20260821T235937Z-a7790a150d`;
- archive SHA-256 `bf058145225d1884929dac6c404d889d1fc7de4f4613a267d895e23ecbd413ba`;
- 2 immutable parts (2048 + 44 chars), локальный `verify` PASS;
- обе части и manifest загружены в GitHub, затем перечитаны; их Git blob SHA совпали с локальными exact bytes.

Перед публикацией LATEST был перечитан и всё ещё имел стартовый blob SHA `ee6b002a...`; CAS-конфликта не было. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован через `update_file` ровно с исходным parent SHA. Новый pointer blob SHA `2b569616905f3f7becca542c5e628d6c8128de32`.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовались.
