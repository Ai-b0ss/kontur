# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `925682bc36338a249a26dae2c684380c21ba8db7`.

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
- provider-wide circuit, найденный до реального provider path, не расходует request-wide slot;
- истёкший provider circuit при неподтверждённой durable cleanup остаётся fail-closed через `state_cleanup_failed`.

## Закрыто в этом проходе — четыре границы локальной ошибки и провайдера

Свежий PR был перечитан перед изменением. Все четыре подготовленных кандидата оставались актуальными и были внесены в продукт через exact full-file CAS по свежему blob SHA, без реконструкции из частичных фрагментов.

### 1. Локальная подготовка запроса не расходует provider budget

`buildHeaders()` включает cookie/timezone и может упасть локально до сетевого запроса. Раньше аккаунт мог уже попасть в request-wide `attemptedAccountIds`, а локальная ошибка затем классифицировалась как provider transport.

Теперь:
- добавлен `QWEN_LOCAL_PREPARATION`;
- headers/cookie/timezone готовятся до `markProviderAttempt()`;
- при локальной ошибке provider I/O не считается состоявшимся, cooldown здорового аккаунта не меняется и sibling failover не запускается.

Коммиты: `5c8957b578e501fc8ac075b99888d14b69accbbb`, `0548e7c3cf20228e0abc1c296e76b32724799694`, `fe3b93c7d336712a932d96ff61aaa6b0dffbfdd7`.

### 2. Ошибка durable `markSuccess()` после успешного ответа не становится ошибкой Qwen

Добавлен `QWEN_LOCAL_PERSISTENCE` и `markSuccessDurably()`. Если Qwen уже успешно ответил, но локальная запись состояния аккаунта падает, запрос завершается как `local_persistence` и не переключается на соседний аккаунт. Это защищает от повторения уже состоявшейся provider-side работы.

### 3. Ошибка записи уже классифицированной CAPTCHA/rate-limit/account failure — fail-closed

Добавлены `markFailureDurably()` и `markCaptchaDurably()`. Если provider outcome уже известен, но durable запись cooldown/error не подтверждена, ошибка диска не переклассифицируется в transport и не открывает sibling probing.

### 4. Ошибка durable записи provider-wide circuit — fail-closed

`stopError()` теперь защищает `accountStore.markRestriction()` / `providerCircuit.trip()`. Если общий WAF/trust/pressure уже обнаружен, но состояние circuit не удалось надёжно записать, запрос заканчивается `local_persistence`, а не идёт к соседнему аккаунту.

Общий продуктовый commit для трёх persistence-boundaries: `7390387ee5720b747d06397899199f95a18949f1`.
Регрессии: `9dba76416ca4536e3cf3f323cc51d3c8105ad61d`, `92e795c39bd8225362203912cad352e755c97da7`, `5b0f6d52aba895e70604dd70f07ddb2b5934af8e`, включение в штатный `npm test`: `925682bc36338a249a26dae2c684380c21ba8db7`.

Hosted behavioral model: `QWEN_FOUR_BOUNDARY_BEHAVIOR_MODEL_PASS`.

Важно: полный exact-tree `npm test` в этом проходе не заявлен — hosted контейнер не смог клонировать GitHub по DNS. Изменённый код перечитан из GitHub после записи, а новые регрессии включены в штатный test script. Внешний CI ради этого не запускался.

Дополнительная проверка `account-store`: `markCaptchaChallenge(account, reason, undefined)` сохраняет штатный default CAPTCHA cooldown 10 минут; managed-account ссылки канонизируются по id перед availability/state mutation.

## Постоянная память

В начале запуска прочитан `LATEST.json`:
- capsule `20260821T135651Z-b77269c19c`;
- стартовый parent Git blob SHA `dc9a778b8e6777cee6f398a4fcdcdd81db356e31`;
- archive SHA-256 `90f973f85b3ddedfaa9edfe08f2ecac434901ed9f86e2d17910c70246c89ef2c`.

Manifest и обе части были материализованы точными байтами; нормативные `capsule_runtime_v4.py verify` и `restore` дали PASS.

После работы выполнен `checkpoint -> pack v4`. Новая immutable capsule:
- `20260821T170333Z-9e3802c8f0`;
- source ref `Ai-b0ss/qwen-free-api@925682bc36338a249a26dae2c684380c21ba8db7`;
- archive SHA-256 `687dad1f2d54982eef042663705bfc33f8096846157154722d2513fefb58d263`;
- 2 части: 2048 и 624 символа.

После загрузки обе parts и manifest перечитаны из GitHub. Их Git blob SHA точно совпали с локально вычисленными:
- part-0000: `209a05d057856be0464c347593a09866e29fac2e`;
- part-0001: `50181bb21f2c83ba21795b7f85a21b77901b5179`;
- manifest: `85f61611beed22b635935d5914c575cbf531e412`.

Непосредственно перед публикацией `LATEST` был перечитан и всё ещё имел стартовый parent SHA `dc9a778b...`, то есть CAS-конфликта не было. Старый `LATEST` сохранён как `PREVIOUS`, затем новый `LATEST` опубликован exact-CAS и перечитан после записи.

Текущий `LATEST`:
- capsule `20260821T170333Z-9e3802c8f0`;
- Git blob SHA `fd5bbad19679273346da3e46da8ebfeefc56f5a6`;
- archive SHA-256 `687dad1f2d54982eef042663705bfc33f8096846157154722d2513fefb58d263`.

## Следующий безопасный кусок

1. В начале следующего запуска восстановить новый `LATEST` через v4.
2. Перечитать свежий PR #6: параллельный writer может уже сдвинуть head.
3. Не переделывать четыре закрытые границы. Искать следующий независимый fail-open вокруг локальной persistence/provider-state границы или bounded failover.
4. Если станет доступен byte-safe exact-tree materialization на hosted машине, выполнить локально новые четыре regression scripts и релевантный `npm test` без CircleCI/GitHub Actions/provider traffic.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты.
