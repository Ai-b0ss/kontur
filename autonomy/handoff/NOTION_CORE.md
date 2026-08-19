# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `340f2b38c8dc01d59092b83bdd7001f9cce1ddfe`.

## Что установлено по NCM28

Первопричина низкоуровневого Windows-сбоя найдена и v23 её реально исправляет: существующие directory namespace handles открывались через `CreateFileW`, а затем использовались как `OBJECT_ATTRIBUTES.RootDirectory` в `NtCreateFile`. v23 переводит эти guard/anchor directory handles на native `NtCreateFile` и сохраняет прежние ограничения namespace/share/reparse.

После этого линия ушла выше примитива. На commit `b5b7ce66672ac6bd050507d04f58ad5d4e909f78` CircleCI workflow `b5663daa-939a-43d5-8561-caf6267af46d` дал:
- `ncm28-happy-running` — SUCCESS;
- `ncm28-happy-stopped` — SUCCESS;
- `ncm28-rerun-noop` — SUCCESS;
- `ncm28-auth-rollback` — FAILURE.

Это важный рубеж: обычный integrated upgrade на Windows уже проходит и при запущенном, и при остановленном старом bridge; повторный запуск после успеха также точный noop. Остался не основной write-path, а конкретно аварийный rollback при провале проверки auth.

Чтобы не гадать по одному красному unittest, на ветке добавлен `tools/circleci_ncm28_auth_rollback_diag.py`. Он воспроизводит ровно `test_auth_verify_failure_rolls_back_every_layer` и печатает только безопасную структурную сводку: итоговую классификацию, состояние rollback, восстановлен ли исходный snapshot и остались ли auth/migration/runtime деревья. Никаких секретов/путей credential он не печатает.

CircleCI временно сужен до одного Windows job `ncm28-auth-rollback-diag`; head `340f2b38c8dc01d59092b83bdd7001f9cce1ddfe`. На момент записи status ещё не появился. Дубликат не запускать.

## Что делать следующим

1. Снять результат `ncm28-auth-rollback-diag` на head `340f2b38...`.
2. По его структурной сводке исправить ровно аварийный auth rollback. Не трогать уже зелёный happy-path и не возвращаться к access-bit/RootDirectory археологии.
3. После исправления вернуть четыре integrated cases. Если все PASS — сразу прогнать `tests.test_crash_recovery` и затем полный `RUN_NCM28_LOCAL_VERIFY.py` на Windows.
4. После устойчивого Windows PASS прекратить NCM28-цикл и перейти к пользовательской цели: Codex CLI → несколько последовательных tool-вызовов → реальное локальное действие → tool result → продолжение модели → restart/failover.
5. Агентная ветка PR #8 может отдельно доводить prompt-mode/slot routing, но не должна менять Windows filesystem-файлы этой ветки.

Production и живой Notion не трогались; секреты не раскрывались.
