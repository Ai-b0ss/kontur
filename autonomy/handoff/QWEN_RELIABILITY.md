# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head этого запуска: `ffd19b208da8be58f5de9d11c4240327b9e0ad81`.

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
- transport error после принятого SSE проходит в account/provider classification ровно один раз;
- удаление аккаунта после durable rename больше не расходится между диском и памятью при сбое cleanup tombstone;
- ended empty/metadata-only initial SSE получает account-local classification и bounded sibling failover, чужой upstream `chatId` соседнему аккаунту не переиспользуется;
- terminal-only initial SSE (`[DONE]`, `true`, `{data:true}`) больше не считается пригодным model output;
- unconfirmed initial-gate release, который позже доказанно закончился без usable output, теперь классифицирует фактический аккаунт один раз и выбирает свежего eligible sibling перед retry;
- provider-wide circuit теперь не снимается через `reset()` конкретного аккаунта даже если этот аккаунт был источником WAF/trust сигнала; `accountId` в circuit — атрибуция, а не право на локальную разблокировку.

## Этот запуск — исправление №1: unconfirmed release -> unusable end -> sibling failover

Предыдущий воспроизводимый дефект был `A -> A -> A`: после timeout/buffer release без подтверждённого `choices` поток мог позже закончиться пустым, а server retry продолжал передавать старый `preferredAccount=A`.

Исправлено:

- `59373f7c6114b312b8f76b8a11663c15ba3e72a3` — `server.js`:
  - фактический `response.account` получает `markFailure()` только после доказанного unusable end;
  - ставится `initialEmptyResponseClassified`, чтобы outer catch не считал ту же ошибку второй раз;
  - каждый bounded retry берёт `accountStore.candidates()[0]` заново;
  - `preparePublicPayloadGoverned(... currentOnly:false, account:retryPreferred)` и `sendChatRequest(..., retryPreferred)` используют одного свежего кандидата;
  - пустой retry классифицирует фактический `retry.account` до следующей попытки;
  - sibling получает свежий thread, старый upstream chat id не переносится.
- `e375d7416480871fed23a91eff621ea941d6aee1` — новый `scripts/server-unconfirmed-retry-failover-test.js`.
- `f6193c08c1f86e19450148e4e68ec63b69a5e6cc` — тест включён в штатный `npm test`.

Byte-safety: compare `075602972f1b41ecaf61ed44319a2681760ffd3b -> 59373f7c...` показал только `server.js`, `+17/-4`.

Hosted targeted proof: `QWEN_UNCONFIRMED_RETRY_FAILOVER_PASS`.

## Этот запуск — исправление №2: account reset не снимает provider-wide circuit

Найден отдельный fail-open: WAF/trust circuit хранит `accountId` наблюдавшего аккаунта. Старый `providerCircuit.clear(accountId)` позволял `accountStore.reset()` этого же аккаунта снять общий circuit и снова открыть sibling probing, хотя WAF/trust по контракту считаются provider-wide.

Исправлено:

- `b718e8edb66a8233a8a71e947433bae46c542c01` — `src/provider-circuit.js`: при account-scoped `clear(expectedAccountId)` любой активный provider circuit остаётся закрытым; accountId трактуется только как атрибуция. Явный глобальный `clear()` остаётся доступен.
- `ffd19b208da8be58f5de9d11c4240327b9e0ad81` — `scripts/provider-safety-test.js`: WAF и trust restriction обязаны переживать `store.reset(a)` и сниматься только через `store.clearProviderCircuit()`; старый anonymous provider_pressure тест сохранён.

Hosted synthetic proof: `PROVIDER_CIRCUIT_ACCOUNT_RESET_FAIL_CLOSED_PASS`.

## Параллельная работа

Во время запуска другой Qwen worker добавил `session-checkpoint-system-retention-test.js` и менял `session-store.js`; наши изменения не пересекались. На финальном head оба набора находятся вместе. Текущий `package.json` содержит и `server-unconfirmed-retry-failover-test.js`, и новый session checkpoint тест.

## Проверки и ограничения запуска

- CircleCI не запускался;
- GitHub Actions не запускались;
- Cloudflare не использовался;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имел сетевого доступа для клонирования GitHub. Выполнены targeted hosted проверки и обязательный read-back/commit diff изменённых файлов.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

Старт текущего запуска:

- LATEST: `20260821T015929Z-4b823c0fc1`;
- стартовый Git blob SHA LATEST: `fafc1a99ed040da06be6cf1ef35fce82e2437be9`;
- archive SHA из указателя: `efb09765aa9f261e94a238821ea02f93840223c8dee233dc378d39566ba6d787`;
- manifest blob `d2baa37c8c4be6e414274dbb5bb5592d91e2d511`;
- part blob `08ad6603181e7a299c692404dfe103380665c5d6`.

LATEST capsule была восстановлена через v4: part length/hash и archive SHA совпали, workspace verification/restore = PASS. Неизвестные bytes не угадывались.

Финишная capsule этого запуска должна быть опубликована только после `pack` v4, immutable upload, повторного чтения всех частей/manifest и CAS-проверки LATEST против стартового blob SHA выше. Если LATEST уже изменился, не force-write.

## Следующий приоритет

1. На следующем запуске сначала восстановить свежий LATEST/PREVIOUS по v4 и проверить, не продвинулся ли PR #6 параллельным worker.
2. Если full exact-tree доступен hosted локально — прогнать штатный `npm test`; если нет, не изображать полный PASS, а продолжать targeted проверки.
3. Следующий независимый кусок искать только в зоне pool/cooldown/provider circuit/preferred-current/failover/thread affinity/side-effect replay. Не трогать Qwen Core и не повторять provider/live без необходимости.
