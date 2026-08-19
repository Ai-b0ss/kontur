# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `79f19612f99480c1ef5d88bdb836c695669e6b72`.

NCM28 ещё не закрыт. Первый native Windows-разрез `fa4d9d00-d92c-45b9-a280-3e1c1da4ea2b` доказал: исключение проходит через `atomic_write`, `parent_guard` присутствует, файл — `integrated_upgrade.py`; `outer-update`, `write-backups`, `stable-owner`, `run-upgrade` были SUCCESS, `other` — FAILURE.

В этом запуске найдена ошибка самой диагностики: `atomic_json()` — прозрачная обёртка над `atomic_write()`, поэтому старый классификатор терял реального владельца guarded JSON-write. Исправленный owner-классификатор был прогнан workflow `884a4f19-9cc6-4424-b486-6bac2f87565d`, но снова дал `other`. Это показало, что стековое имя функции ненадёжно как последний разделитель.

Поэтому запущен последний, более прямой разрез — по имени фактического target из локальных переменных `atomic_write`, без печати путей: `.ncm25-origin.json` (stable owner), `installed.json` либо другой target. Триггер commit `d22be72096d799aeef5143eb98d83c172b653eaf`, CircleCI workflow `7bd6cc8b-2755-42c2-9291-7cb6aef6ccf7`; три Windows jobs (`stable-owner-target`, `installed-target`, `other-target`) на момент передачи pending. Триггер сразу разоружён текущим head `79f19612f99480c1ef5d88bdb836c695669e6b72`.

Следующий шаг: прочитать статусы commit `d22be720...`. FAILURE означает точное совпадение target. После этого диагностику больше не расширять: исправить первопричину именно этой операции, собрать candidate и сделать один native Windows happy-path. При PASS сразу recovery/restart и полный relevant Windows suite. Затем перейти к реальному Codex CLI: несколько tool-вызовов, локальное действие, tool result, продолжение модели; дальше полный tool matrix, restart/crash и длинный прогон.

Не объявлять NOTION_CORE_DONE только по NCM28. Не печатать секреты/пути восстановленного runtime. Production ради теста не трогать.
