# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого запуска: `17a71b9636eeead5873a0bd716e27a6bf073c913`.

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
- durable provider-circuit replacement не откатывается из-за cleanup-only ошибки удаления старого transaction backup.

## Что исправлено в этом запуске

Закрыт старый cleanup в `qwen-client.operationCandidates()`. Раньше функция повторно вручную вставляла caller-owned `preferredAccount`, хотя `accountStore.candidates(preferredAccount)` уже канонизирует id, повторно читает актуальное состояние аккаунта, учитывает cooldown/remove и сохраняет LRU-порядок.

Теперь один источник истины:

`accountStore.candidates(preferredAccount).slice(0, MAX_ACCOUNTS_PER_OPERATION)`.

Продуктовый commit: `17a71b9636eeead5873a0bd716e27a6bf073c913`.

Read-back exact head подтверждает новое тело функции. Внешний CI не запускался.

## Новый найденный дефект: request-wide bounded retry

Подтверждено, что текущий лимит `MAX_ACCOUNTS_PER_OPERATION` действует только внутри одного вызова `qwenClient.sendChatRequest()`, а `server.js` поверх него имеет собственные циклы повторов:

- non-stream: до 3 поздних empty-response retry;
- stream: `maxEmptyRetries: 3` + `retryEmpty`, внутри которого снова вызывается `sendChatRequest()`;
- отдельный rebase при смене владельца upstream-thread.

Из-за этого один пользовательский запрос может заново получать полный внутренний бюджет на каждом внешнем повторе и в пуле из 11 аккаунтов затронуть существенно больше настроенного лимита 4 / жёсткого потолка 6 различных аккаунтов. Hosted-модель текущей схемы воспроизвела 11 различных аккаунтов при `MAX=4` (`NESTED_RETRY_BUDGET_REPRO_PASS`). Это нарушение смысла bounded failover, даже если уже классифицированные аккаунты не повторяются из-за cooldown.

Подготовлен точный кандидат исправления:
`autonomy/v3/candidates/QWEN_RELIABILITY_REQUEST_WIDE_BUDGET_20260821.patch`.

Идея кандидата: один общий `attemptContext` на весь HTTP-запрос с `attemptedAccountIds` и общим лимитом; qwen-client добавляет id перед provider-attempt, а все внешние retry используют тот же контекст. Специальный rebase может повторно использовать уже выбранного владельца треда без расходования нового distinct-account slot. Hosted-проверка модели кандидата: `REQUEST_WIDE_FAILOVER_BUDGET_CANDIDATE_PASS`.

Кандидат пока не применён к `server.js`: это большой общий файл, и перед product-write нужен отдельный регресс на два свойства одновременно: (1) не больше request-wide лимита различных аккаунтов; (2) rebase сохраняет account/thread affinity и может повторно использовать текущего владельца без открытия нового sibling slot.

## Следующий безопасный кусок

1. На свежем product head проверить, не сдвинулся ли `server.js` параллельным писателем.
2. Применить request-wide attempt context byte-safe способом к `qwen-client.js` + `server.js`.
3. Добавить офлайн-regression: pool 11, внутренние локальные failures + late-empty outer retries => distinct account ids `<= MAX_ACCOUNTS_PER_OPERATION`; уже охлаждённый аккаунт не возвращается; intentional rebase того же владельца разрешён и не расходует новый slot.
4. Только после этого искать следующий bounded retry/account-affinity крайний случай.

## Постоянная память и ограничения

- LATEST на старте: `20260821T075724Z-cde1edd7be`;
- стартовый Git blob SHA LATEST: `d9e20a6f36370121cb72bcd6f7a79bf811107685`;
- manifest schema v4, archive SHA `138762e5df9c86c8d444f30fc917466105173a5e99664d3482b3e807b4869c77`;
- LATEST восстановлен на hosted машине с полной проверкой part length/SHA, archive size/SHA, безопасным extract и точным workspace manifest; CHECKPOINT/RESULTS прочитаны;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять; выполнены целевые hosted-проверки изменённой политики и нового bounded-retry воспроизведения.
