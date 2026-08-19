# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. На этом запуске Core ушёл вперёд до `a62833f68c2119c0879137fa457c47569c079c70`; последний commit менял только CircleCI-разрез native guarded write, не Responses/prompt-mode. Рабочую ветку агентности синхронизировал с этим Core head без переноса временного CI-конфига поверх Windows-линии.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `53125a0843dcbc382e832cbfe95c078407d91cc9`. PR `mergeable=true` относительно текущего Core.

Что сделано по двум режимам системного промпта:
- есть `payload/prompt_modes.py` с явными режимами `engineer` и `owner`;
- `engineer` остаётся режимом по умолчанию и получает наш инженерный управляющий текст;
- `owner` требует отдельный `client_metadata.owner_system_prompt`, сохраняет его без нормализации/переписывания и не подмешивает большую персону Codex;
- owner-режим вообще не извлекает runtime-контекст из `body.instructions`; нейтральный технический контекст приходит отдельно через `client_metadata.runtime_context`;
- неправильный тип `runtime_context` закрывается явной ошибкой;
- добавлена Responses-ориентированная сборка `compose_responses_planner_prompt(...)`: она формирует нейтральный контракт function/custom tools и structured output отдельно от прикладного системного промпта;
- тесты проверяют Responses-похожий запрос: приватный owner prompt остаётся дословным, конкурирующая Codex-persona и engineer prompt не просачиваются, tool catalog/custom tool/json_schema остаются доступны.

Что сделано по ротации/распределению слотов:
- подтверждена и зафиксирована семантика `ForegroundAccountReservations`: новая независимая Sol-задача без affinity обходит аккаунт, зарезервированный незавершённой tool-цепочкой; continuation с affinity возвращается по своему пути;
- `tests/test_foreground_slot_routing.py` покрывает пять сценариев: обход чужой reservation, сохранение affinity, ожидание при полностью занятых foreground-слотах, TTL заброшенной reservation, обход reservation вспомогательными/memory запросами;
- добавлен `tests/test_account_pool_parallelism.py` с lease-level проверками самого `NotionAccountPool`: две независимые задачи одновременно занимают разные свободные аккаунты; preferred continuation возвращается к своему слоту; если preferred слот занят, continuation ждёт его, а не крадёт соседний; cooling слот пропускается для новой задачи; сочетание чужой reservation + cooldown второго слота закрывается отказом, а не неправильным cross-route.

Проверка:
- чистый prompt-mode набор ранее прошёл CircleCI: workflow `f2927c5f-04ae-4ed5-9cf4-c0951cf28d46`, job `346e6110-ff90-4edf-b50a-97391ef3cefc`;
- для полной проверки создана отдельная временная ветка `verify/notion-agent-contracts-20260819`, чтобы не менять Core `.circleci/config.yml`;
- полный набор `test_prompt_modes.py + test_foreground_slot_routing.py + test_account_pool_parallelism.py` прошёл: CircleCI workflow `defd387f-31fc-48db-be66-a0be870bd9c2`, job `17f4db31-4f8f-498b-b081-706c92363733`, commit `f31855f48cf0c12bc2f711f1b8dd7c3a216127d5`, status SUCCESS.

Что пока НЕ завершено:
- prompt-policy ещё не подключена к реальному `server.responses_planner_prompt()`; helper и проверка готовы, но боевой Responses-путь пока собирает старый planner prompt сам;
- lease-level тест доказывает scheduler/account-pool семантику без живого провайдера, но ещё нет настоящего Codex Responses сценария с двумя легитимными слотами и несколькими tool-result продолжениями;
- субагенты и делегирование в Qwen пока намеренно не начинаются до устойчивого Codex-ядра.

Следующий шаг:
1. минимально подключить `compose_responses_planner_prompt(...)` в `responses_planner_prompt()` и обрабатывать `PromptModeError` как явный 400; не трогать Windows/NCM28 части;
2. добавить интеграционный тест именно реального `responses_planner_prompt()`/`handle_openai_responses`, чтобы owner prompt прошёл через настоящий серверный путь без Codex-persona;
3. затем поднять проверку до bounded реального Codex tool-loop на двух легитимных слотах: независимые foreground задачи идут параллельно по разным аккаунтам, а незавершённая цепочка после локального tool-result возвращается к исходному аккаунту; отдельно проверить cooldown/failover;
4. только после этого переходить к исследованию Codex subagents и делегированию задач в Qwen.
