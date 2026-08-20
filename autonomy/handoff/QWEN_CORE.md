# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `e7d7ca50d1bb3737d73b6e46821b5548d7b439c0`, PR draft/open, `mergeable=false` относительно `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

Что сделано:
- Заново прочитаны OWNER_INTENT/CURRENT/handoff, затем живые PR и исходники обоих Qwen-репозиториев. Старый Qwen handoff был на `64c91058…`; живой head в начале запуска совпадал с ним.
- Найден реальный дефект crash-recovery в `src/session-store.js`: backup записывался новым кандидатом до подтверждения primary. Если финальный primary commit падал, а позже primary становился нечитаемым, restart мог восстановить из backup состояние, которое вызывающему коду уже было объявлено неуспешным.
- Исправлена граница подтверждения: primary теперь коммитится первым через отдельный rollback-файл; при ошибке после видимого rename старый primary возвращается. Recovery backup обновляется только после подтверждённого primary и не может публиковать отвергнутый кандидат.
- Ошибка обновления recovery backup после уже подтверждённого primary не превращает успешный primary commit в ложный отказ: в худшем случае backup остаётся старым, но валидным.
- Усилен `session-store-restart-test.js`: после неудачного primary commit backup обязан остаться на последнем подтверждённом `chat-b`; при последующей порче primary restart всё равно должен восстановить `chat-b`, а не отвергнутый `chat-c`.
- Добавлен отдельный `scripts/session-store-primary-fsync-test.js`: он ломает именно `fsync` каталога после уже выполненного rename primary и проверяет откат canonical-файла, неизменность backup и отсутствие временных transaction-файлов.
- Новый тест включён в общий `npm test`. Случайно затронутая версия `cors` сразу возвращена к исходной `^2.8.5`; итоговый `package.json` отличается по смыслу только добавлением нового regression-теста.

Что проверено:
- PR #6 действительно обновлён до `e7d7ca50d1bb3737d73b6e46821b5548d7b439c0`.
- Diff от исходного `64c91058…` ограничен `src/session-store.js`, двумя session-store regression-тестами и строкой общего `npm test` в `package.json`.
- `qwen-workspace` PR #5 остаётся на `ce51b26c…`, `mergeable=true`; текущий cache-код перечитан, новых правок туда не потребовалось.
- CAPTCHA-ротация, account/thread affinity, bounded failover, provider circuit, tool-loop и два режима system prompt в этом запуске не откатывались.
- Живой Qwen не запускался и старая разрешённая provider-попытка не дублировалась.
- CircleCI для ветки настроен на автоматический offline regression после push, но через доступную GitHub status-поверхность для exact head по-прежнему нет результата; зелёный full regression не объявлять без фактического подтверждения.

Следующее:
1. Снять фактический `npm test`/CircleCI на `e7d7ca50…`. Если красный — чинить конкретное падение, не откатывая новый session durability и CAPTCHA-ротацию.
2. Особо проверить вместе `session-store-restart-test.js` + `session-store-primary-fsync-test.js`; затем обычный полный regression.
3. После offline green — один bounded Windows offline parity на exact продуктовой линии, без provider traffic.
4. Затем восстановить судьбу старой разрешённой live-попытки. Только если доказано, что она до провайдера не дошла, выполнить ровно один живой `read_file → tool result → следующий модельный ход → bash → tool result → final`, затем restart и безопасный failover незавершённой задачи.
5. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret/checkpoint решения.
