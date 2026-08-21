# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head, проверенный в этом проходе: `861a8f176a6037acaec5721b2f6bbad3041d7dd9`.

## Уже доказано и не переделывать

- локальные проблемы аккаунта отделены от provider-wide WAF/trust/pressure;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, общий provider circuit останавливает sibling probing;
- account/thread affinity сохраняется для существующего треда, допустимый failover создаёт свежий тред на соседнем аккаунте;
- configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- account cooldown и provider-wide cooldown монотонны;
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
- request-wide bounded retry закрыт: обычный/stream retry делят один `attemptedAccountIds`, distinct-account usage ограничен `MAX_ACCOUNTS_PER_OPERATION`, same-owner rebase не расходует новый distinct slot;
- provider-wide circuit, найденный до реального provider path, не расходует request-wide slot.

## Незавершённый дефект №1 — локальная подготовка запроса ошибочно считается provider failure

На свежем head `861a8f17...` `src/qwen-client.js` не менялся относительно прошлого проверенного `75c0d793...`; между ними изменялись только `src/session-store.js` и его тесты. Поэтому дефект и точный кандидат остаются актуальны.

`generateChatID()` списывает аккаунт в request-wide budget до `buildHeaders('/c/new-chat', account)`. Для существующего account-owned треда `sendChatRequest()` также списывает slot до локальной сборки headers/cookie/timezone. Если локальная подготовка падает до provider I/O, здоровый аккаунт сейчас может потерять budget slot и получить transport failure.

Готовый кандидат:
`autonomy/v3/candidates/QWEN_RELIABILITY_LOCAL_PREPARATION_BOUNDARY_20260821.patch`

Инвариант: до первого реального provider I/O локальная ошибка должна давать `attempted=[]`, `providerCalls=0`, `failures=0`, `errorClass=local_preparation`.

## Незавершённый дефект №2 — ошибка локального persistence после успешного Qwen ошибочно считается transport

`accountStore.markSuccess()` делает durable write внутри общего provider try/catch после успешного `/chats/new` и после подтверждённого initial SSE. `EIO`/ошибка fsync/rename после уже успешного provider I/O сейчас может быть переклассифицирована как transport и привести к `markFailure()`/sibling failover, то есть повтору уже состоявшейся provider-side работы.

Готовый кандидат:
`autonomy/v3/candidates/QWEN_RELIABILITY_POST_SUCCESS_PERSISTENCE_BOUNDARY_20260821.patch`

Инвариант: после успешного provider I/O локальная durable-state ошибка => `errorClass=local_persistence`, `failures=0`, `failover=false`.

## Новый подтверждённый дефект №3 — ошибка durable записи уже классифицированной provider-ошибки может быть переклассифицирована

`accountStore.markFailure()` и `accountStore.markCaptchaChallenge()` сами вызывают durable `persist()`. Если запись cooldown/failure падает, исключение выходит обратно в общий provider catch. Для CAPTCHA это особенно плохо: разовая ошибка диска при записи 10-минутной паузы может затем попасть в generic transport path; если следующий persist уже успешен, точная CAPTCHA-семантика теряется, получается обычная короткая transport-пауза и разрешается sibling failover при неопределённом локальном состоянии.

Hosted Node модель воспроизведена: текущий переход `CAPTCHA -> EIO during persist -> outer transport classification` даёт `retrySibling=true`; правильный fail-closed переход — `local_persistence`, без нового provider I/O. Маркер: `ACCOUNT_FAILURE_PERSISTENCE_REPRO_PASS`.

Подготовлен зависимый кандидат (применять после post-success candidate, использует тот же `localPersistenceError()`):
`autonomy/v3/candidates/QWEN_RELIABILITY_FAILURE_PERSISTENCE_BOUNDARY_20260821.patch`

Control commit кандидата: `a0fd07106b3d2c21da94699b48615ee93c927435`.

## Почему product PR пока не мутирован

Доступный GitHub write-интерфейс заменяет `src/qwen-client.js` целиком. Файл большой и общий; при этом product head сдвинулся параллельной линией. Compare `75c0d793... -> 861a8f17...` показывает, что qwen-client/account-store не менялись, поэтому три patch-кандидата семантически свежие, но полная реконструкция общего файла через Contents API ради нескольких строк остаётся неоправданным риском. Нужен byte-safe git/patch исполнитель либо полная exact-материализация файла с CAS-проверкой его blob SHA перед заменой.

## Следующий безопасный кусок

1. Byte-safe применить сначала local-preparation candidate, затем post-success persistence candidate, затем failure-persistence candidate.
2. Добавить их регрессии в обычный `npm test`.
3. Все обычные проверки выполнить на hosted машине; внешние CI не запускать.
4. После этого проверить отдельную границу `stopError()/markRestriction()/providerCircuit.trip()`: если durable запись provider-wide circuit или account restriction падает, текущий HTTP-запрос обязан оставаться fail-closed и не делать sibling provider request. Менять код только после воспроизведения `EIO`.

## Постоянная память

В начале этого прохода прочитан `LATEST.json`:
- capsule `20260821T125650Z-9a6ae5abaf`;
- Git blob SHA `0ee4ad632f7101ef9bd0f4ac41d3704604027b43`;
- archive SHA-256 `a7923075507e6f7dc741fc859d718572abb016379931fd73a6ff7e5f51f94fd3`.

Manifest и обе exact parts материализованы; нормативный `capsule_runtime_v4.py verify` и `restore` прошли `PASS`.

После существенной работы требуется новый v4 checkpoint/pack/upload/read-back и CAS-публикация только если `LATEST` всё ещё имеет исходный blob SHA.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты;
- product PR #6 не мутирован; добавлен третий exact patch-кандидат и обновлён handoff.
