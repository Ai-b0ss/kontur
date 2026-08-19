# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `f1cdfa3dcff16a3d9f28d5c614502c385a7b7221`.

## Что установлено по NCM28

Низкоуровневая Windows-причина уже исправлена в v23: directory namespace handles теперь открываются native `NtCreateFile` и пригодны как `OBJECT_ATTRIBUTES.RootDirectory` для относительных операций. На commit `b5b7ce66672ac6bd050507d04f58ad5d4e909f78` настоящий Windows-прогон доказал:
- `ncm28-happy-running` — SUCCESS;
- `ncm28-happy-stopped` — SUCCESS;
- `ncm28-rerun-noop` — SUCCESS;
- только `ncm28-auth-rollback` — FAILURE.

Предыдущий единый диагностический job на `340f2b38...` тоже завершился FAILURE, но подключённый GitHub-интерфейс показывает только итог job и не даёт его stdout. Чтобы не гадать и не менять уже зелёный happy-path, диагностический сценарий не расширен по стеку, а разделён на четыре наблюдаемых булевых инварианта одного и того же точного теста: `rollback`, `snapshot`, `aux`, `lifecycle`. Это позволяет по именам CircleCI status определить, что именно не восстановилось, без логов и без вывода секретов/путей.

Текущий CircleCI workflow: `bc4eece6-6bbb-4587-977b-af80d6f4b34f` на head `f1cdfa3d...`.
На момент передачи все четыре job pending:
- `ncm28-auth-rollback-verdict`;
- `ncm28-auth-snapshot-verdict`;
- `ncm28-auth-aux-verdict`;
- `ncm28-auth-lifecycle-verdict`.
Дубликат не запускать.

## Что делать следующим

1. Снять четыре status с `f1cdfa3d...`. Красный context теперь и есть точный нарушенный инвариант.
2. Исправить только соответствующий аварийный auth rollback. Не трогать v23 native write-path, который уже доказан зелёным.
3. Вернуть четыре integrated Windows cases. При 4/4 PASS сразу прогнать `tests.test_crash_recovery` и полный `RUN_NCM28_LOCAL_VERIFY.py` на Windows.
4. После устойчивого Windows PASS прекратить NCM28-цикл и перейти к пользовательской цели: Codex CLI → несколько последовательных tool-вызовов → реальное локальное действие → tool result → продолжение модели → restart/failover.
5. PR #8 уже независимо продвинул prompt-mode/slot-routing и не должен менять Windows filesystem-файлы Core.

Production и живой Notion не трогались; секреты не раскрывались.
