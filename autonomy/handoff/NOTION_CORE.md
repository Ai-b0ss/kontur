# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `0d3340a1e48a26f9e5148039978bf7e720cd2d69`.

## Что установлено по NCM28

Проблема уже сведена к низкоуровневой работе с direct-child внутри удерживаемого `DirectoryGuard`; auth/migration/`installed.json`/`.ncm25-origin.json`, durable-backup и rename сейчас не являются рабочими гипотезами.

v22 завершился красным на обоих коротких Windows-тестах:
- `ncm28-dir` — FAILURE;
- `ncm28-create` — FAILURE;
workflow `158de8b0-5f5b-409b-bfe1-00aa2807aaec`.

То есть добавления `FILE_ADD_FILE`, `FILE_ADD_SUBDIRECTORY` и `FILE_TRAVERSE` недостаточно: сбой происходит уже при создании дочернего каталога через `RootDirectory`, до полного `atomic_write_from_snapshot`.

В исходнике найден более фундаментальный разрыв контракта. Существующие guard/anchor каталоги открывались через `CreateFileW`, а затем этот handle передавался в `NtCreateFile` как `OBJECT_ATTRIBUTES.RootDirectory`. Документированный native-контракт `NtCreateFile` описывает `RootDirectory` как directory handle, полученный предыдущим `NtCreateFile`. Поэтому сделан v23: `tools/build_ncm28_windows_fixed_candidate_v23.py`.

v23 не добавляет новые права наугад. Он переводит существующие directory namespace handles, которые затем служат корнем относительных native-операций, на абсолютный `NtCreateFile` с теми же safety-свойствами: `FILE_OPEN_REPARSE_POINT`, отсутствие `FILE_SHARE_DELETE`, проверка directory/reparse и прежние права. Созданные дочерние каталоги и раньше открывались через `NtCreateFile`.

CircleCI на head `0d3340a1e48a26f9e5148039978bf7e720cd2d69` запущен только для двух коротких native Windows проверок v23:
- `ncm28-dir` job `341fcaa3-e9d4-4885-b83a-c2ae9a535244`;
- `ncm28-create` job `a072c134-767e-49f6-b3b4-a7573354aa18`;
workflow `fc02c352-86a9-41ee-adb5-030fb3aa3112`.
На момент записи оба ещё выполняются.

## Что делать следующим

1. Сначала снять итог ровно этих двух v23 jobs; не запускать дубликаты.
2. Если оба PASS — сразу вернуть `rename` + `atomic`, затем integrated happy-path. Не продолжать низкоуровневую археологию.
3. После первого integrated Windows PASS — recovery/restart и полный relevant Windows suite.
4. Если v23 всё ещё FAIL — не добавлять очередной access bit. Зафиксировать конкретный NTSTATUS/winerror существующего `NtCreateFile` и исправлять именно его контракт/flags; права v21/v22 уже проверены и не помогли.
5. После устойчивого Windows PASS прекратить NCM28-цикл и перейти к пользовательской цели: Codex CLI → несколько последовательных tool-вызовов → реальное локальное действие → tool result → продолжение модели → restart/failover.

Production и живой Notion не трогались; секреты не раскрывались.
