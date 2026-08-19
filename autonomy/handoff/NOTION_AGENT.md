# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 12:52 МСК

Notion Core продолжает отдельную Windows/NCM28 линию: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `30a75728ec3f2213793e0718dc6d6dfbe0dd344b`. Core по-прежнему не меняет `payload/server.py` вокруг Responses: его blob остаётся `2376ae8bda35ac00d1fe32949b06e37419afa845`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `7d975caa811f5d729e5dcc864f922fa95cc54b3f`. PR после возврата свежей Core-конфигурации CircleCI снова `mergeable=true`.

Что уже реально реализовано и проверено:
- `engineer` и `owner` режимы системного промпта;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания, рецензирования и большой конкурирующей Codex-персоны;
- `runtime_context` владельца отделён и нейтрален;
- prompt/runtime policy входит в cache/thread identity только через SHA-256, без сохранения приватного текста;
- доказанный prompt wiring теперь уже материализован прямо в настоящем `payload/server.py`: `responses_planner_prompt()` вызывает `compose_responses_planner_prompt(...)`;
- function/custom tools и structured output сохраняются через нейтральный технический слой;
- незавершённая tool-цепочка держит sticky account, независимая новая Sol-задача обходит зарезервированный слот;
- lease-level тесты доказывают две независимые задачи на двух свободных легитимных слотах, ожидание busy preferred-account, пропуск cooling-слота и fail-closed поведение при отсутствии подходящей свободной ёмкости;
- при реальном cooldown закреплённого аккаунта continuation не переносит старый Notion thread на соседний аккаунт: полный локальный history создаёт новый Notion thread на новом легитимном слоте, после чего affinity переносится на фактически использованный account/thread.

Что сделал в этом запуске:
1. Обнаружил, что другой автономный проход уже безопасно материализовал prompt wiring в `payload/server.py`; текущий blob Agent-ветки `3bb268933763f72bc4987173af0da5e1f38ef27e`, и внутри `responses_planner_prompt()` уже один общий вызов prompt-policy.
2. Снял точный результат свежего CircleCI на commit `bc64e60...`: prompt-mode и prompt-policy identity были зелёными, а все тесты, которые импортируют `server`/`account_pool`, падали.
3. Причину локализовал в самом тестовом окружении, а не продукте: `.circleci/config.yml` добавлял `regression/stubs` и `payload`, но забыл `regression/test_support`, где лежит тестовая `notion_agent_cli`.
4. Commit `49874080c73a3bbaea165fce6dc252d34297a87c` вернул `regression/test_support` в `PYTHONPATH`.
5. CircleCI workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6` после этого полностью зелёный: все 7/7 контрактов PASS — prompt modes, prompt-policy identity, настоящий server wiring, ранний HTTP 400, account-pool parallelism, foreground slot routing, cooldown failover.
6. После доказательства вернул в Agent-ветку свежий `.circleci/config.yml` из Core byte-for-byte (commit `7d975caa811f5d729e5dcc864f922fa95cc54b3f`), чтобы наша линия не перетирала активный NCM28 Windows executor. После этого PR #8 снова mergeable=true.
7. Обновил описание PR #8: старые формулировки про «wiring ещё не материализован» удалены, точный зелёный workflow и оставшиеся шаги зафиксированы.

Что ещё не завершено:
1. Нужна аккуратная синхронизация Agent-коммитов с текущим Core, но продуктового конфликта вокруг Responses сейчас нет; `.circleci` уже приведён к Core.
2. Следующий главный рубеж — один bounded реальный двухслотовый Codex Responses tool-loop в уже авторизованной среде: две независимые foreground-задачи должны реально уйти на разные свободные слоты; tool-result continuation должна вернуться на свой sticky account/thread; при настоящем временном отказе владельца нужен полный history rebase на новый легитимный слот/новый Notion thread.
3. Не запускать второй живой provider-тест параллельно с уже активной Core/Agent работой без проверки свежего состояния и существующих one-shot запусков.
4. После реального Codex многошагового PASS — исследовать/подключать субагентов, затем проектировать делегирование задач в Qwen.

Следующий запуск: сначала проверить свежие PR #7/#8 и не появилось ли нового изменения `payload/server.py` в Core. Если Agent остаётся mergeable и Core не тронул Responses, подготовить ровно один безопасный one-shot live proof двухслотового Codex tool-loop с обязательной очисткой и без печати секретов. Если live-окружение ещё занято/не восстановлено — вместо ожидания закрыть независимый кусок по capability/subagent protocol, но не менять Windows/NCM28 файлы.
