# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head на момент этого прохода: `75c0d793dbbc50b34f3409a90d4737095f58e7c7`.

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
- `qwen-client.operationCandidates()` делегирует порядок каноническому `accountStore.candidates(preferredAccount)`;
- request-wide bounded retry закрыт: initial/non-stream/stream retry делят один `attemptedAccountIds`, distinct-account usage ограничен `MAX_ACCOUNTS_PER_OPERATION`, same-owner rebase может повторно использовать владельца без нового distinct slot;
- provider-wide circuit, найденный до реального provider path, не расходует request-wide slot.

## Свежий незавершённый дефект №1: локальная подготовка запроса ошибочно считается provider failure

На свежем product head `75c0d793...` дефект всё ещё присутствует без изменений:

1. `generateChatID()` вызывает `markProviderAttempt(attemptContext, account)` до `buildHeaders('/c/new-chat', account)`. Если локально падает сборка cookie/header/timezone/UUID, сетевого запроса к Qwen ещё не было, но аккаунт уже съел место request-wide бюджета. Затем общий `catch` классифицирует локальную ошибку как `transport` и вызывает `accountStore.markFailure(account, ...)`.
2. Для существующего account-owned треда `sendChatRequest()` также списывает provider slot до вызова `buildHeaders(...)`; синхронная локальная ошибка подготовки попадает в upstream-classification catch и охлаждает здоровый аккаунт.

Офлайн-инвариант предыдущего прохода: `LOCAL_PREPARATION_ACCOUNTING_REPRO_PASS`; до исправления модель даёт `attempted=['A'], providerCalls=0, failures=1`, правильное состояние — `attempted=[], providerCalls=0, failures=0`.

Exact кандидат остаётся актуален и применим к свежей логике:

`autonomy/v3/candidates/QWEN_RELIABILITY_LOCAL_PREPARATION_BOUNDARY_20260821.patch`

Кандидат вводит `QWEN_LOCAL_PREPARATION`, готовит headers до списания provider-бюджета и выводит локальную preparation error до upstream-классификации. В product PR он пока не влит: доступный GitHub Contents API требует полной замены большого общего `qwen-client.js`, а безопасного byte-level patch-инструмента в этом запуске нет.

## Новый подтверждённый дефект №2: ошибка локального persistence после успешного ответа Qwen ошибочно считается transport failure

На `75c0d793...` `accountStore.markSuccess()` вызывается внутри общего provider `try` как минимум в двух местах:

- после успешного `/api/v2/chats/new` перед возвратом `chatId`;
- после подтверждённого initial SSE в `sendChatRequest()`.

`accountStore.markSuccess()` делает durable `persist()` и может выбросить локальную файловую ошибку (`EIO`, ошибка `fsync/rename` и т.п.). Сейчас такая ошибка попадает в общий `catch`, классифицируется как `transport`, а затем код пытается вызвать `markFailure()` для здорового аккаунта. Для completion это особенно опасно: provider уже выдал пригодный ответ, поэтому sibling failover после локальной ошибки может повторить provider-side работу.

Офлайн-воспроизведение на hosted Node: `POST_SUCCESS_PERSISTENCE_REPRO_PASS`.

Текущая модель: `providerSucceeded=true, failures=1, classified=transport`.

Правильный инвариант: `providerSucceeded=true, failures=0, classified=local_persistence, failover=false`.

Exact кандидат сохранён:

`autonomy/v3/candidates/QWEN_RELIABILITY_POST_SUCCESS_PERSISTENCE_BOUNDARY_20260821.patch`

Control commit: `e9e382805746fefd130d9b5d238e25565a7b980c`.

Кандидат:

- вводит отдельный `QWEN_LOCAL_PERSISTENCE`;
- оборачивает `markSuccess()` через `markSuccessDurably()`;
- после успешного provider I/O не позволяет локальной durable-state ошибке попасть в upstream classification;
- запрещает sibling failover в этом случае;
- включает regression-контракт `post-success-persistence-boundary-test.js`.

## Следующий безопасный кусок

После byte-safe применения двух кандидатов проверить соседнюю границу: `markFailure()`/`markCaptchaChallenge()` сами делают durable account write. Если upstream failure классифицирован правильно, но локальный `persist()` затем падает, нужно убедиться, что ошибка локального диска не приводит к дополнительной переклассификации, повторному provider-запросу или потере provider-wide fail-closed семантики. Сначала воспроизвести `EIO` офлайн; менять код только если подтверждается практический неверный переход состояния.

## Постоянная память

Стартовый `LATEST.json` этого прохода:
- capsule `20260821T115742Z-866dcc0634`;
- Git blob SHA `a2d0e4879f0616cdb8c3e6a873a365203bfa3e4d`;
- archive SHA-256 `f83b9bf2eef5936c6c2ac43bd405c682778c69f614f5058cfe2792c36f070480`.

Стартовая capsule материализована из exact GitHub manifest/parts и восстановлена настоящим `capsule_runtime_v4.py`: `verify=PASS`, `restore=PASS`; SHA восстановленных `CHECKPOINT.md` и `RESULTS.json` совпали с manifest.

После существенной работы требуется новая v4 capsule и CAS-публикация только если `LATEST` всё ещё имеет исходный blob SHA.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- product PR #6 не мутирован: два exact patch-кандидата готовы, второй дефект воспроизведён на hosted Node.
