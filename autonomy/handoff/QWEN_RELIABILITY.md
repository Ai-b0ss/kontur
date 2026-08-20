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

## Закрыто: пустой initial SSE снова выбирал тот же preferred account

Исходный дефект был в связке `src/qwen-client.js` + non-stream retry `server.js`.

`gateInitialStream()` при окончании пустого/metadata-only SSE раньше возвращал `status=true` с `confirmedResponse=false`. Затем `collectNonStream()` выбрасывал `Qwen upstream closed without a usable response`, а `server.js` повторял запрос с тем же `preferredAccount`. Поскольку пустой ответ не успевал получить account classification/cooldown, повтор мог снова приоритизировать тот же аккаунт вместо sibling failover.

Исправление на PR #6:

- `gateInitialStream()` при фактическом `end` без usable model frame теперь возвращает `failureClass='empty_response'` и не выпускает такой поток дальше;
- `sendChatRequest()` классифицирует этот случай как локальный сбой конкретного аккаунта через `markFailure(account, 'Qwen upstream closed without a usable response')` и продолжает уже существующий bounded candidate loop;
- если первый кандидат владел старым `chatId`, следующий sibling не может переиспользовать чужой upstream thread: `canReuseOriginalChatId()` остаётся прежним, sibling получает свежий `generateChatID(..., account)`.

Финальный diff `b19b8d1... -> dc7a6d7...` по продукту:

- `src/qwen-client.js`: +16/-2;
- новый `scripts/qwen-client-empty-response-failover-test.js`;
- одна вставка теста в штатный `npm test`.

Регресс проверяет пустой и metadata-only initial SSE, обязательный `markFailure + continue`, а также запрет sibling переиспользовать `originalChatId` другого аккаунта.

На hosted-машине отдельно выполнена модель изменённого `gateInitialStream`: пустой поток, metadata-only поток и usable `choices` — PASS (`HOSTED_EMPTY_GATE_PASS`). Exact-tree `npm test` не заявляется: hosted git по-прежнему не имеет DNS до GitHub, а внешние CI по правилам не запускались.

## Следующий подтверждённый дефект: terminal-only SSE

После предыдущего исправления прочитан exact `src/chat-adapter.js`. Уточнение к прежней гипотезе: terminal-only поток сейчас не просто попадает в server retry — он может быть принят как **успешный пустой ответ**.

Причина:

- `inspectInitialSSE()` считает одиночный `data: [DONE]` usable;
- `gateInitialStream()` поэтому выпускает поток как подтверждённый до `end`;
- `parseQwenSSE()` на `[DONE]` вызывает `close()` без ошибки;
- `collectNonStream()` после этого возвращает OpenAI completion с `content: null`, `finish_reason: 'stop'`.

Похожая граница есть у одиночного `data: true`: initial gate тоже считает его usable, хотя сам по себе он не содержит model output. Нормальный поток не пострадает от ужесточения, потому что при настоящем `choices` gate выпускает поток раньше terminal marker.

Следующее минимальное исправление:

1. `[DONE]` и `data:true` сами по себе не должны делать initial SSE usable;
2. если до terminal marker не было `choices`/другого настоящего model frame, `end` должен классифицироваться как `empty_response` и идти в уже исправленный account-local bounded failover;
3. поток с настоящим `choices` перед `[DONE]`/`true` остаётся usable;
4. добавить regression на `[DONE]`-only, `true`-only и `choices -> terminal`.

Не менять provider-wide circuit, account/thread affinity и side-effect guards.

При первой доступной exact-tree материализации выполнить:

1. `node --check src/qwen-client.js`;
2. `node scripts/qwen-client-empty-response-failover-test.js`;
3. `node scripts/qwen-client-chat-id-classification-test.js`;
4. `node scripts/qwen-client-thread-owner-test.js`;
5. `node scripts/account-store-cooldown-test.js`;
6. затем обычный `npm test` на hosted машине без внешнего CI.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте `LATEST.json` имел Git blob SHA `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c` и указывал на v4 capsule `20260820T200145Z-22a145762d` с archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`.

Все три part-файла старой capsule были материализованы побайтно, длины/SHA проверены, archive собран с точным SHA и нормативные `capsule_runtime_v4.py verify` + `restore` дали PASS.

После работы создан новый checkpoint и нормативным `pack` собрана capsule:

- capsule `20260820T225643Z-867784cee7`;
- archive SHA-256 `b183a152be9111a6491dc60d95df29034201108af656628eb9f6db3e2bd77339`;
- 3 immutable part-файла.

После загрузки все parts и manifest перечитаны из GitHub; их Git blob SHA совпали с локально рассчитанными exact blob SHA, manifest указывает на тот же archive SHA. Перед публикацией `LATEST` перечитан: родительский blob SHA всё ещё был стартовым `b7e0d3d...`, поэтому CAS-конфликта не было. Старый LATEST сохранён в PREVIOUS, новый LATEST опубликован через `update_file` с exact родительским SHA и после записи перечитан. Текущий LATEST blob SHA: `b52c19488cc0e0a3149d04efd2700c376314d699`.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- exact-tree `npm test` пока не заявляется;
- продуктовый head: `dc7a6d790846cf10920f296d400f8ceb882f9842`;
- текущий LATEST: `20260820T225643Z-867784cee7`;
- закрыто: ended empty/metadata-only initial SSE получает account-local classification и bounded sibling failover;
- следующий приоритет: terminal-only `[DONE]`/`data:true` не должен считаться успешным пустым completion.
