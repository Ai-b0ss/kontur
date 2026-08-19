# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `ca39048ad67cf8f1594a1194dbc9ae8ba90c09cd`.

## Что уже доказано по NCM28

Низкоуровневая Windows-причина основного happy-path исправлена в v23: directory namespace handles открываются native `NtCreateFile` и пригодны как `OBJECT_ATTRIBUTES.RootDirectory` для относительных операций.

На commit `b5b7ce66672ac6bd050507d04f58ad5d4e909f78` настоящий Windows-прогон доказал:
- `ncm28-happy-running` — SUCCESS;
- `ncm28-happy-stopped` — SUCCESS;
- `ncm28-rerun-noop` — SUCCESS;
- отдельный `ncm28-auth-rollback` — FAILURE.

Первый разрез аварийного rollback на head `f1cdfa3dcff16a3d9f28d5c614502c385a7b7221`, CircleCI workflow `bc4eece6-6bbb-4587-977b-af80d6f4b34f`, завершился так:
- `ncm28-auth-lifecycle-verdict` — SUCCESS;
- `ncm28-auth-snapshot-verdict` — FAILURE;
- `ncm28-auth-aux-verdict` — FAILURE;
- `ncm28-auth-rollback-verdict` — FAILURE.

Это означает: процесс в отдельном прогоне может вернуться в исходное состояние, но полный байтовый снимок управляемых файлов не восстановлен и служебные auth/stable деревья не убраны полностью. Поэтому менять уже зелёный native write-path нельзя; проблема теперь только в аварийном outer/auth rollback.

В текущем запуске старый широкий `snapshot/aux` разрез заменён на четыре точных компонента одного и того же сценария, без вывода путей/секретов:
- `ncm28-auth-aux-verdict` — исчезли ли `bridge-auth` и `codex-notion-cli`;
- `ncm28-stable-aux-verdict` — исчезли ли migration/runtime деревья;
- `ncm28-bridge-source-verdict` — восстановились ли исходные `server.py/account_pool.py/diagnostics.py`;
- `ncm28-installed-state-verdict` — восстановился ли исходный `installed.json`.

Новый CircleCI workflow: `9ac50faa-9f7b-43dd-aa17-6ce1274f5587` на head `ca39048ad67cf8f1594a1194dbc9ae8ba90c09cd`.
На момент передачи все четыре job ещё `pending`. Дубликат не запускать.

## Точка продолжения

1. Снять четыре статуса workflow `9ac50faa-9f7b-43dd-aa17-6ce1274f5587`.
2. По красному компоненту исправить конкретную операцию rollback. Не добавлять ещё один общий диагностический слой и не трогать v23 native happy-path.
3. После первого кандидата вернуть четыре integrated Windows cases: running, stopped, rerun-noop, auth-rollback.
4. При 4/4 PASS сразу прогнать `tests.test_crash_recovery` и полный `RUN_NCM28_LOCAL_VERIFY.py` на Windows.
5. После устойчивого Windows PASS прекратить NCM28-цикл и перейти к пользовательской цели: настоящий Codex CLI → несколько последовательных tool-вызовов → реальные локальные действия → tool result → продолжение модели → restart/failover.
6. PR #8 (`autonomy/notion-prompt-modes-20260819`) продвинут независимо и не должен менять Windows filesystem-файлы Core. Его ближайшая задача после Core — материализовать готовый prompt-mode wiring в реальный Responses путь и затем доказать двухслотовый многошаговый Codex loop.

Production и живой Notion не трогались; секреты не раскрывались.
