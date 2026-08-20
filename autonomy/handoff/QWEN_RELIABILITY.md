# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head на конец запуска: `d8522d514269caa00dbd2f47256ef0210a24f855`.

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
- регрессия охватывает два tool-call в одном потоке и позднюю CAPTCHA.

## Закрыто ранее: non-stream acknowledgement + provider-wide reset

Коммиты `5cb63f419c2fb711e1832367f22d20d5e8c33d7f` и `a485c11e9f18470989b9e36086ef1aced1c68d39` закрыли checked-save для основного non-stream пути и retry: клиент не получает mutating tool-call, если durable checkpoint отвергнут; локальный отказ checkpoint не штрафует Qwen-аккаунт.

Коммиты `a6f74660ca607b357b398e746a3eb68fdec208c8` и `d367bf0c4a5091d29bbed2b7546e352ddd2b1ff9` сделали account-scoped clear строгим: reset отдельного аккаунта может снять только circuit, явно принадлежащий этому аккаунту; provider-wide `accountId=null` требует глобального clear.

## Закрыто в этом запуске: transport error после принятия SSE не учитывался аккаунту

На старте PR #6 уже ушёл вперёд до `4d80c11634bb5b0d11906714358238aff2c60538` (5 коммитов поверх `d367bf0...`), изменения были только в `src/stream-session-guard.js`, его новом тесте и `package.json`.

Найден отдельный дефект: после initial SSE gate поток уже мог считаться принятым и аккаунт мог получить `markSuccess`, но последующий нативный `currentStream.emit('error', err)` в `pipeThroughOpenAIGuarded()` просто делал `res.end()` и `resolve()`. `opts.onError` не вызывался. Поэтому сервер не делал `accountStore.markFailure(...)`, и оборвавшийся посреди ответа аккаунт оставался без cooldown/ошибки и мог сразу снова выбираться следующей операцией.

Исправлено коммитом `0c5933529a9b33f1a088888195406b160ce97d3c`:

- transport `error` после принятого потока проходит через тот же `finishWithError`, что parser/upstream failures;
- `opts.onError` теперь вызывается ровно один раз, поэтому сервер классифицирует сбой выбранного аккаунта;
- клиент получает стабильный SSE error вместо молчаливого EOF;
- terminal ownership сохраняется: поздний parser callback не может повторно завершить ответ;
- удержанные mutating tool-calls не выпускаются, потому что durable acceptance не достигнут.

Коммит `d8522d514269caa00dbd2f47256ef0210a24f855` расширяет уже штатный `scripts/stream-session-retry-sync-throw-test.js`: принят частичный поток -> transport error -> observer ровно один раз -> ответ закрыт ровно один раз -> поздний parser failure игнорируется.

GitHub read-back до правки подтвердил исходный `onStreamError`, который не вызывал observer. Hosted-контейнер не смог клонировать GitHub (`Could not resolve host: github.com`), поэтому exact-tree Node run в этом запуске не заявляется. Внешние CI по правилам не запускались.

## Что проверить следующим

1. Read-back exact `d8522d5...` и при доступной материализации запустить `node --check src/stream-session-guard.js` + `node scripts/stream-session-retry-sync-throw-test.js`, затем обычный `npm test` локально/hosted без внешнего CI.
2. Продолжить поиск только по реальным acknowledgement/failover границам. Приоритет: операции, где локальная crash-safe запись/очистка может вернуть ошибку после частичного изменения памяти, либо где mid-stream failure не попадает в account/provider safety classification.
3. Не считать финальный streaming `sessionStore.set(...)` дефектом без отдельного воспроизведения: mutating calls к тому моменту уже имеют отдельный durable acknowledgement.
4. Не расширять работу на Qwen Core.

## Capsule runtime

Нормативный протокол: `CAPSULE_RUNTIME_PROTOCOL_V2.json` + `capsule_runtime_v4.py`.

В начале этого запуска `LATEST.json` прочитан по правильному пути `autonomy/v3/workspaces/QWEN_RELIABILITY/LATEST.json`; стартовый Git blob SHA: `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c`. Он указывает на v4 capsule `20260820T200145Z-22a145762d`, archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`. Manifest и все три parts были перечитаны отдельно из GitHub и соответствуют опубликованному manifest по заявленным длинам/SHA.

Из-за отсутствия прямого байтового монтирования ответов GitHub-коннектора в hosted filesystem в этом запуске не удалось честно выполнить локальную команду `capsule_runtime_v4.py restore` над этими удалёнными bytes без ручной реконструкции. Ручную реконструкцию неизвестных bytes протокол запрещает, поэтому она не делалась. Product work продолжен от exact GitHub source floor, что прямо разрешено failure policy.

Новая capsule в этом запуске НЕ публиковалась: без нормативного restore/pack + повторной byte-verification нельзя честно выполнить finish protocol. Состояние работы надёжно зафиксировано exact product commits `0c593352...`, `d8522d5...` и этим handoff. Следующий запуск должен снова начать с LATEST и, если появится byte-safe transport/mount, выполнить полный v4 restore и затем новый pack с новым immutable id. Старые failed upload каталоги не переиспользовать.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный `npm test` не заявляется;
- продуктовый head: `d8522d514269caa00dbd2f47256ef0210a24f855`;
- текущий нормативный LATEST остаётся `20260820T200145Z-22a145762d`; force-write не делался.
