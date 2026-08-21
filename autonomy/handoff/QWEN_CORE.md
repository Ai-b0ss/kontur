# Qwen — агентное ядро

Обновлено: 2026-08-21 13:57Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head снова точно `861a8f176a6037acaec5721b2f6bbad3041d7dd9`.

Основные Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call фиксируется до выдачи клиенту, системные инструкции сохраняются, одинаковый `tool_call.id` не схлопывает несколько pending-вызовов, запросы одной OpenCode-сессии сериализуются. Stale-backup recovery уже работает fail-closed: восстановленная из `.bak` сессия не переиспользует старый `chatId` и требует явной полной сверки истории.

## Новый существенный факт: внешний HTTP-контракт stale-backup recovery не доведён

На exact head проверены канонические файлы:

- `src/session-store.js`, Git blob `d13f79a1c999ca5221cac190ad7b155f4854ae9b`: `recoveryUncertainError()` создаёт ошибку с кодом `QWEN_SESSION_RECOVERY_UNCERTAIN` и останавливает небезопасное продолжение до обращения к провайдеру;
- `server.js`, Git blob `b6131886a6ff739eb35765982d778632e25ab689`: внешний catch отдельно отображает `QWEN_NO_ELIGIBLE_ACCOUNT` и `QWEN_TOOL_CHECKPOINT_REJECTED`, но не `QWEN_SESSION_RECOVERY_UNCERTAIN`.

Следствие: безопасная внутренняя остановка сейчас наружу превращается в общий HTTP 500 без стабильного кода. Для OpenCode это хуже, чем нужно: клиент не может отличить «сессия восстановлена из потенциально устаревшего backup и требует явной сверки» от обычной ошибки сервера.

Точный целевой контракт:

- HTTP `409`;
- `error.type = "conflict"`;
- `error.code = "QWEN_SESSION_RECOVERY_UNCERTAIN"`;
- `error.message` сохраняет исходное пояснение;
- до `qwenClient.sendChatRequest` не должно дойти ни одного вызова.

Во время попытки прямой записи `server.js` доступный contents-интерфейс потребовал заменить весь большой файл. Первая версия дала широкий форматный diff (`31 additions / 122 deletions`, commit `c2dcfcb907c0432930ce58d3fb5a7b532fdebe4e`) при одном смысловом изменении. Такая запись была немедленно отклонена: после проверки, что параллельного нового head нет, ветка возвращена точно на `861a8f176…`. Повторять ручную переформатированную замену целого `server.js` нельзя.

## Граница доказанного

- Внутренняя fail-closed семантика `QWEN_SESSION_RECOVERY_UNCERTAIN` доказана предыдущим targeted-тестом.
- Внешний server catch на текущем head действительно не имеет dedicated mapping и поэтому отдаёт generic 500.
- Само исправление HTTP-контракта ещё не коммитить через lossy whole-file rewrite; нужен exact-byte-preserving способ материализовать исходный blob, внести минимальную вставку и опубликовать получившийся точный blob/tree.
- Полный exact-tree `npm test` этого приватного репозитория не заявлен.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Постоянная память

В начале запуска `LATEST` имел Git blob SHA `2c1e39a14ec96eef6e3e956da3eee03e9b36109d` и указывал на `20260821T131014Z-385b7edd00`, archive SHA-256 `116baa72309ba18e558f33f58d8f2bc1ea5c959f6bfa84c8f4bb98226f726818`.

Нормативный `capsule_runtime_v4.py` материализован побайтно; локальный Git blob совпал с каноном: `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Стартовая capsule прошла exact `verify + restore`.

После работы собрана новая v4 capsule `20260821T135609Z-ef0c623a2d`, source ref `861a8f176…`, archive SHA-256 `7f7bf342e5c19ee31a00e78d27d45181eb035fc0f4615d0733243f4f915c40cd`. После immutable upload оба part и manifest перечитаны из GitHub; содержимое совпало с локальными байтами. Перед публикацией `LATEST` всё ещё имел исходный parent blob `2c1e39a1…`, поэтому CAS прошёл штатно: старый указатель сохранён как `PREVIOUS`, новый `LATEST` опубликован без force-write.

## Следующее

1. Материализовать exact `server.js` из Git blob `b6131886…` на hosted-машине и применить только одну ветку mapping для `QWEN_SESSION_RECOVERY_UNCERTAIN` без любых форматных изменений.
2. Добавить offline-regression: stale-backup short continuation → HTTP 409/conflict/stable code, `qwenClient.sendChatRequest` не вызывается.
3. Затем прогнать ближайший server/session/restart-кластер на hosted-машине. Полный `npm test` заявлять только если действительно материализован весь exact tree.
