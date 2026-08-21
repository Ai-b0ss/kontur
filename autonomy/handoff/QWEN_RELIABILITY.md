# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого запуска: `bfc8805395d4dfef13d63b089a007a1a64637848`.

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

## Главный незакрытый дефект: unconfirmed initial-gate release -> unusable end -> retry

Дефект повторно подтверждён уже на свежем head до этого запуска (`9dc80f6c...`), и наши два новых коммита его не затрагивают.

Текущий `server.js` всё ещё делает так:

1. `gateInitialStream()` может отпустить поток по timeout/buffer cap без подтверждённого `choices` — это само по себе допустимо;
2. если потом весь поток заканчивается без пригодного model output, `collectNonStream()` кидает `Qwen upstream closed without a usable response`;
3. retry до трёх раз снова вызывает `preparePublicPayloadGoverned(... account: preferredAccount)` и `sendChatRequest(..., preferredAccount)`;
4. фактически провалившийся аккаунт до retry не получает локальную классификацию, поэтому старый `preferredAccount=A` снова идёт первым.

Hosted-репродукция предыдущего запуска дала `A -> A -> A`; после локальной классификации A следующий eligible — B.

Точный patch-кандидат остаётся здесь:

`autonomy/v3/candidates/QWEN_RELIABILITY_UNCONFIRMED_RETRY_FAILOVER_20260821.patch`

Нужен byte-safe git/patch-исполнитель или exact-tree. Не заменять большой общий `server.js` целиком из частичного connector-вывода.

Обязательная регрессия после применения:

- A: unconfirmed release по timeout/buffer cap;
- поток A потом доказанно заканчивается без usable output;
- A получает account-local failure ровно один раз;
- следующий retry идёт через B;
- B получает свежий upstream thread, без reuse A `chatId`;
- если B тоже заканчивается пустым, B классифицируется один раз до следующей bounded попытки;
- медленный/большой поток, который позже даёт настоящий `choices`, не получает failure только за unconfirmed release;
- provider-wide WAF/trust/pressure по-прежнему прекращает sibling probing.

## Этот запуск: provider-circuit cleanup tombstone

Найден и исправлен отдельный дефект долговечности состояния provider circuit.

Старое поведение `removeState()`:

- canonical state уже переименован в tombstone;
- directory `fsync` успешно подтверждает долговечное удаление основного `provider-circuit.json`;
- затем `fs.rmSync(tombstone)` мог упасть;
- `clear()` возвращал ошибку, хотя после restart основной state уже отсутствовал.

Это рассинхронизировывало наблюдаемое состояние текущего процесса и состояние после перезапуска.

Исправление:

- commit `79bc28b7982f6d3bd0cc6ca4ab4b7e72dd4fe79f` — после подтверждённого durable deletion tombstone cleanup стал best-effort;
- commit `bfc8805395d4dfef13d63b089a007a1a64637848` — добавлена регрессия с искусственным `EIO` именно на cleanup tombstone;
- hosted synthetic proof: `PROVIDER_CIRCUIT_TOMBSTONE_CLEANUP_PASS`.

Смысловая граница не менялась: ошибка directory fsync ДО подтверждения canonical deletion по-прежнему обязана откатывать удаление и пробрасываться наружу.

## Проверки и ограничения запуска

- CircleCI не запускался;
- GitHub Actions не запускались;
- Cloudflare не использовался;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полного `npm test` exact-tree не заявлять: hosted машина не смогла клонировать GitHub по DNS; локально выполнена целевая synthetic-проверка изменённой семантики.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

Старт этого запуска:

- LATEST: `20260821T005909Z-ddaf24a921`;
- стартовый Git blob SHA LATEST: `1e9ce4fee846bfe9ab553969b85ef729d97f2774`;
- archive SHA из указателя: `66697451860e17c6577efa23aa4ff487615e626be119f36807cac9b80148499b`.

При локальной материализации bytes части через connector текст не совпал с manifest hash; неизвестные байты не угадывались. Полезная работа продолжена от exact GitHub product source как recovery floor.

Финиш этого запуска проведён нормативно для новой capsule:

- capsule: `20260821T015929Z-4b823c0fc1`;
- source ref: `Ai-b0ss/qwen-free-api@bfc8805395d4dfef13d63b089a007a1a64637848`;
- archive SHA-256: `efb09765aa9f261e94a238821ea02f93840223c8dee233dc378d39566ba6d787`;
- 1 part;
- remote part Git blob SHA `08ad6603181e7a299c692404dfe103380665c5d6` совпал с локально вычисленным Git blob SHA;
- remote manifest Git blob SHA `d2baa37c8c4be6e414274dbb5bb5592d91e2d511` совпал с локально вычисленным Git blob SHA;
- LATEST перед CAS повторно имел исходный blob SHA `1e9ce4fee...`, конфликта писателя не было;
- старый LATEST сохранён в PREVIOUS;
- новый LATEST опубликован CAS-обновлением и перечитан; его blob SHA `fafc1a99ed040da06be6cf1ef35fce82e2437be9`.

## Следующий приоритет

1. Применить `QWEN_RELIABILITY_UNCONFIRMED_RETRY_FAILOVER_20260821.patch` byte-safe способом к свежему `server.js`.
2. На hosted машине прогнать целевую регрессию `A unconfirmed -> unusable -> classify A once -> B fresh thread`.
3. После этого взять следующий независимый дефект только в зоне пула/cooldown/circuit/failover/thread-affinity/side-effect replay.
