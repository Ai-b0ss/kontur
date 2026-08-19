# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. За этот запуск Core ушёл с `a62833f68c2119c0879137fa457c47569c079c70` до `8ba5072a8381dcbdc6dd38d63d0466370266cde8`. Эти шесть новых коммитов меняют только CircleCI и Windows/NCM28 инструменты (`.circleci/config.yml`, `tools/build_ncm28_windows_fixed_candidate_v21.py`, новый v22 builder и guarded-write probe); `payload/server.py`, prompt-mode и account-pool они не трогают.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `f5af34647cd2be9104800a838012286b787b8451`. PR сейчас временно показывает `mergeable=false`, потому что base-ветка Core заметно ушла вперёд; продуктового пересечения с последними шестью Core-коммитами не найдено.

Что уже сделано по двум режимам системного промпта:
- есть `payload/prompt_modes.py` с явными режимами `engineer` и `owner`;
- `engineer` остаётся режимом по умолчанию и получает наш инженерный управляющий текст;
- `owner` требует отдельный `client_metadata.owner_system_prompt`, сохраняет его без нормализации/переписывания и не подмешивает большую персону Codex;
- owner-режим вообще не извлекает runtime-контекст из `body.instructions`; нейтральный технический контекст приходит отдельно через `client_metadata.runtime_context`;
- неправильный тип `runtime_context` закрывается явной ошибкой;
- добавлена Responses-ориентированная сборка `compose_responses_planner_prompt(...)`: она формирует нейтральный контракт function/custom tools и structured output отдельно от прикладного системного промпта;
- тесты чистого prompt-mode уже доказывают дословный owner prompt, отсутствие конкурирующей Codex/engineer персоны, сохранение tools/custom-tools/json-schema.

Что сделано по ротации/распределению слотов:
- подтверждена и зафиксирована семантика `ForegroundAccountReservations`: новая независимая Sol-задача без affinity обходит аккаунт, зарезервированный незавершённой tool-цепочкой; continuation с affinity возвращается по своему пути;
- `tests/test_foreground_slot_routing.py` покрывает обход чужой reservation, сохранение affinity, ожидание при полностью занятых foreground-слотах, TTL заброшенной reservation и обход reservation вспомогательными/memory запросами;
- `tests/test_account_pool_parallelism.py` покрывает lease-level поведение самого `NotionAccountPool`: две независимые задачи занимают разные свободные аккаунты; preferred continuation возвращается к своему слоту; busy preferred ждёт свой слот; cooling слот пропускается; reservation одного слота + cooldown другого закрываются отказом, а не cross-route.

Новый кусок этого запуска — реальный Responses-путь:
- добавлен `tests/test_responses_prompt_wiring_contract.py`, который проверяет именно `payload.server.responses_planner_prompt()`: owner prompt должен реально попасть в серверный prompt, Codex-persona и неверный cwd не должны просочиться, tools должны сохраниться, неполный owner-mode должен дать `PromptModeError`;
- добавлен `tools/apply_prompt_mode_wiring.py` — узкий fail-closed патч для `payload/server.py`. Он заменяет вторую ручную реализацию planner prompt на один вызов `compose_responses_planner_prompt(...)` и отказывается работать, если исходный участок `responses_planner_prompt()` уже изменился. Это сделано специально, чтобы не переписывать большой `server.py` вслепую и не пересекаться с Windows-линейкой Core;
- первая полная проверка во временном checkout (`cc7aa16d79f4ba89b2ce4f2a261d945b943f09af`, CircleCI `c6af2bf8-4ae7-43aa-b118-8d9f6d3334c4` / `d868be52-27fb-4a84-b048-7a3f3afe7476`) дала FAIL. Логи CircleCI из текущего интерфейса недоступны, поэтому причина не выдумывается;
- чтобы не гадать, проверка сразу разрезана: новый commit проверочной ветки `b64f2acab39710a862d2efa075c31cfa06686212`, CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907` / `d7b78044-ab25-4ff6-9f06-acb5bb201b17` сейчас PENDING и проверяет только применение узкого патча + `py_compile` `server.py/prompt_modes.py`. Если это зелёное — первый FAIL находится уже в server-path тестах/окружении, а не в самом патче.

Предыдущие проверки:
- prompt-mode contract: CircleCI `f2927c5f-04ae-4ed5-9cf4-c0951cf28d46` / `346e6110-ff90-4edf-b50a-97391ef3cefc` — PASS;
- prompt + foreground reservation + account-pool parallelism: CircleCI `defd387f-31fc-48db-be66-a0be870bd9c2` / `17f4db31-4f8f-498b-b081-706c92363733` — PASS.

Что пока НЕ завершено:
- `payload/server.py` в самой рабочей ветке ещё не изменён: сначала надо доказать узкий wiring на временном checkout; большой ручной rewrite файла запрещён;
- handler `handle_openai_responses()` ещё надо явно перевести `PromptModeError` в клиентский 400, а не позволять ему провалиться в общий 502;
- lease-level тесты всё ещё офлайн: нет настоящего Codex Responses сценария с двумя легитимными слотами и несколькими tool-result продолжениями;
- субагенты и делегирование в Qwen намеренно не начинаются до устойчивого Codex-ядра.

Следующий шаг:
1. прочитать результат CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907`: если patch+compile PASS — вернуть полный набор и сузить первый FAIL до конкретного теста; если patch+compile FAIL — править только `tools/apply_prompt_mode_wiring.py` по точному контракту `server.py`;
2. после зелёного временного server-path proof перенести ровно доказанный wiring в рабочий `payload/server.py` и добавить явный 400 для `PromptModeError`;
3. затем поднять проверку до bounded реального Codex tool-loop на двух легитимных слотах: две независимые foreground задачи идут параллельно по разным аккаунтам, а незавершённая цепочка после локального tool-result возвращается к исходному аккаунту; отдельно проверить cooldown/failover;
4. только после устойчивого реального Codex-ядра переходить к исследованию Codex subagents и делегированию задач в Qwen.
