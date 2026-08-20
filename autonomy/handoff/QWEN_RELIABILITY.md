# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head: `b19b8d19f9a19170feb19ed27cbd6676ecffe831`.

## Уже доказано и не переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, provider-wide WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет account/thread affinity, а допустимый failover переносит локальную историю в свежий тред другого аккаунта;
- stale `current()`/`preferredAccount` fail-open закрыт: configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- cooldown монотонный; поздняя CAPTCHA в принятом SSE идёт через `markCaptchaChallenge`;
- duplicate `Failed to generate chat_id` classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- automatic retry поздней SSE-ошибки отсутствует;
- pending tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`;
- `src/stream-session-guard.js` удерживает потоковые mutating tool-calls до durable acceptance; поздняя SSE-ошибка не выпускает их клиенту;
- streaming и оба non-stream `sessionStore.set() === false` fail-open закрыты через `QWEN_TOOL_CHECKPOINT_REJECTED`;
- account-scoped reset больше не снимает provider-wide circuit с `accountId=null`;
- transport error после принятого SSE теперь проходит в account/provider classification ровно один раз;
- регрессия охватывает два tool-call в одном потоке и позднюю CAPTCHA.

## Закрыто в этом запуске: удаление аккаунта могло разойтись между диском и памятью

На старте PR #6 был уже на `394f048991003df5980aef3e8a2f2121db60ae58` — пять коммитов поверх прошлого handoff; они не затрагивали `account-store`.

Найден отдельный crash/durability дефект в `src/account-store.js::remove()`:

1. canonical `account.json` переименовывался в `.txn-delete-*`;
2. каталог синхронизировался — то есть отсутствие canonical-файла уже становилось durable;
3. затем `fs.rmSync(tombstone)` выполнялся без `try/catch`;
4. при `EIO/EPERM` на cleanup функция выбрасывала исключение **до** `accounts.delete(...)`.

Итог: текущий процесс продолжал считать аккаунт существующим и мог использовать его, хотя после restart загрузчик уже не видел canonical `.json`. Это расходилось с принципом «диск подтверждён первым, память публикуется после».

Исправлено коммитом `ba8be3b7888124ee8fd35fff6e1b333bb86d438b`:

- после успешного `syncParentDirectory(file)` удаление tombstone стало best-effort cleanup;
- cleanup failure больше не отменяет уже durable удаление canonical-файла;
- `accounts.delete(...)` выполняется и состояние текущего процесса совпадает с состоянием после restart.

Регресс добавлен коммитом `b19b8d19f9a19170feb19ed27cbd6676ecffe831` в `scripts/account-store-mutation-atomicity-test.js`:

- искусственно создаётся `EIO` только на удалении `.txn-delete-*`;
- `remove('beta')` обязан вернуть `true`;
- аккаунт обязан исчезнуть из памяти;
- canonical `beta.json` обязан отсутствовать;
- после `load()` аккаунт не должен появиться снова.

Сравнение `394f048... -> b19b8d1...` подтверждает узкий diff: `src/account-store.js` +5/-1 и тест +30 строк. Штатный `npm test` уже включает `account-store-mutation-atomicity-test.js`.

Hosted контейнер в этом запуске не имел DNS до GitHub, поэтому exact-tree `npm test` локально не заявляется. Внешние CI по правилам не запускались. Локальная модель последовательности отдельно воспроизвела исходное расхождение: canonical-файл уже отсутствует, tombstone остаётся, аккаунт всё ещё в памяти.

## Следующий найденный безопасный кусок

Проверить retry пустого non-stream ответа в `server.js`.

Сейчас после `Qwen upstream closed without a usable response` повтор строится с тем же `preferredAccount` и снова вызывает `qwenClient.sendChatRequest(..., preferredAccount)` до трёх раз. Для свежего треда это может приоритизировать тот же аккаунт вместо реального sibling failover, причём сам empty-response до окончания всей серии не получает отдельной account classification. Не менять это вслепую: сначала сделать офлайн-регресс с двумя аккаунтами и доказать фактический порядок кандидатов/счётчики ошибок. Требование: thread-affinity существующего upstream chat не ломать; новая fresh-thread retry может перейти на другой eligible account; provider-wide circuit остаётся fail-closed.

Также при первой доступной exact-tree материализации выполнить:

1. `node --check src/account-store.js`;
2. `node scripts/account-store-mutation-atomicity-test.js`;
3. `node scripts/stream-session-retry-sync-throw-test.js`;
4. затем обычный `npm test` на hosted машине без внешнего CI.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте этого запуска `LATEST.json` прочитан по правильному пути `autonomy/v3/workspaces/QWEN_RELIABILITY/LATEST.json`; стартовый Git blob SHA: `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c`. Он указывает на v4 capsule `20260820T200145Z-22a145762d`, archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`.

В этой среде GitHub-коннектор снова не даёт byte-safe монтирование удалённых part-файлов в hosted filesystem. Ручная реконструкция неизвестных capsule bytes из текста запрещена протоколом, поэтому `capsule_runtime_v4.py restore` не подменялся ручным вариантом. По failure policy работа продолжена от exact GitHub source floor.

Новая capsule в этом запуске не публиковалась: без нормативного restore -> checkpoint -> pack v4 -> immutable upload -> reread/verify -> CAS LATEST нельзя честно выполнить finish protocol. `LATEST` не тронут и force-write не делался. Существенное состояние сохранено exact product commits `ba8be3b...`, `b19b8d1...` и этим handoff.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный `npm test` не заявляется;
- продуктовый head: `b19b8d19f9a19170feb19ed27cbd6676ecffe831`;
- нормативный `LATEST` остаётся `20260820T200145Z-22a145762d`;
- следующий приоритет: доказать и при необходимости исправить non-stream empty-response retry, не ломая account/thread affinity.
