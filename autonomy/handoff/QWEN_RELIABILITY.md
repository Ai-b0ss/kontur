# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head при этой проверке: `906be51721bccdd15e12ed24bfb2d07e2ad094e9`.

## Уже доказано и не переделывать

- локальные проблемы аккаунта отделены от provider-wide WAF/trust/pressure;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, общий provider circuit останавливает sibling probing;
- account/thread affinity сохраняется для существующего треда, допустимый failover создаёт свежий тред на соседнем аккаунте;
- configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- account cooldown и provider-wide cooldown монотонны по времени;
- поздняя CAPTCHA после принятого SSE классифицируется как CAPTCHA конкретного аккаунта;
- duplicate chat-id classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- pending mutating tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`;
- streaming и non-stream tool-calls не выпускаются клиенту при `sessionStore.set() === false`;
- поздний transport error учитывается ровно один раз;
- empty/metadata-only/terminal-only initial SSE не считается успешным model output;
- unconfirmed initial release, позднее доказанный пустым, охлаждает фактический аккаунт один раз и выбирает свежего sibling;
- `reset(account)` не снимает provider-wide circuit;
- stale preferred object не обходит canonical cooldown/state;
- удалённый managed account не воскресает через detached snapshot;
- durable provider-circuit replacement не откатывается из-за cleanup-only ошибки удаления старого transaction backup;
- `qwen-client.operationCandidates()` уже делегирует порядок каноническому `accountStore.candidates(preferredAccount)`.

## Текущий незакрытый дефект: request-wide bounded retry

`MAX_ACCOUNTS_PER_OPERATION` ограничивает только один вызов `qwenClient.sendChatRequest()`. `server.js` поверх него имеет собственные поздние повторы пустого ответа в non-stream и stream путях, поэтому новый `sendChatRequest()` снова получает полный внутренний бюджет.

Hosted-модель старой композиции ранее доказала, что при пуле из 11 аккаунтов и лимите 4 один пользовательский запрос способен затронуть все 11 различных аккаунтов. Это нарушает смысл bounded failover.

На свежем head дефект остаётся: `src/qwen-client.js` по-прежнему создаёт кандидатов отдельно на каждый `sendChatRequest()`, а `server.js` повторно вызывает `sendChatRequest()` в non-stream и stream retry без общего контекста попыток.

## Что сделано в этом запуске

1. Нормативная capsule `20260821T085551Z-b1d2dc2cad` восстановлена через `capsule_runtime_v4.py`; проверены part length/SHA, archive size/SHA и workspace manifest. Стартовый Git blob SHA `LATEST.json`: `3a662b584201249ae45c4ae4f1919372f506e182`.
2. Проверен свежий PR #6: head `906be51721bccdd15e12ed24bfb2d07e2ad094e9`, он на 4 коммита впереди прошлого product head `17a71b9...`. Из этих четырёх коммитов изменены `server.js` и stream-session guard; `src/qwen-client.js` не менялся. Request-wide defect не закрыт.
3. Усилен кандидат `autonomy/v3/candidates/QWEN_RELIABILITY_REQUEST_WIDE_BUDGET_20260821.patch`:
   - один `attemptedAccountIds` на весь HTTP-запрос;
   - лимит не может превышать `MAX_ACCOUNTS_PER_OPERATION`;
   - уже использованный sibling не возвращается на внешнем retry;
   - intentional same-owner rebase может повторно использовать владельца треда без расходования нового distinct-account slot;
   - account id добавляется в бюджет только после повторной проверки provider circuit, то есть circuit-stop без provider path не расходует слот.
4. Добавлен исполняемый кандидат-регресс `autonomy/v3/candidates/QWEN_RELIABILITY_REQUEST_WIDE_BUDGET_TEST_20260821.js`.
5. На ChatGPT hosted Node модель прошла: `REQUEST_WIDE_BOUNDED_RETRY_REGRESSION_PASS`. Проверено: `A→B→C→D` при лимите 4 несмотря на 4 внешних раунда; same-owner rebase сохраняет B первым; охлаждённый B не возвращается даже как preferred.

Контрольные коммиты:
- `f329268e95fb2c2e7b5fd11ffb48e3385e5ff5d2` — усиленный patch-кандидат;
- `39b33cdea14672905bb24187941b17e50f4bfb51` — hosted regression-кандидат.

## Почему product-write пока не сделан

Для полного исправления нужно менять одновременно `src/qwen-client.js` и большой общий `server.js`. Доступный GitHub Contents API умеет только полную замену файла; `server.js` только что изменён параллельным писателем (+20 строк после `17a71b9...`). Пересобирать большой общий файл вручную из кусочных ответов коннектора ради небольшого патча создаёт риск затереть свежие изменения. Поэтому product-write не форсировался.

## Следующий безопасный кусок

1. Ещё раз получить свежий head PR #6 и убедиться, что `src/qwen-client.js`/точки retry в `server.js` не изменились.
2. Применить `QWEN_RELIABILITY_REQUEST_WIDE_BUDGET_20260821.patch` byte-safe patch/git-исполнителем, а не полной ручной заменой `server.js`.
3. Перенести regression в product scripts и включить в `npm test`.
4. На hosted машине доказать одновременно: distinct account ids `<= MAX_ACCOUNTS_PER_OPERATION`; охлаждённый аккаунт не возвращается; same-owner rebase разрешён без нового slot; rebase на unavailable owner не обходит cooldown.
5. После закрытия этого дефекта искать следующий bounded retry/account-affinity крайний случай.

## Ограничения

- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять; выполнена целевая hosted-модель политики.
