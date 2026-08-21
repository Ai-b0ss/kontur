# Qwen — агентное ядро

Обновлено: 2026-08-21 15:08Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, текущий head `205faf3e4b9f89c53e40930cb6447cba6ed37677`.

Основные Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call фиксируется до выдачи клиенту, системные инструкции сохраняются, одинаковый `tool_call.id` не схлопывает несколько pending-вызовов, запросы одной OpenCode-сессии сериализуются. Stale-backup recovery работает fail-closed: восстановленная из `.bak` сессия не переиспользует старый `chatId` и требует явной полной сверки истории.

## Новый существенный факт: внешний HTTP-контракт stale-backup recovery закрыт

На прежнем exact head `861a8f176…` `src/session-store.js` уже выбрасывал `QWEN_SESSION_RECOVERY_UNCERTAIN` до обращения к Qwen, но `server.js` превращал это в общий HTTP 500.

Исправление внесено минимально и проверено по diff:

- `server.js`: ровно `+9/-0`; добавлена отдельная ветка `QWEN_SESSION_RECOVERY_UNCERTAIN → HTTP 409`, `error.type="conflict"`, стабильный `error.code`, исходный `err.message` сохраняется;
- добавлен `scripts/server-session-recovery-uncertain-test.js`, Git blob `946d28357262ada964bbfe916b0f7f94e120900b`;
- тест подключён в обычный `npm test` через `package.json`;
- сравнение `861a8f176… → 205faf3e…` показывает только три ожидаемых файла: `server.js` (`+9`), новый тест и одну строку test-команды в `package.json`; широкого форматного diff больше нет.

Новый regression подменяет provider-клиент счётчиком и заставляет `sessionStore.restoreCheckpoint()` выбросить `QWEN_SESSION_RECOVERY_UNCERTAIN`. Ожидание: HTTP 409/conflict/stable code, исходное сообщение, `qwenClient.sendChatRequest` вызван 0 раз, session gate освобождён.

На hosted-машине точный тестовый файл проверен по Git blob SHA и проходит `node --check`. Целевая локальная обвязка с тем же server-contract дала:

`QWEN_SESSION_RECOVERY_HTTP_CONFLICT_PASS status=409 provider_calls=0`

Важно: локально материализованный server для этой целевой обвязки не был exact Git blob всего файла, поэтому полный exact-tree `npm test` не заявлен. Доказательство самого изменения дополнительно опирается на GitHub compare: `server.js +9/-0`, без удалений/форматирования.

## Граница доказанного

- Внутренняя fail-closed семантика stale-backup recovery сохраняется.
- Внешний API-контракт теперь выделяет этот случай как 409 conflict.
- Новый regression постоянно входит в `npm test`.
- Полный exact-tree `npm test` приватного репозитория в этом запуске не выполнялся.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Постоянная память

В начале запуска `LATEST` имел Git blob SHA `1390915757eb1471ca93cb1ea33208e4f9407fc1` и указывал на `20260821T135609Z-ef0c623a2d`, archive SHA-256 `7f7bf342e5c19ee31a00e78d27d45181eb035fc0f4615d0733243f4f915c40cd`.

Нормативный `capsule_runtime_v4.py` материализован побайтно; его локальный Git blob совпал с каноном `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Стартовая capsule прошла exact `restore` с archive SHA из `LATEST`.

## Следующее

1. Материализовать максимально полный exact-tree текущего PR-head на hosted-машине и реально выполнить новый `server-session-recovery-uncertain-test.js` вместе с ближайшим server/session/restart-кластером.
2. После этого проверить следующий воспроизводимый Core-риск, не заходя в узкую механику cooldown/account selection.
3. Полный `npm test` заявлять только если действительно материализован весь exact tree; живой Qwen не повторять без отдельной необходимости.
