# Qwen — агентное ядро

Обновлено: 2026-08-21 13:12Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий наблюдавшийся head `861a8f176a6037acaec5721b2f6bbad3041d7dd9`.

Основные прежние Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call сначала фиксируется и только потом выдаётся клиенту, системные инструкции сохраняются, одинаковый `tool_call.id` не схлопывает несколько незавершённых вызовов, запросы одной OpenCode-сессии сериализуются.

## Новый существенный результат: stale backup recovery закрыт fail-closed

Ранее `session-store` уже помечал записи, поднятые из `.bak`, как `recoveryState().uncertain`, но сервер всё ещё мог получить из такого backup старый `chatId`, а короткое продолжение могло восстановить устаревшую историю. Опасный порядок воспроизводим: primary уже содержит более новый принятый изменяющий tool-call → обновление backup падает → primary позже повреждается → restart видит только старый backup и может забыть уже принятый вызов.

Исправление в PR #6:

- `843b1317959f4257b523fa43e6ffffa3b191b9f1` — backup-recovered запись больше не отдаёт старый upstream `chatId`; короткое продолжение получает `QWEN_SESSION_RECOVERY_UNCERTAIN`; полная история допускается только после безопасной сверки;
- `2b9e9d51e8aea8ec49002104c951846c11d62d27` — общий `sessionStore.set()` тоже запрещён, пока backup-состояние остаётся неопределённым, чтобы его нельзя было случайно «отмыть» в новый доверенный primary;
- `172d25f0f4f00dda796d4db66913b5916caac6f3` — добавлена отдельная целевая проверка `session-stale-backup-recovery-test.js`;
- `861a8f176a6037acaec5721b2f6bbad3041d7dd9` — существующий `session-store-restart-test.js`, который уже входит в `npm test`, обновлён под новую fail-closed семантику и теперь моделирует именно `primary newer → backup stale → primary corrupt`.

Правило восстановления теперь такое:

- `getRecord()` для backup-recovered session маскирует старый `chatId` и помечает запись `recoveryUncertain`;
- обычный `set()` для такого ключа запрещён;
- короткое/инкрементальное продолжение запрещено;
- просто дописанный пользователем `continue` к старой истории не считается доказательством актуальности;
- полная история с незавершённым tool-call не принимается;
- неопределённость снимается только если полная входная история содержит восстановленный backup как последовательность и имеет более новый assistant/tool progress без pending tool-call;
- после такой сверки история сначала долговечно переписывается, `chatId` принудительно становится `null`, и следующий провайдерный ход обязан создать свежий Qwen-тред.

На ChatGPT hosted-машине без сети к Qwen целевая проверка прошла:

`QWEN_SESSION_STALE_BACKUP_RECOVERY_PASS backup_chat_not_reused=1 uncertain_write_blocked=1 short_continue_blocked=1 user_only_blocked=1 pending_full_blocked=1 explicit_full_reconciled=1 fresh_thread_required=1`

Локальный кандидат `src/session-store.js` после записи совпал с GitHub по Git blob SHA `d13f79a1c999ca5221cac190ad7b155f4854ae9b`.

## Граница доказанного

Полный exact-tree `npm test` этого приватного репозитория в данном проходе не заявлен. Новый `session-store-restart-test.js` сохранён в каноническом наборе и будет выполнен обычным `npm test`, но внешний CI для этого не запускался. Узкая политика cooldown/account selection не менялась. GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Постоянная память

В начале запуска `LATEST` был прочитан с Git blob SHA `3e6464e39f8477e06ced07f7940b63db48374205` и указывал на capsule `20260821T120310Z-39932ef3bb`, archive SHA-256 `727869e436a9b2777c434b2ace7dcd4c83c6bc02065f12317d182919b507c5cb`.

Нормативный `autonomy/v3/tools/capsule_runtime_v4.py` был материализован побайтно: Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Стартовая capsule прошла exact v4 `verify + restore`.

После исправления exact v4 собрал новую capsule `20260821T131014Z-385b7edd00`, source ref `861a8f176…`, archive SHA-256 `116baa72309ba18e558f33f58d8f2bc1ea5c959f6bfa84c8f4bb98226f726818`. После immutable upload оба part и manifest перечитаны; их Git blob SHA совпали с локально рассчитанными:

- `part-0000.b64` → `608ebe6a56a2e3df2b17a74b9f5138eb1485036f`;
- `part-0001.b64` → `6ceef67d29f0e5d902e0875c24dc4dcb9b406d71`;
- `manifest.json` → `616ec74aa140f853f9fe21aeb2311c4aa7256b06`.

Перед публикацией `LATEST` всё ещё имел исходный blob `3e6464e3…`, поэтому CAS прошёл штатно. Старый LATEST сохранён как PREVIOUS, новый LATEST указывает на `20260821T131014Z-385b7edd00` и имеет blob `2c1e39a14ec96eef6e3e956da3eee03e9b36109d`.

## Следующее

1. На hosted-машине материализовать достаточный exact-tree и выполнить `session-store-restart-test.js` вместе с ближайшим session/restart-кластером; полный `npm test` заявлять только если действительно материализован весь exact tree.
2. Проверить внешний контракт ошибки `QWEN_SESSION_RECOVERY_UNCERTAIN`: сейчас она безопасно останавливает запрос до провайдера, но отдельный OpenAI-compatible HTTP-код/тело для неё ещё не доказаны.
3. После нового воспроизводимого Core-дефекта продолжать тем же правилом: локальный тест → минимальное исправление → постоянный regression → exact v4 checkpoint.
