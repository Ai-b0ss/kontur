# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head: `dc7a6d790846cf10920f296d400f8ceb882f9842`.

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
- transport error после принятого SSE проходит в account/provider classification ровно один раз;
- удаление аккаунта после durable rename больше не расходится между диском и памятью при сбое cleanup tombstone.

## Закрыто в этом запуске: пустой initial SSE снова выбирал тот же preferred account

Исходный дефект был в связке `src/qwen-client.js` + non-stream retry `server.js`.

`gateInitialStream()` при окончании пустого/metadata-only SSE раньше возвращал `status=true` с `confirmedResponse=false`. Затем `collectNonStream()` выбрасывал `Qwen upstream closed without a usable response`, а `server.js` повторял запрос с тем же `preferredAccount`. Поскольку пустой ответ не успевал получить account classification/cooldown, повтор мог снова приоритизировать тот же аккаунт вместо sibling failover.

Исправление на PR #6:

- `gateInitialStream()` при фактическом `end` без usable model frame теперь возвращает `failureClass='empty_response'` и не выпускает такой поток дальше;
- `sendChatRequest()` классифицирует этот случай как локальный сбой конкретного аккаунта через `markFailure(account, 'Qwen upstream closed without a usable response')` и продолжает уже существующий bounded candidate loop;
- если первый кандидат владел старым `chatId`, следующий sibling не может переиспользовать чужой upstream thread: `canReuseOriginalChatId()` остаётся прежним, sibling получает свежий `generateChatID(..., account)`.

Коммиты этой правки были технически в три шага из-за ошибки при первой полной записи большого файла; финальный read-back приведён к минимальному diff относительно предыдущего head. Итоговый diff `b19b8d1... -> dc7a6d7...` по продукту:

- `src/qwen-client.js`: +16/-2;
- новый `scripts/qwen-client-empty-response-failover-test.js`;
- одна вставка теста в штатный `npm test`.

Регресс проверяет:

1. полностью пустой завершившийся initial SSE => `empty_response`;
2. metadata-only завершившийся initial SSE => `empty_response`;
3. в исходнике `empty_response` обязан вызвать `markFailure` и `continue` bounded failover;
4. sibling не переиспользует `originalChatId` другого аккаунта.

На hosted-машине отдельно выполнена модель именно изменённого `gateInitialStream`: пустой поток, metadata-only поток и usable `choices` — PASS (`HOSTED_EMPTY_GATE_PASS`). Exact-tree `npm test` не заявляется: hosted git по-прежнему не имеет DNS до GitHub, а внешние CI по правилам не запускались.

## Следующий безопасный кусок

Проверить terminal-only initial SSE.

Сейчас `inspectInitialSSE()` считает одиночный `data: [DONE]` usable-ответом. Для non-stream это подозрительно: `collectNonStream()` без model content/tool-call такой ответ всё равно должен считать непригодным. Если подтвердится, `[DONE]`-only снова обходит новый `empty_response` и попадает в старый server-level retry с тем же preferred account.

Минимальный регресс: `data: [DONE]\n\n` без `choices/data:true` не должен считаться usable completion; при этом нормальный поток с `choices` до terminal marker не должен ломаться. Исправлять только после точного офлайн-доказательства, не менять provider-wide circuit и не ломать thread affinity.

При первой доступной exact-tree материализации выполнить:

1. `node --check src/qwen-client.js`;
2. `node scripts/qwen-client-empty-response-failover-test.js`;
3. `node scripts/qwen-client-chat-id-classification-test.js`;
4. `node scripts/qwen-client-thread-owner-test.js`;
5. `node scripts/account-store-cooldown-test.js`;
6. затем обычный `npm test` на hosted машине без внешнего CI.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте `LATEST.json` прочитан по `autonomy/v3/workspaces/QWEN_RELIABILITY/LATEST.json`; стартовый Git blob SHA: `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c`. Он указывает на v4 capsule `20260820T200145Z-22a145762d`, archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`.

В этом запуске удалось наконец материализовать все три immutable part-файла побайтно из GitHub, проверить их длины и SHA-256, собрать archive с точным SHA `1fb1a101...` и выполнить нормативные `capsule_runtime_v4.py verify` + `restore`: оба PASS. То есть работа действительно продолжена из восстановленного v4 workspace, а не из ручного пересказа.

Финальный checkpoint/pack/publish выполняется после записи этого handoff по обязательной двухфазной схеме. Если CAS родитель `LATEST` изменится относительно стартового blob SHA, новый указатель не форсировать.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- exact-tree `npm test` пока не заявляется;
- продуктовый head: `dc7a6d790846cf10920f296d400f8ceb882f9842`;
- текущий главный закрытый дефект: ended empty/metadata-only initial SSE теперь получает account-local classification и bounded sibling failover;
- следующий приоритет: проверить `[DONE]`-only initial SSE.
