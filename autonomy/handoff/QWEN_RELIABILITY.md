# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `a656d42522c463ca36937c9a2a552df0836fd020`.

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

## Закрыто в этом проходе — истёкший provider circuit больше не может открыть ротацию при ошибке диска

Свежий `provider-circuit.current()` удалял истёкшее состояние через durable `removeState()`. Если именно синхронизация удаления падала с `EIO/fsync`, исключение могло уйти наружу в request path и быть ошибочно принято за provider transport, после чего возникал риск sibling probing.

Исправление внесено в продукт:
- `b03acb5c8ab383e90bca70c0cd1d9231b73d6abd` — `provider-circuit.js` теперь при неподтверждённой очистке истёкшего circuit устанавливает процессный fail-closed latch `state_cleanup_failed` с `until=Number.MAX_SAFE_INTEGER`;
- per-account reset этот latch не снимает;
- только успешный explicit global clear снимает latch;
- `a656d42522c463ca36937c9a2a552df0836fd020` — расширена `scripts/provider-circuit-persistence-test.js`: synthetic EIO на expiry cleanup, сохранение fail-closed после восстановления файловой системы, запрет per-account clear и успешное снятие explicit global clear.

Hosted Node модель: `PROVIDER_CIRCUIT_EXPIRED_CLEANUP_FAIL_CLOSED_MODEL_PASS`.

## Всё ещё незавершённые qwen-client кандидаты

На предыдущем exact head были подтверждены четыре связанные границы локальной ошибки/провайдера. Перед применением перечитать свежий `qwen-client.js` и убедиться, что они не superseded параллельной работой:

1. `autonomy/v3/candidates/QWEN_RELIABILITY_LOCAL_PREPARATION_BOUNDARY_20260821.patch` — локальная подготовка headers/cookie/timezone не должна расходовать provider budget и становиться transport.
2. `autonomy/v3/candidates/QWEN_RELIABILITY_POST_SUCCESS_PERSISTENCE_BOUNDARY_20260821.patch` — ошибка durable `markSuccess()` после уже успешного provider I/O не должна порождать sibling failover.
3. `autonomy/v3/candidates/QWEN_RELIABILITY_FAILURE_PERSISTENCE_BOUNDARY_20260821.patch` — ошибка записи уже классифицированной CAPTCHA/rate-limit/account failure не должна переклассифицироваться как transport.
4. `autonomy/v3/candidates/QWEN_RELIABILITY_PROVIDER_CIRCUIT_PERSISTENCE_BOUNDARY_20260821.patch` — ошибка durable записи provider-wide circuit должна завершать запрос fail-closed.

Применять только byte-safe git/patch либо exact full-file CAS. Не реконструировать большой общий `qwen-client.js` из частичных фрагментов.

## Постоянная память

Стартовый `LATEST.json` прочитан до работы:
- capsule `20260821T135651Z-b77269c19c`;
- parent Git blob SHA `dc9a778b8e6777cee6f398a4fcdcdd81db356e31`;
- archive SHA-256 `90f973f85b3ddedfaa9edfe08f2ecac434901ed9f86e2d17910c70246c89ef2c`.

Точный manifest и обе parts были материализованы; нормативный `capsule_runtime_v4.py verify` и `restore` дали PASS.

После исправления выполнены `checkpoint -> pack v4` и две попытки immutable upload. Обе корректно остановлены до публикации `LATEST` обязательной повторной проверкой:
- `20260821T160000Z-038e0e6bd0`: remote `part-0001.b64` не совпал побайтно с локальным pack;
- `20260821T160223Z-5bb2305592`: manifest был загружен не exact-byte (JSON был переформатирован при ручном переносе), поэтому capsule нельзя считать валидной.

**`LATEST` намеренно не обновлён.** Это правильное поведение протокола v2: неизвестные/изменённые bytes не исправлять из памяти и не публиковать непроверенную capsule. Оба каталога остаются immutable orphan evidence. Следующий запуск восстанавливается со старого валидного `LATEST`, а product exact source — `Ai-b0ss/qwen-free-api@a656d425...`.

## Следующий безопасный кусок

1. Снова восстановить валидный `LATEST` через v4; exact product source уже известен.
2. Перечитать свежий PR #6 и проверить четыре qwen-client кандидата на superseded/актуальность.
3. Применить только актуальные патчи byte-safe способом и прогнать targeted hosted tests без CircleCI/GitHub Actions/provider traffic.
4. Для следующей capsule использовать транспорт, который сохраняет exact bytes manifest/parts; если такого транспорта нет — pack можно сохранить immutable, но `LATEST` не менять.

## Ограничения этого прохода

- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты.
