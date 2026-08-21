# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого запуска: `51a54afdb39fac3198a33d8809a57a474b20eca9`.

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
- удалённый managed account не воскресает через detached snapshot.

## Что исправлено в этом запуске

1. Обнаружен устаревший `provider-circuit-persistence-test.js`: после перевода всех provider circuit на глобальную семантику он всё ещё ожидал, что `clear('account-b')` удаляет provider-wide circuit. Это противоречило текущему fail-closed контракту и делало штатный `npm test` красным по неверному ожиданию. Тест приведён к фактическому контракту: per-account clear возвращает `false`, глобальная очистка выполняется только `clear()`.

2. Найден отдельный продуктовый дефект в `provider-circuit.atomicWriteState()`. После успешного `rename` нового состояния и подтверждённого directory `fsync` ошибка удаления старого `.txn-backup-*` попадала в общий `catch` и откатывала уже durable новый circuit. В худшем случае более сильный `trust_restriction` мог откатиться к старому короткому `provider_pressure` только из-за cleanup-only ошибки.

Исправление: после подтверждённой установки нового canonical state удаление transaction backup считается только уборкой и не может откатить circuit. Настоящая ошибка directory `fsync` до подтверждения canonical state по-прежнему приводит к rollback и пробрасывается наружу.

Продуктовые коммиты этого запуска:
- `fc17ef80deb5ecca248fcba19daf0338d0e21255` — привести persistence-тест к provider-wide clear semantics;
- `9d7f3285cad07097074be3f1fab125ef53bcbf97` — не откатывать durable provider circuit при ошибке cleanup backup;
- `51a54afdb39fac3198a33d8809a57a474b20eca9` — расширить regression на corrupt-state fail-closed, global clear, tombstone cleanup и replacement-backup cleanup.

Hosted targeted check: `PROVIDER_CIRCUIT_DURABLE_REPLACEMENT_CLEANUP_PASS`.

Важно: corrupt `provider-circuit.json` остаётся fail-closed (`state_corrupt`, `until=MAX_SAFE_INTEGER`). Обычный `trip()` не должен молча превращать его в конечный cooldown; восстановление требует явного глобального `clear()`. Regression теперь фиксирует именно этот инвариант.

## Незавершённый старый cleanup

`qwen-client.operationCandidates()` всё ещё вручную вставляет caller-owned `preferredAccount`, хотя `accountStore.candidates(preferredAccount)` уже канонизирует preferred id, применяет cooldown/remove/LRU и возвращает canonical object.

Точный patch остаётся в control repo:
`autonomy/v3/candidates/QWEN_RELIABILITY_OPERATION_CANDIDATES_20260821.patch`.

После нынешней канонизации account-store этот хвост в основном дублирует уже работающую защиту; срочность ниже, чем у найденного provider-circuit rollback. При byte-safe редакторе всё равно стоит свести `operationCandidates()` к одному источнику истины и прогнать thread-affinity regression.

## Следующий безопасный кусок

Проверить следующий bounded-retry/account-affinity крайний случай, не залезая в Qwen Core. В частности обратить внимание на stream/non-stream retry loops в `server.js`: локальный retry budget сверху складывается с внутренним `MAX_ACCOUNTS_PER_OPERATION`, поэтому нужно доказать, что один пользовательский запрос не может сделать существенно больше provider-attempts, чем предполагает общий bounded failover контракт, и что уже охлаждённые аккаунты не пробуются повторно в новом вложенном retry.

## Постоянная память и ограничения

- LATEST на старте: `20260821T060242Z-70f4eb934f`;
- стартовый Git blob SHA LATEST: `d7d197fb4bfe0551530323739fb7097edab03d60`;
- manifest schema v4, archive SHA `aeab1d8abf8300f6f7375ece04f2e344de7e18a36c41929f207c14004adeb53a`;
- LATEST восстановлен через `capsule_runtime_v4.py verify + restore` на hosted машине; CHECKPOINT/RESULTS прочитаны;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имеет DNS до GitHub; выполнен целевой hosted-probe изменённого durability-инварианта.
