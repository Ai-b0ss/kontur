# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head на момент этого прохода: `fe22f6f3b76c92cb28dd5145356e193010a1ccfb`.

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

## Свежий незавершённый дефект: локальная подготовка запроса ошибочно считается provider failure

На текущем `src/qwen-client.js` подтверждены две границы:

1. `generateChatID()` вызывает `markProviderAttempt(attemptContext, account)` **до** `buildHeaders('/c/new-chat', account)`. Если локально падает сборка cookie/header/timezone/UUID, сетевого запроса к Qwen ещё не было, но аккаунт уже съел место request-wide бюджета. Затем общий `catch` классифицирует эту локальную ошибку как `transport` и вызывает `accountStore.markFailure(account, ...)`.
2. Для существующего account-owned треда `sendChatRequest()` также списывает provider slot до вызова `buildHeaders(...)`. Синхронная локальная ошибка подготовки попадает в тот же upstream-classification catch и охлаждает здоровый аккаунт.

Офлайн-воспроизведение на hosted Node: `LOCAL_PREPARATION_ACCOUNTING_REPRO_PASS`.

До исправления модель даёт:
`attempted=['A'], providerCalls=0, failures=1`.

Правильный инвариант:
`attempted=[], providerCalls=0, failures=0`.

## Подготовленное исправление

Exact кандидат сохранён в каноническом репозитории:

`autonomy/v3/candidates/QWEN_RELIABILITY_LOCAL_PREPARATION_BOUNDARY_20260821.patch`

Commit control-ветки: `d4edfbc80bd0ca504dfc9059f1b913fa4ccd0e6f`.

Кандидат делает следующее:

- локальная сборка headers получает отдельный `QWEN_LOCAL_PREPARATION` / `localPreparation` класс;
- для `/chats/new` headers готовятся до `markProviderAttempt()`;
- для существующего треда headers готовятся до списания provider slot;
- после уже состоявшегося `/chats/new` тот же аккаунт не получает второй distinct slot перед completion;
- локальная preparation error выходит из `sendChatRequest()` до upstream classification и не вызывает `markFailure`/CAPTCHA/provider circuit;
- приложен regression-контракт `local-preparation-boundary-test.js` на порядок `prepare -> charge -> provider`.

В сам большой общий `src/qwen-client.js` кандидат в этом проходе не вливался: доступный GitHub Contents API требует заменить файл целиком, а локальная hosted-машина не может клонировать GitHub (`Could not resolve host: github.com`). Для маленького изменения это неоправданный риск затереть свежие параллельные изменения. Следующий byte-safe git/patch исполнитель может применить кандидат без новой разведки.

## Следующий безопасный кусок после применения кандидата

Проверить похожую, но отдельную границу **после успешного provider response**: `accountStore.markSuccess()`/другая локальная durable state mutation выполняется внутри общего provider `try`. Если локальная запись состояния падает после фактически успешного ответа Qwen, общий `catch` может ошибочно переклассифицировать это как `transport` и затем вызвать `markFailure` для здорового аккаунта. Сначала воспроизвести одноразовый `EIO` офлайн; если подтверждается — отделить ошибки локального persistence от upstream failures тем же fail-closed классом, не меняя CAPTCHA/rate-limit/provider-circuit семантику.

## Постоянная память

Стартовый `LATEST.json` этого прохода:
- capsule `20260821T110000Z-5d20ca68d1`;
- Git blob SHA `fd422eafccfd6eeb2f264db2ac99301c4d9b2ca2`;
- archive SHA-256 `abc3dbb31754df5e0efd52b5e32762aad1392e8a9f5282044fa79dc38de6cb7e`.

Стартовая capsule материализована из exact GitHub manifest/part и восстановлена настоящей логикой v4: `verify=PASS`, `restore=PASS`; восстановленный checkpoint совпал с handoff предыдущего прохода.

После существенной работы требуется новая v4 capsule и CAS-публикация только если `LATEST` всё ещё имеет исходный blob SHA.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- product PR #6 не мутирован; подготовлен exact patch-кандидат и воспроизведение на hosted Node.
