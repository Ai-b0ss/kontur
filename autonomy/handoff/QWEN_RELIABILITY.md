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

## Незавершённые кандидаты №1–3

Три ранее подтверждённых дефекта остаются на product head `861a8f17...`:

1. Локальная подготовка headers/cookie/timezone может упасть до provider I/O, но аккаунт уже списан в request-wide budget и ошибка может считаться transport. Кандидат: `autonomy/v3/candidates/QWEN_RELIABILITY_LOCAL_PREPARATION_BOUNDARY_20260821.patch`.
2. `markSuccess()` после успешного provider I/O может упасть на durable write и быть переклассифицирован как transport с опасным sibling failover. Кандидат: `autonomy/v3/candidates/QWEN_RELIABILITY_POST_SUCCESS_PERSISTENCE_BOUNDARY_20260821.patch`.
3. Durable запись уже классифицированной CAPTCHA/rate-limit/account failure может упасть и затем быть повторно классифицирована как transport. Кандидат: `autonomy/v3/candidates/QWEN_RELIABILITY_FAILURE_PERSISTENCE_BOUNDARY_20260821.patch`.

Применять именно в этом порядке: второй вводит общий `localPersistenceError()`, третий на него опирается.

## Новый подтверждённый дефект №4 — ошибка записи provider-wide circuit может открыть sibling probing

`stopError()` вызывает `accountStore.markRestriction()` либо `providerCircuit.trip()` до создания ошибки `QWEN_PROVIDER_CIRCUIT`. `providerCircuit.trip()` намеренно persist-first и при EIO/fsync/rename откатывает неподтверждённое состояние и выбрасывает исходную локальную ошибку. Сейчас эта ошибка может попасть обратно в общий provider catch, классифицироваться как generic `transport` и разрешить следующий аккаунт, хотя provider-wide WAF/trust/pressure уже был обнаружен.

Для `markRestriction()` частичный случай безопаснее: если provider circuit успел durably записаться, а затем упала account-state запись, `providerCircuit.current()` уже блокирует кандидатов. Но если падает сама durable запись circuit, подтверждённого стоп-состояния нет, поэтому текущий запрос обязан завершиться fail-closed локальной ошибкой и не пробовать sibling.

Hosted Node модель воспроизведена: текущая схема `provider-wide signal -> EIO during circuit persist -> outer transport classification` допускает sibling; исправленная схема завершает запрос как `local_persistence`. Маркер: `PROVIDER_CIRCUIT_PERSISTENCE_FAIL_CLOSED_REPRO_PASS`.

Готовый зависимый кандидат (применять после post-success candidate, использует `localPersistenceError()`):
`autonomy/v3/candidates/QWEN_RELIABILITY_PROVIDER_CIRCUIT_PERSISTENCE_BOUNDARY_20260821.patch`

Control commit кандидата: `8da635780df49cf3d56f34b0ebf784918221317b`.

## Почему product PR пока не мутирован

Доступный GitHub write-интерфейс заменяет `src/qwen-client.js` целиком. Файл большой и общий; hosted-машина не может клонировать GitHub из-за DNS. На свежем PR #6 head остаётся `861a8f17...`; exact patch-кандидаты семантически свежие, но полная реконструкция общего файла через Contents API ради нескольких строк остаётся неоправданным риском. Нужен byte-safe git/patch исполнитель либо exact full-file материализация с CAS-проверкой blob SHA.

## Следующий безопасный кусок

1. Byte-safe применить четыре кандидата: local preparation -> post-success persistence -> failure persistence -> provider-circuit persistence.
2. Добавить регрессии в обычный `npm test`, прогнать на hosted машине без внешних CI.
3. Затем проверить `providerCircuit.current()` при истёкшем circuit: `current()` вызывает durable `removeState()`. Если очистка истёкшего состояния падает, убедиться, что ошибка не превращается в provider transport и не открывает sibling probing; сначала воспроизвести EIO, потом менять код.

## Постоянная память

В начале этого прохода прочитан `LATEST.json`:
- capsule `20260821T135651Z-b77269c19c`;
- Git blob SHA `dc9a778b8e6777cee6f398a4fcdcdd81db356e31`;
- archive SHA-256 `90f973f85b3ddedfaa9edfe08f2ecac434901ed9f86e2d17910c70246c89ef2c`.

Manifest и обе exact parts материализованы; длины/sha частей и archive SHA проверены, workspace восстановлен и checkpoint прочитан. Источник capsule: `Ai-b0ss/qwen-free-api@861a8f17...`.

После существенной работы требуется новый v4 checkpoint/pack/upload/read-back и CAS-публикация только если `LATEST` всё ещё имеет исходный blob SHA.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты;
- product PR #6 не мутирован; добавлен четвёртый exact patch-кандидат и обновлён handoff.
