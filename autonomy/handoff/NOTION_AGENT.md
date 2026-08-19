# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. На этом запуске Core ушёл вперёд до `a62833f68c2119c0879137fa457c47569c079c70`; последний commit менял только CircleCI-разрез native guarded write, не Responses/prompt-mode. Поэтому рабочую ветку агентности безопасно синхронизировал с этим Core head без переноса временного CI-конфига поверх Windows-линии.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `579beabb7b53f802d4d4a277de02094b9a603038`. PR снова `mergeable=true` относительно текущего Core.

Что уже сделано по двум режимам системного промпта:
- есть `payload/prompt_modes.py` с явными режимами `engineer` и `owner`;
- `engineer` остаётся режимом по умолчанию и получает наш инженерный управляющий текст;
- `owner` требует отдельный `client_metadata.owner_system_prompt`, сохраняет его без нормализации/переписывания и не подмешивает большую персону Codex;
- owner-режим вообще не извлекает runtime-контекст из `body.instructions`; нейтральный технический контекст приходит отдельно через `client_metadata.runtime_context`;
- неправильный тип `runtime_context` закрывается явной ошибкой;
- добавлена Responses-ориентированная сборка `compose_responses_planner_prompt(...)`: она формирует нейтральный контракт function/custom tools и structured output отдельно от прикладного системного промпта;
- тесты теперь проверяют не только чистую policy, но и Responses-похожий запрос: приватный owner prompt остаётся дословным, конкурирующая Codex-persona и старый engineer prompt не просачиваются, tool catalog/custom tool/json_schema остаются доступны;
- чистый prompt-mode набор реально прошёл в CircleCI: workflow `f2927c5f-04ae-4ed5-9cf4-c0951cf28d46`, job `346e6110-ff90-4edf-b50a-97391ef3cefc`, status SUCCESS на commit `69535f4923a1621f917c6cf3ed38c4bbcd482c1a`. После проверки временный CircleCI-конфиг не перенесён в синхронизированный head, чтобы не конфликтовать с Core Windows job; код prompt/tests в новом head тот же.

Что уже сделано по ротации/распределению слотов:
- в `payload/server.py` уже есть `ForegroundAccountReservations` и правило `should_avoid_reserved_foreground_accounts()`;
- новая независимая foreground Sol-задача без affinity должна обходить аккаунт, зарезервированный незавершённой tool-цепочкой; продолжение с affinity, наоборот, не должно обходить свой закреплённый аккаунт;
- `tests/test_foreground_slot_routing.py` содержит пять сценариев: новая Sol-задача избегает зарезервированного аккаунта; continuation сохраняет affinity; при двух занятых foreground-слотах посторонний маршрут ждёт освобождения; заброшенная reservation протухает по TTL; memory/GPT-5.5 auxiliary тоже обходят foreground reservation.

Что пока НЕ доказано:
- prompt-policy ещё не подключена к реальному `server.responses_planner_prompt()`; helper готов, но боевой Responses-путь всё ещё собирает старый planner prompt сам;
- slot-routing тесты пока не прогнаны удалённо на новом head;
- нет ещё account-pool lease-level проверки, где два независимых foreground Sol-turn действительно получают разные свободные аккаунты, continuation возвращается на свой, а cooldown одного слота не крадёт reservation другого.

Следующий шаг:
1. минимально подключить `compose_responses_planner_prompt(...)` в `responses_planner_prompt()` и вернуть `PromptModeError` как явный 400, не затрагивая Windows/NCM28 части;
2. прогнать prompt + slot-routing набор в CircleCI на отдельной проверочной конфигурации/ветке, не перетирая Core `.circleci/config.yml`;
3. добавить lease-level concurrency test на `NotionAccountPool`: два независимых Sol-turn → разные свободные слоты; sticky continuation → исходный слот; один слот в cooldown → новая независимая задача берёт другой, но не аккаунт чужой reservation;
4. после этого поднять проверку до реального Codex Responses tool-loop и затем исследовать субагентов/делегирование, не начиная делегирование в Qwen до устойчивого Codex-ядра.
