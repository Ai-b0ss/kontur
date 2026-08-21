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
1. Сессия хранит `OLD_PRIVATE_OWNER`; клиент явно шлёт `system_prompt_mode=owner` и malformed `owner_system_prompt={text:"NEW_PRIVATE_OWNER"}`. Текущий код игнорирует malformed поле и восстанавливает `OLD_PRIVATE_OWNER`. Это неверная власть промпта: явная новая попытка не должна молча превращаться в старую.
2. Если одновременно переданы `owner_system_prompt="A"` и `ownerSystemPrompt="B"`, текущий код молча выбирает snake_case `A`. Конфликт управляющих алиасов должен быть явной ошибкой, а не скрытым приоритетом.

### Требуемая семантика исправления
Сделать одну раннюю проверку detached owner authority ДО `restoreCheckpoint`, ДО восстановления старого owner prompt, ДО provider traffic и без мутации session state:
- если ни одного alias нет — текущее наследование остаётся как есть;
- если присутствует ровно один alias — значение обязано быть строкой (пустая строка допустима как явный exact prompt, если это уже поддерживаемая семантика);
- если присутствуют оба alias — оба обязаны быть строками и побайтно совпадать; иначе fail-closed;
- стабильный bounded HTTP 400, например `QWEN_OWNER_SYSTEM_PROMPT_INVALID`, без отражения огромного/объектного входа в ошибке;
- provider calls = 0, session mutations = 0;
- тот же validator должен использоваться в `src/qwen-v3-capabilities.js`, чтобы standalone/не-server callers не имели другой семантики.

Обязательный regression должен покрыть:
- malformed snake alias при сохранённом старом owner prompt → 400, старый prompt не наследуется;
- malformed camel alias → 400;
- conflicting string aliases A/B → 400;
- identical aliases A/A → допустимо и exact;
- один корректный alias → прежняя lossless семантика;
- error payload bounded;
- provider_calls=0 и session_mutations=0 для всех rejected случаев.

Не вносить частичное исправление только в `qwen-v3-capabilities.js`: `server.js` сейчас способен восстановить старый detached prompt раньше `prepareInput`, поэтому валидация нужна на серверной границе тоже.

## Следующий обязательный Core gate
1. Fresh-read PR head; не перетирать параллельные Reliability изменения.
2. Исправить malformed/alias-conflict owner authority как один атомарный Core-пакет + regression.
3. Затем материализовать exact session/restart cluster на hosted машине через доступные exact GitHub bytes/другой безопасный read-only путь.
4. Выполнить targeted:
   - `node scripts/session-explicit-owner-authority-test.js`
   - `node scripts/session-explicit-owner-recovery-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - новый malformed-owner regression
   - `node scripts/server-system-checkpoint-rejected-test.js`
   - `node --check server.js`
   - `node --check src/session-store.js`
   - `node --check src/qwen-v3-capabilities.js`
5. После targeted PASS прогнать максимально полный local session/restart/system-prompt cluster; только затем считать explicit-owner gate закрытым.
6. После зелёного Core offline gate переходить к финальным restart/recovery/failover/live E2E, не повторяя уже доказанные provider-прогоны без необходимости.

## Постоянная память / capsule
В начале запуска прочитан `autonomy/v3/workspaces/QWEN_CORE/LATEST.json`: capsule `20260821T220228Z-52165ac56c`, archive SHA-256 `6b78f650eda0d20e184dc048a4818036b2879181bea8d1f30609de78fa07502e`, стартовый Git blob SHA указателя `ee6b002aa75c6d081cab14757552228d3aff1e98`.
Manifest: `free_fabric_worker_capsule_v4`, 2 parts, source_ref `a0ec9110da9fefb32700e8996d63df53ee818df8`; обе части перечитаны из GitHub.

Нормативный `capsule_runtime_v4.py` имеет Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. В этом запуске доступный перенос в hosted filesystem снова не дал доказанно exact bytes runtime. По протоколу ручная сокращённая restore/pack не использовалась. Recovery floor — exact GitHub source; новую псевдо-v4 capsule и `LATEST/PREVIOUS` не публиковать. Следующий запуск должен сначала попытаться материализовать exact runtime bytes безопасным способом; если это опять невозможно, продолжать продуктовую работу от exact GitHub source, не подделывая v4.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production без отдельной необходимости не запускать.
