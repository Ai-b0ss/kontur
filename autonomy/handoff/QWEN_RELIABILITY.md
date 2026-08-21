# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `5cc928607cf4d001cbf9adbc007277dccbdefe4b`.

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
- fsync-confirmed account/cooldown replacement не откатывается из-за cleanup-only удаления старого backup;
- explicit global provider-circuit clear не снимает fail-closed память без durable подтверждения родительского каталога.

## Закрыто в этом проходе

### Session primary больше не откатывается из-за cleanup-only ошибки после durable commit

Свежий `src/session-store.js::writePrimaryAtomic()` перечитан после параллельного изменения ветки. Дефект из прошлого handoff подтвердился: после успешного `rename(tmp -> FILE)` и `syncParentDirectory(FILE)` удаление старого `.txn-backup-*` всё ещё находилось в общем `try`, поэтому чистый `EIO` на уборке мог попасть в rollback-ветку и вернуть старый checkpoint.

Исправление:
- после успешного parent-directory fsync новый primary считается каноническим;
- удаление старого transaction backup стало cleanup-only и best-effort;
- ошибка уборки больше не удаляет fsync-подтверждённый новый session/tool checkpoint;
- все ошибки до commit point, включая ошибку parent-directory fsync, по-прежнему откатываются к старому подтверждённому primary.

Product commits:
- `ba09219adeb82574fbcbfaa07346b9f7971ed150` — продуктовый fix в `src/session-store.js`;
- `5cc928607cf4d001cbf9adbc007277dccbdefe4b` — расширенный `scripts/session-store-primary-fsync-test.js` с cleanup-only `EIO` и проверкой reload.

Важная гонка с другим writer была обработана безопасно: первая запись старой версии файла получила GitHub `409`, после чего был заново перечитан свежий `session-store.js` и сохранены параллельные изменения по exact system-message checkpoint. Старый файл не форсировался и чужая работа не затёрта.

Hosted targeted model marker:
`SESSION_PRIMARY_CLEANUP_DURABILITY_PASS cleanup_only_no_rollback=1`.

Полный exact-tree `npm test` не заявлен: hosted container не смог получить целиком репозиторий по сети. CircleCI/GitHub Actions/Cloudflare не запускались; живых Qwen/provider запросов — 0.

## Следующий найденный дефект

Следующий независимый fail-open найден в `src/subagent-batch-store.js` + `src/subagent-agent-runner.js`, то есть в защите от повторного выполнения side effects.

`writeAtomic()` уже правильно считает новый batch state каноническим после rename + parent fsync и допускает leftover `.bak-*`, если cleanup старого backup не удался. Но если позже canonical `subagent-batches.json` повреждён, `readState()` молча берёт `readNewestBackup()` и возвращает старый backup как авторитетное состояние без признака recovery uncertainty.

Опасная последовательность:
1. старый backup содержит `pending` или более старое состояние;
2. новый canonical `running/uncertain/done` был durable, а cleanup старого backup дал ошибку и backup остался;
3. позже canonical повреждается;
4. restart молча восстанавливает старый backup;
5. `runAgentSubagents()` может снова выполнить задачу, потому что `pending`/обычный старый state не блокирует replay, хотя mutating tool side effect в более новом потерянном состоянии уже мог произойти.

Это тот же класс stale-backup uncertainty, который session-store уже обрабатывает fail-closed.

Следующая безопасная правка: recovery из `.bak-*` должен явно маркировать batch/task как uncertain (или возвращать recovery metadata, которое runner трактует как uncertain) и блокировать автоматический replay до явного `retryUncertain=true`. Нельзя автоматически считать stale `done`, `failed` или `pending` истинными. Существующие diagnostics/signature нужно сохранить.

Регресс должен покрыть: durable более новый running/side-effect-capable state -> leftover старый backup -> повреждение canonical -> restart из backup -> автоматический запуск блокируется, пока явно не разрешён uncertain retry.

Полезные существующие тесты: `subagent-batch-resume-test.js`, `subagent-legacy-uncertain-restart-test.js`, `subagent-persisted-state-conflict-test.js`, `subagent-state-persist-batch-boundary-test.js`, `subagent-uncertain-batch-stop-test.js`.

## Постоянная память

Стартовый `LATEST`:
- capsule `20260821T185621Z-d4f0f4eead`;
- исходный Git blob SHA `660e310c7aca0045e59b56f4d0a28cb3cc53da53`;
- archive SHA-256 `da6dc69b691b928d09fac2628e5da304be9fa331bc178b61ef44940dd97b4848`.

Стартовая capsule материализована из exact manifest/part и прошла нормативные v4 `verify + restore`. Лишний локальный newline при первой материализации part был обнаружен проверкой и удалён; неизвестные bytes не угадывались.

После работы выполнены checkpoint workspace evidence -> `pack v4` -> локальные `verify + restore` -> immutable upload -> повторное чтение всех parts и manifest.

Новая capsule:
- `20260821T200001Z-8a7c1e4d7a`;
- source ref `Ai-b0ss/qwen-free-api@5cc928607cf4d001cbf9adbc007277dccbdefe4b`;
- archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`;
- archive size 1641 bytes;
- 2 parts: 2048 и 140 символов;
- uploaded part0 Git blob SHA `7f93270f1ef1c912e7add715ec0d7d4d16bf9161`;
- uploaded part1 Git blob SHA `dcf021740cf29b8f746e324dc0622622e9cdafc8`;
- uploaded manifest Git blob SHA `dc49aa3449e3491dbdb7a57323206a573824f1e6`.

После upload оба part и manifest перечитаны; их Git blob SHA и SHA-256 текста точно совпали с локальными значениями.

Непосредственно перед CAS `LATEST` был перечитан и сохранил стартовый parent SHA `660e310c...`; конфликта не было. Старый `LATEST` сохранён в `PREVIOUS`, затем новый опубликован exact CAS и перечитан.

Текущий `LATEST`:
- capsule `20260821T200001Z-8a7c1e4d7a`;
- Git blob SHA `31d12fe0d190da24c7afc612db55165c675d67a5`;
- archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.

## Следующий безопасный кусок

1. Восстановить текущий `LATEST` через normative v4.
2. Перечитать свежий PR #6 и `subagent-batch-store.js`/runner, потому что параллельный writer может сдвинуть head.
3. Если stale-backup uncertainty ещё не закрыта, добавить fail-closed recovery marker без автоматического replay и targeted regression на повреждённый canonical + leftover stale backup.
4. После одного фикса продолжить аудит остальных durable-state cleanup/recovery путей; не возвращаться к уже закрытым дефектам.
