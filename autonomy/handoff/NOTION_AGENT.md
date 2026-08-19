# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. На начале этого запуска её свежий head был `79f19612f99480c1ef5d88bdb836c695669e6b72`; зона `payload/server.py` вокруг Responses/prompt-mode не пересекалась с последними Windows-зондами Core.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этого запуска: `5ae413111ab55ed0f803daf2b00ed9db1251c057`.

Что уже сделано по двум режимам системного промпта:
- есть `payload/prompt_modes.py` с явными режимами `engineer` и `owner`;
- `engineer` остаётся режимом по умолчанию и получает наш инженерный управляющий текст;
- `owner` требует отдельный `client_metadata.owner_system_prompt`, сохраняет его без нормализации/переписывания и не подмешивает большую персону Codex;
- owner-режим вообще не извлекает runtime-контекст из `body.instructions`; нейтральный технический контекст должен приходить отдельно через `client_metadata.runtime_context`;
- неправильный тип `runtime_context` закрывается явной ошибкой;
- контрактные тесты prompt-mode уже покрывают отсутствие просачивания Codex-persona, дословный owner prompt и нейтральное подключение runtime/tool/output контекста.

Что сделано в этом запуске по ротации/распределению слотов:
- перечитан текущий `payload/server.py`; там уже есть `ForegroundAccountReservations` и правило `should_avoid_reserved_foreground_accounts()`;
- подтверждён нужный замысел: новая независимая foreground Sol-задача без affinity должна обходить аккаунт, зарезервированный незавершённой tool-цепочкой; продолжение с affinity, наоборот, не должно обходить свой закреплённый аккаунт;
- добавлен новый тестовый файл `tests/test_foreground_slot_routing.py` с пятью точными сценариями: новая Sol-задача избегает зарезервированного аккаунта; continuation сохраняет affinity; при двух занятых foreground-слотах посторонний маршрут ждёт освобождения; заброшенная reservation протухает по TTL; memory/GPT-5.5 auxiliary тоже обходят foreground reservation.

Ограничение проверки: в этом запуске новый файл добавлен в GitHub, но удалённый исполнитель тестов не запускался. GitHub Actions minutes у владельца закончились; отдельный CircleCI job под этот новый тест ещё не добавлялся. Поэтому это пока кодовый regression-contract, а не доказанный PASS.

Важно: prompt-policy всё ещё не подключена к реальному `responses_planner_prompt()`; PR #8 пока не меняет боевой Responses-путь.

Следующий шаг:
1. минимально подключить `resolve_prompt_policy()`, `resolve_operator_context()` и `compose_planner_prompt()` к `responses_planner_prompt()` без изменения Windows/NCM28 частей;
2. добавить интеграционный тест именно реального Responses/Codex prompt: owner text доходит дословно, `instructions` Codex не просачивается, tool catalog и structured-output остаются нейтрально доступны;
3. запустить новый prompt+slot-routing набор в существующем CircleCI или другом уже подключённом бесплатном исполнителе;
4. затем поднять тест на уровень реального account-pool lease: два независимых foreground Sol-turn одновременно получают разные свободные легитимные слоты, а continuation незавершённой tool-цепочки возвращается к своему аккаунту; отдельно проверить cooldown одного слота и отсутствие кражи reservation новой задачей.
