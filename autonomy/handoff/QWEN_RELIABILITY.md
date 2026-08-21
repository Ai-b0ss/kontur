# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий фактически прочитанный head PR #6 на этом запуске: `acfb87af4831b6a3846b2edf1e599d20a769529b`.

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
- ended empty/metadata-only initial SSE получает account-local classification и bounded sibling failover, чужой upstream `chatId` соседнему аккаунту не переиспользуется;
- terminal-only initial SSE (`[DONE]`, `true`, `{data:true}`) больше не считается пригодным model output.

## Этот запуск: unconfirmed initial-gate release -> unusable end -> retry

Предыдущая гипотеза подтверждена на свежем head `acfb87af...`.

Фактическая цепочка в текущем коде:

1. `gateInitialStream()` может сделать `release(false)` по `INITIAL_STREAM_GATE_MS` или `MAX_INITIAL_STREAM_BUFFER`, не увидев настоящий `choices` frame. Это правильно само по себе: нельзя наказывать реально медленный/большой первый ответ только за задержку.
2. В таком случае `sendChatRequest()` возвращает `status:true`, но не делает ни `markSuccess`, ни `markFailure`.
3. Если затем весь уже отпущенный поток заканчивается без пригодного model output, `chatAdapter.collectNonStream()` в `server.js` выбрасывает `Qwen upstream closed without a usable response`.
4. Текущий retry в `server.js` снова готовит запрос с исходным `preferredAccount` и снова вызывает `sendChatRequest(..., preferredAccount)` до трёх раз.
5. Поскольку фактически провалившийся аккаунт до retry не получил account-local failure/cooldown, `operationCandidates(preferredAccount)` снова ставит его первым.

Hosted-репродукция без provider/live дала последовательность текущей политики `A -> A -> A`; после account-local классификации фактического производителя A следующий eligible candidate — B.

Вердикт: **DEFECT CONFIRMED**. Это не provider-wide ошибка и не повод менять сам `release(false)`.

## Минимальное безопасное исправление

Точный patch-кандидат сохранён в каноническом репозитории:

`autonomy/v3/candidates/QWEN_RELIABILITY_UNCONFIRMED_RETRY_FAILOVER_20260821.patch`

Семантика исправления:

- только после того, как `collectNonStream()` доказал, что весь unconfirmed stream действительно закончился без usable output, один раз сделать `markFailure` фактическому `response.account`;
- затем выбрать свежий eligible account из `accountStore.candidates()` и использовать его и в `preparePublicPayloadGoverned(... account: retryPreferred)`, и в `sendChatRequest(..., retryPreferred)`;
- если retry stream тоже позднее доказанно пустой, классифицировать именно `retry.account` один раз перед следующим bounded attempt;
- не делать двойной `markFailure` первоначальному аккаунту в общем `catch`;
- оставить `currentOnly:false`, чтобы sibling получил свежий upstream chat id и не использовал чужой тред;
- не менять provider-wide circuit;
- не делать account-local failure просто из-за timeout/buffer release, пока поток ещё может позже дать нормальный `choices`.

Продуктовый `server.js` на этом запуске НЕ перезаписывался: доступный GitHub Contents API требует полной замены большого общего файла, а connector выдаёт его содержимое частями. Риск затереть свежие соседние изменения выше пользы. Нужен byte-safe patch/git-исполнитель либо exact-tree на hosted машине.

## Обязательная регрессия после применения

Два eligible аккаунта A/B:

- A: initial gate делает unconfirmed release по timeout или buffer cap;
- поток A потом заканчивается без usable output;
- A получает account-local failure ровно один раз;
- следующий retry идёт через B, а не A;
- B получает свежий upstream thread, без reuse A `chatId`;
- если B тоже заканчивается пустым, B классифицируется один раз до следующего bounded attempt;
- медленный/большой поток, который позже даёт настоящий `choices`, не получает failure только за unconfirmed release;
- provider-wide WAF/trust/pressure по-прежнему прекращает sibling probing.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

Стартовый LATEST этого запуска:

- capsule `20260820T235859Z-e3c1e9ab99`;
- Git blob SHA `2bdb4223dc6796dc7f710680222837ee3f7a2729` — это CAS-parent, который нельзя подменять;
- archive SHA-256 `26bdb22db742625c9d890136dd6a6641db045b1eae81aea4e7b1a6ccaae7f549`;
- 1 part, manifest и part перечитаны из GitHub, длина/SHA части и archive size/SHA совпали.

Перед завершением запуска необходимо сделать новый checkpoint, нормативный v4 `pack`, immutable upload, повторное чтение всех parts/manifest и только затем CAS-публикацию LATEST. Если blob SHA LATEST уже не равен стартовому `2bdb4223...`, не force-write: оставить новую capsule immutable и принять более свежего писателя.

## Граница доказательства

- свежий прочитанный product head: `acfb87af4831b6a3846b2edf1e599d20a769529b`;
- unconfirmed-release retry defect подтверждён чтением свежего `qwen-client.js` + `server.js` и hosted-репродукцией;
- продуктовый patch пока не применён из-за отсутствия byte-safe способа изменить большой общий `server.js` в этой среде;
- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- следующий приоритет: применить сохранённый маленький patch byte-safe способом, затем hosted regression из раздела выше; после этого искать следующий безопасный дефект пула.
