# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 13:48 МСК

Notion Core продолжает отдельную Windows/NCM28 линию: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `75d5127c6da0a45f7a1a9d1fe2d78620c067ed34`. Core по-прежнему не меняет `payload/server.py` вокруг Responses: его blob остаётся `2376ae8bda35ac00d1fe32949b06e37419afa845`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `ccfad1a963e97e3e0d63d5fb8bb8a4ab39b87dec`, `mergeable=true`.

Что уже реально реализовано и проверено:
- `engineer` и `owner` режимы системного промпта;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания, рецензирования и большой конкурирующей Codex-персоны;
- `runtime_context` владельца отделён и нейтрален;
- prompt/runtime policy входит в cache/thread identity только через SHA-256, без сохранения приватного текста;
- prompt wiring материализован прямо в `payload/server.py`: `responses_planner_prompt()` вызывает `compose_responses_planner_prompt(...)`;
- function/custom tools и structured output сохраняются через нейтральный технический слой;
- незавершённая tool-цепочка держит sticky account, независимая новая Sol-задача обходит зарезервированный слот;
- lease-level тесты доказывают две независимые задачи на двух свободных легитимных слотах, ожидание busy preferred-account, пропуск cooling-слота и fail-closed поведение при отсутствии подходящей свободной ёмкости;
- при cooldown закреплённого аккаунта continuation не переносит старый Notion thread на соседний аккаунт: полная локальная история создаёт новый Notion thread на новом легитимном слоте, после чего affinity переносится на фактически использованный account/thread;
- предыдущий отдельный CircleCI workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6` полностью зелёный: 7/7 контрактов PASS — prompt modes, prompt-policy identity, настоящий server wiring, ранний HTTP 400, account-pool parallelism, foreground slot routing, cooldown failover.

Что сделал в этом запуске:
1. Перечитал свежие OWNER_INTENT/CURRENT/handoff и заново проверил PR #7/#8.
2. Подтвердил, что Core ушёл вперёд до `75d5127c...`, но `payload/server.py` в зоне Responses всё ещё тот же exact blob `2376ae8b...`. Продуктового конфликта с Agent-линей здесь по-прежнему нет.
3. Добавил `tools/live_two_slot_codex_probe.py` — ограниченный настоящий provider-probe для уже авторизованной среды (commit `e906ce45ffa62abbe47eb6bd86949968bb42a573`).
4. Probe сначала fail-closed проверяет минимум два легитимных аккаунта одного workspace через `validate_private_pool`, затем строит настоящий `NotionAccountPool`.
5. Он параллельно запускает две независимые Responses/Sol-задачи, каждая обязана получить function call `probe_marker`; после первого раунда проверяется, что turn affinities реально принадлежат разным `account_id`.
6. Затем обе задачи параллельно продолжаются через `function_call_output`; probe требует, чтобы каждая continuation сохранила свой исходный sticky account.
7. В лог намеренно не выводятся token/account/thread/path/provider payload или prompt: только `NOTION_TWO_SLOT_CODEX_LIVE_PASS` и агрегат `independent_slots=2 sticky_continuations=2`.
8. Добавил `tests/test_live_two_slot_probe_contract.py` с тремя fail-closed контрактами на форму запроса и разбор OpenAI Responses function-call. Текущий commit после этого теста: `ccfad1a963e97e3e0d63d5fb8bb8a4ab39b87dec`.
9. Свежая проверка PR #8 после этих изменений: `mergeable=true`, draft остаётся намеренно.

Что ещё не завершено:
1. Новый `live_two_slot_codex_probe.py` и его новый unit-contract пока НЕ запускались удалённо. Нельзя называть их PASS до реального исполнения.
2. Сам live-probe тоже пока НЕ запускался: текущий `.circleci/config.yml` специально оставлен byte-for-byte из Core и фильтрует только NCM28-ветку, чтобы Agent не перетёр активный Windows executor.
3. Нужен ровно один one-shot запуск `tools/live_two_slot_codex_probe.py` в уже авторизованной среде после восстановления runtime-state. Не запускать второй параллельный provider-тест, если уже есть активный.
4. После двухслотового PASS нужен отдельный ограниченный сценарий настоящего временного cooldown владельца: полная история должна переехать на новый легитимный слот и новый Notion thread, без reuse чужого thread_id. Офлайн-контракт этого уже зелёный, живое доказательство ещё нет.
5. Agent-ветку затем аккуратно синхронизировать со свежим Core, не перетирая NCM28/CircleCI.
6. Только после живого Codex многошагового PASS переходить к субагентам; затем проектировать делегирование задач в Qwen.

Следующий запуск: сначала проверить свежие PR #7/#8 и наличие уже идущего one-shot. Если live-окружение свободно, временно добавить отдельный one-shot CircleCI job для Agent-ветки или использовать уже существующий авторизованный исполнитель: восстановить runtime-state, извлечь account-home, сначала прогнать `python -m unittest tests.test_live_two_slot_probe_contract`, затем `python tools/live_two_slot_codex_probe.py --account-home <restored-home>`, обязательно очистить расшифрованное состояние в `always`/trap и сразу после получения результата вернуть Core `.circleci/config.yml`. Если live запуск недоступен — не ждать, а закрыть следующий независимый кусок по capability/subagent protocol.
