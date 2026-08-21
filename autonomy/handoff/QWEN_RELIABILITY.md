# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `d605db5d8f8411f9054ffabf258616d5b9e0132d`.

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
- четыре границы local/provider из предыдущего прохода закрыты: local preparation до provider I/O, durable `markSuccess`, durable CAPTCHA/rate-limit/account failure и durable provider-circuit trip. Product head той волны: `925682bc36338a249a26dae2c684380c21ba8db7`.

## Закрыто в этом проходе

### 1. Ошибка записи состояния внутри accepted-stream error observer больше не проглатывается

`stream-session-guard` раньше намеренно изолировал любые исключения из `opts.onError`. Это правильно для обычной ошибки observer-кода, но в реальном `server.js` этот callback записывает CAPTCHA/ошибку аккаунта. Если `account-store` бросал `EIO/ENOSPC/EDQUOT/EROFS/EACCES/EPERM`, ошибка записи состояния исчезала, клиент видел только upstream error, а маршрут завершался как будто запись cooldown/error состоялась.

Теперь:
- известные ошибки долговечности из observer преобразуются в `QWEN_LOCAL_PERSISTENCE`;
- guard отвергает Promise обратно маршруту и пишет `server_error`, а не маскирует проблему как provider error;
- обычные observer-ошибки без признака storage/persistence по-прежнему изолируются, чтобы не заменять исходную ошибку провайдера.

Коммиты:
- `723174444b4c5240aa5350e7a32c094b1b2dc23a` — продуктовый guard;
- `08a08d1bd62165c818fcb1558751ba051f57e5bd` — регрессия.

Hosted targeted marker: `STREAM_OBSERVER_PERSISTENCE_FAIL_CLOSED_MODEL_PASS`.

### 2. Durable account/cooldown state больше не откатывается из-за cleanup-only ошибки

В `account-store.persist()` после `rename(temp -> canonical)` и успешного `fsync` родительского каталога новый JSON уже является подтверждённым каноническим состоянием. Но удаление старого `.txn-backup-*` было внутри общего `try`: если именно cleanup давал `EIO`, общий `catch` удалял уже подтверждённый новый файл и возвращал старый backup. Для CAPTCHA/rate-limit это могло откатить свежий cooldown к старому доступному состоянию.

Теперь удаление transaction backup после подтверждённого canonical replacement — best-effort cleanup и не может откатить новый account/cooldown state. Ошибка до подтверждающего directory `fsync` по-прежнему откатывается и бросается наружу.

Коммиты:
- `c1112b4fa33dbe987cee2bbc430a1e0b8db5f6a0` — продуктовый фикс;
- `d605db5d8f8411f9054ffabf258616d5b9e0132d` — регрессия на synthetic backup-cleanup `EIO`.

Hosted markers:
- `ACCOUNT_DURABLE_REPLACEMENT_CLEANUP_REPRO_PASS` — старый rollback воспроизведён;
- `ACCOUNT_DURABLE_REPLACEMENT_CLEANUP_PASS` — новый инвариант подтверждён моделью.

## Проверки и ограничения этого прохода

- изменённые файлы перечитаны после записи через GitHub;
- внешний exact-tree `npm test` не заявлен: hosted контейнер не резолвит `github.com`, поэтому полный checkout недоступен;
- выполнены только локальные целевые модели на hosted Node;
- CircleCI/GitHub Actions/Cloudflare: 0 запусков;
- provider/live Qwen: 0 запросов;
- реальные аккаунты, секреты и production не тронуты.

## Постоянная память

В начале запуска прочитан `LATEST.json` и запомнен parent Git blob SHA `fd5bbad19679273346da3e46da8ebfeefc56f5a6`.

Стартовая capsule `20260821T170333Z-9e3802c8f0` была материализована из exact manifest + 2 parts и прошла нормативные `capsule_runtime_v4.py verify` и `restore`; archive SHA-256 `687dad1f2d54982eef042663705bfc33f8096846157154722d2513fefb58d263`.

После работы выполнен `checkpoint -> pack v4`. Новая immutable capsule:
- `20260821T180127Z-57d53429ab`;
- source ref `Ai-b0ss/qwen-free-api@d605db5d8f8411f9054ffabf258616d5b9e0132d`;
- archive SHA-256 `e26712f0911509a4258e3a2bae4884052bfe7e9a76c984e08b6d4850fddbb6f5`;
- 1 part, 2048 символов, SHA-256 text `9732f6a325bceeeb5dbc1473fa0fe91c3cd362e7159e49562e1c8cdc64681a9a`;
- uploaded part Git blob SHA `eea62fe0dfc4ea19fff0a16a8f085690fe64b9f4`;
- uploaded manifest Git blob SHA `84ec7c51ddbbc21ac7ee45c3d932a14b444ceb8a`.

После upload part и manifest перечитаны; их Git blob SHA совпали с локально вычисленными. Локальные `verify + restore` новой capsule дали PASS.

Непосредственно перед CAS `LATEST` был перечитан и сохранил стартовый parent SHA `fd5bbad...`; конфликтов не было. Старый `LATEST` сохранён в `PREVIOUS`, затем новый `LATEST` опубликован exact CAS и перечитан.

Текущий `LATEST`:
- capsule `20260821T180127Z-57d53429ab`;
- Git blob SHA `7c6b4cc41788564284bf5a425231eac0e3c5058e`;
- archive SHA-256 `e26712f0911509a4258e3a2bae4884052bfe7e9a76c984e08b6d4850fddbb6f5`.

## Следующий безопасный кусок

1. В начале следующего запуска восстановить новый `LATEST` через v4.
2. Перечитать свежий PR #6: параллельный writer может сдвинуть head.
3. Не переделывать два исправления выше.
4. Проверить остальные post-fsync cleanup-пути в account/session state и stream route: после подтверждённой canonical записи cleanup-only ошибка не должна откатывать более новое safety state; локальная persistence-ошибка не должна теряться или превращаться в provider transport.
5. Если станет доступен byte-safe exact-tree materialization на hosted машине, выполнить релевантные штатные regression scripts и `npm test` локально без CircleCI/GitHub Actions/provider traffic.
