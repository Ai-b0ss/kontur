# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head после этого запуска: `f5194f8030632037e4dcda5a54037f216be9f4db`.

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
- удаление аккаунта после durable rename больше не расходится между диском и памятью при сбое cleanup tombstone;
- ended empty/metadata-only initial SSE получает account-local classification и bounded sibling failover, чужой upstream `chatId` соседнему аккаунту не переиспользуется.

## Закрыто в этом запуске: terminal-only initial SSE

На свежем head PR #6 подтверждён старый дефект: `inspectInitialSSE()` считал одиночные `data: [DONE]`, `data: true` и `data: {"data":true}` доказательством пригодного ответа. Поэтому terminal-only поток мог пройти initial gate как подтверждённый и далее превратиться в успешный пустой completion.

Исправление:

- commit `83b43364ba48fcea4d8d0f8394549c6cf64d7000`: `[DONE]`, `true` и `{data:true}` теперь только terminal/metadata markers и сами по себе не делают поток usable;
- настоящий `choices` frame по-прежнему подтверждает ответ немедленно, поэтому нормальный `choices -> [DONE]` не задерживается и не ломается;
- если поток заканчивается только terminal/metadata markers, `gateInitialStream()` возвращает `failureClass='empty_response'`, а существующий `sendChatRequest()` уже охлаждает конкретный аккаунт и продолжает bounded sibling failover;
- commit `f5194f8030632037e4dcda5a54037f216be9f4db`: существующая штатная регрессия расширена случаями `[DONE]`-only, `true`-only, `{data:true}`-only и `choices -> [DONE]`, плюс запрет отката к старой трактовке terminal markers.

Hosted-проверка изменённого решения дала `HOSTED_TERMINAL_ONLY_SSE_PASS`. CircleCI, GitHub Actions, Cloudflare и provider/live не запускались. Exact-tree `npm test` не заявляется: в hosted-среде нет готового дерева со всеми зависимостями, а внешний CI по правилам не использовался.

## Следующий участок — сначала воспроизвести, потом чинить

`gateInitialStream()` всё ещё имеет два пути `release(false)` до появления настоящего model frame: по `INITIAL_STREAM_GATE_MS` и по `MAX_INITIAL_STREAM_BUFFER`. Это намеренно позволяет не держать initial gate бесконечно, поэтому нельзя просто заменить эти выходы на ошибку: реальный первый model frame может быть медленным или большим.

Но для non-stream есть потенциальный failover-дефект: если такой unconfirmed stream после release(false) затем заканчивается без пригодного model output, `collectNonStream()` выбрасывает `Qwen upstream closed without a usable response`, а текущий retry в `server.js` снова передаёт исходный `preferredAccount`. Поскольку qwen-client до release(false) не классифицировал аккаунт как локально сбойный, тот же аккаунт может снова стать первым кандидатом.

Следующий запуск должен сначала сделать офлайн-регрессию для цепочки `unconfirmed release -> unusable end -> retry`, доказать или опровергнуть повтор того же аккаунта. Если дефект подтверждается, минимальный безопасный вариант — account-local classification перед retry, не ломая legitimate slow/large first frame, provider-wide circuit и account/thread affinity.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте `LATEST.json` имел Git blob SHA `b52c19488cc0e0a3149d04efd2700c376314d699` и указывал на проверенную v4 capsule `20260820T225643Z-867784cee7`.

В начале запуска её manifest и все три immutable part-файла были прочитаны, материализованы и прошли нормативные `verify` + `restore` через v4 runtime.

После продуктовой работы первая большая новая capsule `20260820T235549Z-cfb1ce85b2` была отклонена до публикации: обязательное повторное чтение обнаружило несовпадение Git blob для одного part-файла. Она оставлена immutable orphan и на неё нельзя указывать LATEST.

Затем собрана минимальная чистая v4 capsule:

- capsule `20260820T235859Z-e3c1e9ab99`;
- archive SHA-256 `26bdb22db742625c9d890136dd6a6641db045b1eae81aea4e7b1a6ccaae7f549`;
- 1 immutable part;
- source ref `Ai-b0ss/qwen-free-api@f5194f8030632037e4dcda5a54037f216be9f4db`.

Локальные `verify` и `restore` дали PASS. После загрузки part и manifest перечитаны из GitHub; их Git blob SHA совпали с локально рассчитанными exact blob SHA (`371dd54b...` и `6267355e...`), manifest и archive SHA совпали. Перед CAS `LATEST.json` был перечитан и всё ещё имел стартовый blob SHA `b52c1948...`, то есть конфликтующего писателя не было. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован только через `update_file` с exact родительским SHA и перечитан после записи.

Текущий LATEST:

- capsule `20260820T235859Z-e3c1e9ab99`;
- Git blob SHA `2bdb4223dc6796dc7f710680222837ee3f7a2729`;
- archive SHA-256 `26bdb22db742625c9d890136dd6a6641db045b1eae81aea4e7b1a6ccaae7f549`.

## Граница доказательства

- product head: `f5194f8030632037e4dcda5a54037f216be9f4db`;
- terminal-only SSE defect закрыт;
- hosted targeted proof PASS;
- exact-tree `npm test` не заявляется;
- CircleCI/GitHub Actions/Cloudflare/provider-live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- следующий приоритет: воспроизвести unconfirmed initial-gate release + non-stream retry и проверить, не выбирается ли снова тот же preferred account.
