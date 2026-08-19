# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `8ba5072a8381dcbdc6dd38d63d0466370266cde8`.

## Что установлено по NCM28

Проблема уже сведена к низкоуровневой работе с direct-child внутри только что созданного и удерживаемого `DirectoryGuard`; auth/migration/`installed.json`/`.ncm25-origin.json` больше не являются рабочими гипотезами.

После предыдущего v21-разреза ветка успела продвинуться до `936547c88b4fc13f61280c84b64ddc5229b3558a`. На нём CircleCI workflow `4612d2a6-7012-493a-8b05-7e1c7142d137` дал два важных результата:
- `ncm28-dir` — FAILURE;
- `ncm28-create` — FAILURE.

Это сильнее прежнего вывода: сбой начинается уже на создании guarded child-directory/файла, то есть до rename и до полного `atomic_write_from_snapshot`. Поэтому дальше не надо исследовать durable-backup callsite или rename, пока базовая относительная namespace-операция не станет зелёной.

В v21 guarded directory handles уже получили `FILE_ADD_FILE` и `FILE_ADD_SUBDIRECTORY`, но у них всё ещё отсутствовал `FILE_TRAVERSE`. Для относительного разрешения имени через уже открытый directory handle Windows может требовать traverse-right ещё до самой create/rename операции. Сделан минимальный кандидат v22: `tools/build_ncm28_windows_fixed_candidate_v22.py`; он добавляет `FILE_TRAVERSE` только к тем directory handles, которые используются как корни относительных операций, не меняя share mode и остальную продуктовую логику.

CircleCI переключён только на два коротких native Windows теста v22: `dir` и `create`. Текущий head `8ba5072a8381dcbdc6dd38d63d0466370266cde8`. На момент handoff status contexts для него ещё не появились.

## Что делать следующим

1. Сначала прочитать статусы head `8ba5072a...`; не создавать новый разрез, пока v22 `dir/create` не завершились.
2. Если оба PASS — вернуть `rename` и `atomic`, затем integrated happy-path. Если `dir` PASS, а `create` FAIL — чинить только `create_file_new_relative`. Если `dir` снова FAIL — проблема ещё ниже: контракт `create_guarded_directory`/относительный `NtCreateFile` и права/flags самого parent handle; разбирать только этот примитив.
3. После первого integrated Windows PASS сразу recovery/restart + полный relevant Windows suite.
4. После устойчивого Windows PASS прекратить NCM28-археологию и перейти к реальной цели: Codex CLI, несколько последовательных tool-вызовов, локальное действие, tool result, продолжение модели, затем restart/failover.

Production и живой Notion не трогались; секреты не раскрывались.
