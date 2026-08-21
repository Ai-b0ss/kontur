# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `5c8fc5299f77a1c3502082da8827b6d3f20e7592`.

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
- истёкший provider circuit при неподтверждённой durable cleanup остаётся fail-closed через `state_cleanup_failed`;
- local preparation, durable `markSuccess`, durable CAPTCHA/rate-limit/account failure и durable provider-circuit trip отделены от provider transport;
- accepted-stream observer persistence errors не проглатываются;
- fsync-confirmed account/cooldown replacement не откатывается из-за cleanup-only удаления старого backup.

## Закрыто в этом проходе

### Explicit global clear больше не снимает fail-closed память без durable подтверждения

Найден крайний случай в `src/provider-circuit.js`.

После неудачного удаления истёкшего provider-circuit процесс правильно ставит `volatileFailClosed=state_cleanup_failed`. Возможна ситуация, когда canonical `provider-circuit.json` уже отсутствует в текущем namespace, но удаление каталога ранее не было подтверждено `fsync`. Старый `clear()` делал `removeState() -> false` и сразу обнулял `volatileFailClosed`, не подтверждая parent directory durability. После crash старый файл теоретически мог снова появиться, хотя текущий процесс уже открыл трафик.

Исправление:
- global `clear()` теперь получает `statePath()` и результат `removeState()`;
- если canonical file уже отсутствует, но `volatileFailClosed` всё ещё активен, перед снятием latch выполняется `syncParentDirectory(file)`;
- если этот fsync падает, clear бросает ошибку, `volatileFailClosed` сохраняется и система остаётся provider-wide fail-closed;
- обычный успешно durable clear не меняется.

Коммиты product branch:
- `12f33ac80d46bb0d34bc3a89c166281073a2340c` — новый regression script;
- `93b745435a59c76726a5b6306d63e20bc1ad5c15` — продуктовый fix;
- `2626506c2883db349f438de5b97f4f1e72ad91b6` — подключение регрессии в `npm test`;
- `5c8fc5299f77a1c3502082da8827b6d3f20e7592` — немедленное исправление собственной опечатки в `package.json`: существующая зависимость `cors` восстановлена обратно на `^2.8.5`; никаких продуктовых изменений dependency не осталось.

Hosted targeted marker:
- `PROVIDER_CIRCUIT_CLEAR_DURABILITY_PASS absent_file_requires_directory_fsync=1 failed_clear_stays_closed=1`.

Изменённые product-файлы перечитаны после записи; `src/provider-circuit.js` на head содержит новый durable-clear guard.

## Следующий найденный дефект — patch уже подготовлен, но в product пока не применён

В `src/session-store.js::writePrimaryAtomic()` остаётся тот же класс post-fsync cleanup rollback, который уже был закрыт в account/provider state.

Текущая последовательность:
1. новый session primary записан во временный файл и fsync;
2. старый primary переименован в `.txn-backup-*`;
3. новый primary установлен;
4. parent directory fsync успешно подтверждает новый canonical checkpoint;
5. затем `fs.rmSync(rollback)` находится внутри общего `try`;
6. если только cleanup старого rollback даёт `EIO`, общий `catch` удаляет уже подтверждённый новый primary и возвращает старый checkpoint.

Это способно откатить более новый acknowledged session/tool checkpoint после того, как durable commit уже состоялся.

Точный byte-small кандидат сохранён в каноническом control repo:
`autonomy/v3/candidates/QWEN_RELIABILITY_SESSION_PRIMARY_CLEANUP_20260821.patch`.

Кандидат делает удаление старого `.txn-backup-*` best-effort после успешного primary directory fsync и расширяет `session-store-primary-fsync-test.js`: cleanup-only `EIO` не должен отменять `store.set()`, а новый `chatId` должен пережить reload.

Почему не применён сразу: `session-store.js` большой и общий; доступная запись GitHub Contents требует заменить весь файл. Exact source читается, но безопаснее применить уже подготовленный маленький diff byte-safe git/patch исполнителем, чем реконструировать общий файл вручную и рисковать свежими session изменениями.

## Проверки и ограничения этого прохода

- стартовый PR #6 head был `d605db5d8f8411f9054ffabf258616d5b9e0132d`; до наших записей параллельного сдвига не было;
- targeted provider-circuit test выполнен на ChatGPT hosted Node и PASS;
- полный exact-tree `npm test` не заявлен: hosted container по-прежнему не резолвит `github.com` для git clone;
- CircleCI/GitHub Actions/Cloudflare: 0 ручных запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты.

## Постоянная память — состояние на старте этого запуска

В начале прочитан `autonomy/v3/workspaces/QWEN_RELIABILITY/LATEST.json`; parent Git blob SHA: `7c6b4cc41788564284bf5a425231eac0e3c5058e`.

LATEST указывал на:
- capsule `20260821T180127Z-57d53429ab`;
- archive SHA-256 `e26712f0911509a4258e3a2bae4884052bfe7e9a76c984e08b6d4850fddbb6f5`;
- manifest Git blob SHA `84ec7c51ddbbc21ac7ee45c3d932a14b444ceb8a`;
- part Git blob SHA `eea62fe0dfc4ea19fff0a16a8f085690fe64b9f4`.

Manifest + exact part были материализованы локально; нормативный `capsule_runtime_v4.py restore` дал PASS и восстановил checkpoint/result без ручной реконструкции неизвестных bytes.

## Следующий безопасный кусок

1. Сначала завершить нормативный finish этого запуска: checkpoint -> pack v4 -> immutable upload -> read-back verify -> re-read LATEST -> CAS publish только если parent blob SHA всё ещё `7c6b4cc...`; при конфликте не force-write.
2. На следующем product проходе перечитать свежий PR #6 head.
3. Если `src/session-store.js` не был параллельно исправлен, применить `QWEN_RELIABILITY_SESSION_PRIMARY_CLEANUP_20260821.patch` byte-safe способом и прогнать `session-store-primary-fsync-test.js` на hosted Node.
4. Затем продолжить аудит остальных post-fsync cleanup-путей и stream/local-persistence границ, не возвращаясь к уже закрытым дефектам.
