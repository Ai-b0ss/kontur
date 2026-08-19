# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `d92ce7e1f2fc1edf12ddb779803f01a09bd8f560`.

NCM28 ещё не закрыт. Старый native Windows-разрез `fa4d9d00-d92c-45b9-a280-3e1c1da4ea2b` завершён: `outer-update`, `write-backups`, `stable-owner`, `run-upgrade` дали SUCCESS, а `other` — FAILURE. В этой диагностике FAILURE означает «искомый callsite совпал».

Важная найденная ошибка самой диагностики: `atomic_json()` является прозрачной обёрткой над `atomic_write()`. Старый классификатор смотрел только на непосредственный frame перед `atomic_write`, поэтому любой guarded JSON-write ошибочно попадал в `other`, а настоящий владелец операции терялся. Это объясняет, почему предыдущий разрез не смог назвать функцию, хотя уже доказал `integrated_upgrade.py + parent_guard`.

Исправлен только диагностический классификатор: если непосредственный caller — `atomic_json`, он поднимается ещё на один frame и называет реального владельца (`_write_stable_owner_in_guard`, `_outer_update`, `_run_upgrade_locked` и т.д.). Commit диагностики `8600ca911ef19437a95345acf524c12211f49259`; одноразовый триггер `e19548427e820bd5c6ee0984b5bc5b8f907531a0`; CircleCI workflow `884a4f19-9cc6-4424-b486-6bac2f87565d`. На момент передачи пять native Windows jobs ещё pending. Триггер сразу разоружён текущим head `d92ce7e1f2fc1edf12ddb779803f01a09bd8f560`, поэтому следующие push не создадут новый fan-out.

Следующий шаг: прочитать статусы commit `e195484...`. Единственный FAILURE теперь должен назвать настоящий guarded JSON-write owner. После этого не добавлять новую диагностику: исправить первопричину в операции, собрать candidate и сделать один native Windows happy-path. При PASS сразу recovery/restart и полный relevant Windows suite. Затем без паузы перейти к реальному Codex CLI: несколько tool-вызовов, локальное действие, tool result, продолжение модели; дальше полный tool matrix, restart/crash и длинный прогон.

Не объявлять NOTION_CORE_DONE только по NCM28. Не печатать секреты/пути восстановленного runtime. Production ради теста не трогать.
