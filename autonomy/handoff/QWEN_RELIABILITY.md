# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этой работы: `d91978943faab2ce23e1d552cb61f77d3d9ccae0`.

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
- durable provider-circuit replacement не откатывается из-за cleanup-only ошибки;
- `qwen-client.operationCandidates()` делегирует порядок каноническому `accountStore.candidates(preferredAccount)`.

## Закрыто в этом запуске: request-wide bounded retry

Старый дефект: `MAX_ACCOUNTS_PER_OPERATION` ограничивал только один `sendChatRequest()`, а поздние non-stream/stream retry в `server.js` запускали новый внутренний бюджет. При пуле 11 и лимите 4 один HTTP-запрос мог последовательно затронуть все 11 аккаунтов.

Исправлено в продукте:

1. `src/qwen-client.js` принимает общий `attemptContext` с `attemptedAccountIds` и `limit`.
2. `server.js` создаёт один `requestAttemptContext` на весь `/v1/chat/completions` и передаёт его в первоначальный запрос, non-stream retry и stream retry.
3. Intentional same-owner rebase использует тот же Set, но `allowPreferredReuse: true`: владелец существующего треда может быть повторно использован без нового distinct-account slot; остальные sibling probes всё равно делят исходный бюджет.
4. Уже испробованный аккаунт не возвращается на внешнем retry; cooled preferred не обходит канонический `accountStore.candidates()`.
5. Бюджет теперь расходуется на фактической границе provider path. Для нового треда слот фиксируется в `generateChatID()` после последней синхронной проверки provider-wide circuit и до `/chats/new`; для уже существующего account-owned треда — непосредственно перед completion provider call. Если общий circuit обнаружен до provider call, slot не расходуется.

Продуктовые коммиты этой линии:
- `ce93b3a68a72f998fbfe1f27ad39881bf8eda115` — поддержка общего бюджета в qwen-client;
- `76ff706ff1c6df0e984d67572214e61061bbfbdb` — один request-wide context во всех server retry;
- `1bf13e7fd36024fcef01c6b9a14375d9a33dcf98` — продуктовая регрессия;
- `34229f8a22555a853daa0199c46e0120673111b9` — регрессия включена в `npm test`;
- `da13c02ed55fc69f48411f575d60f8c0d39b4ae9` — accounting перенесён к фактической provider boundary;
- `d91978943faab2ce23e1d552cb61f77d3d9ccae0` — регрессия усилена на circuit-before-provider.

Сравнение `9c7ea9b... -> d9197894...` показывает ожидаемые изменения `server.js`, `src/qwen-client.js`, `package.json`, новый `scripts/request-wide-failover-budget-test.js`; параллельный писатель одновременно добавил `src/assistant-turn-meta.js` и менял `src/stream-session-guard.js`, наши файлы его изменения не затёрли.

## Проверка

На ChatGPT hosted Node повторно прошла модель политики: `REQUEST_WIDE_BOUNDED_RETRY_REGRESSION_PASS` (`A→B→C→D` при лимите 4 несмотря на внешние раунды; same-owner rebase; cooled preferred не возвращается).

Новая продуктовая регрессия `scripts/request-wide-failover-budget-test.js` дополнительно проверяет настоящий `qwen-client.operationCandidates`, wiring всех четырёх server paths и два provider-boundary случая: provider circuit до provider call не расходует slot; reuse существующего треда расходует ровно один slot до axios.

Полный `npm test` exact-tree в этом запуске не заявлять: hosted-контейнер не имеет DNS до GitHub, а внешние CI по указанию владельца для обычной разработки не запускались.

## Следующий безопасный кусок

Сначала проверить свежий PR head и дождаться/учесть параллельные изменения без отката. Затем искать следующий bounded retry/account-affinity крайний случай. Приоритетный кандидат для аудита: поведение при локальной ошибке подготовки provider request (например build-cookie/header/state failure) между выбором кандидата и фактическим сетевым вызовом — такая чисто локальная ошибка не должна ошибочно расходовать request-wide slot или охлаждать здоровый аккаунт как upstream failure. Сначала воспроизвести офлайн, затем минимальный фикс.

## Постоянная память

Стартовый `LATEST.json`: capsule `20260821T100145Z-3695e7d6f1`, Git blob SHA `2a033862b5519b522cb29492cfec82de370438f8`, archive SHA-256 `90ec2c0b429f8f1a5b410c2cf64167502fc26db218cc9c45b9c3fd27e9391497`.

Стартовая capsule восстановлена настоящим `capsule_runtime_v4.py`: `verify=PASS`, `restore=PASS`; workspace manifest совпал.

После завершения этой работы должна быть упакована новая v4 capsule, immutable загружена, перечитана и опубликована только CAS по исходному `LATEST` blob SHA, если он к тому моменту не изменился.

## Ограничения

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты.
