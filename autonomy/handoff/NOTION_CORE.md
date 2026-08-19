# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`.
Текущий head: `13a966036e378eeb7de57d60a6befa6c44fe3693`. PR #7.

NCM28 ещё не закрыт, но Windows-причина сильно сужена. На commit `6856f3c7ba82b9428d2fe93c1124861cccdfc18f` native CircleCI доказал: исключение проходит через `atomic_write`, `parent_guard` там присутствует, непосредственный caller — `integrated_upgrade.py`, не auth и не migration. Значит гипотеза «забыли передать guard» уже неверна: ломается конкретная запись внутри integrated coordinator при существующем guard.

В этом проходе добавлен ещё более узкий безопасный классификатор по непосредственной функции-владельцу вызова: `_outer_update`, `_write_durable_backups`, `_write_stable_owner_in_guard`, `_run_upgrade_locked` или другой caller. Триггерный commit `dc408c668fc8f52d1f9c74401dabe643e244fb56`, CircleCI workflow `fa4d9d00-d92c-45b9-a280-3e1c1da4ea2b`. На момент handoff пять Windows jobs ещё pending. В этой диагностике FAILURE означает «callsite совпал», SUCCESS — «не совпал».

Классификатор сразу разоружён commit `13a966036e378eeb7de57d60a6befa6c44fe3693`, поэтому следующие push не создадут новый fan-out.

Следующий шаг: сначала прочитать статусы commit `dc408c...`; по единственному совпавшему caller исправить первопричину, собрать новый candidate и сделать один узкий native Windows happy-path. После PASS сразу проверить recovery/restart и полный relevant Windows suite. Затем перейти к реальному Codex CLI: несколько tool-вызовов, локальное действие, tool result, продолжение модели; дальше полный tool matrix, restart/crash и длинный прогон.

Не объявлять NOTION_CORE_DONE только по NCM28. Не печатать секреты/пути восстановленного runtime. Production ради теста не трогать.
