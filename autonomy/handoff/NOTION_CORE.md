# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `510a03203a76fe33551c29a4933f1518f6c786de`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23. Низкоуровневый Windows write primitive v23 без нового точного доказательства не менять.

На head `b094aa874fd14d56734df6d37f4b7808882a1c89` уже доказано на настоящем Windows:
- `ncm28-windows-build-v25` — SUCCESS;
- `happy-running` — SUCCESS;
- `happy-stopped` — SUCCESS;
- `rerun-noop` — SUCCESS;
- `auth-rollback` — FAILURE.

В предыдущем запуске был добавлен разрез rollback на `84fcd1e5...`, но при ревью v25 найден более конкретный дефект самой проводки same-process rollback. v23 специально протягивает `managed_guard` через операции outer journal/backup/finish, чтобы Windows не переоткрывал удерживаемый `.notionagents` namespace по pathname. v25 добавил `known_canonical_journal`, но в единственном exception-call `_recover_outer_transaction(...)` не передал уже существующий `managed_guard`. В результате именно аварийный rollback терял доказанный Windows-контракт, тогда как три обычных пути оставались зелёными.

Исправление на head `510a03203a76fe33551c29a4933f1518f6c786de`:
- same-process вызов теперь передаёт `managed_guard=managed_guard`;
- повторная проверка exact canonical outer journal тоже использует `parent_guard=managed_guard`, а не переоткрывает файл через pathname;
- native Windows write primitive v23 не менялся;
- обычный crash/restart путь не менялся.

CircleCI должен автоматически проверить новый head. Второй ручной прогон не создавать, пока не снят автоматический результат.

Следующий шаг:
1. снять `ncm28-windows-build-v25`, `happy-running`, `happy-stopped`, `rerun-noop`, `auth-rollback` на exact head `510a0320...`;
2. если все пять зелёные — удалить временные `ncm28-auth-stage-*` jobs из `.circleci/config.yml` и прогнать Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`;
3. при их PASS считать NCM28 закрытым и больше не расширять диагностику;
4. если `auth-rollback` всё ещё красный — использовать уже существующие четыре stage-job, но не менять файловый примитив без нового точного сигнала.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head на момент этого запуска: `51a575693e438be1fb69fac0824b03a573db286e` (старый handoff отставал).

В ветке уже есть настоящий `tools/live_codex_project_probe.py`: временный проект с неизвестным заранее токеном, реальные `read_file`, `write_file`, `bash`, обязательный `python verify.py` и запрет завершаться до успешной локальной проверки. После закрытия NCM28 не добавлять новые синтетические probes.

Порядок после NCM28:
1. настоящий Codex project tool-loop в уже авторизованной среде;
2. restart/recovery незавершённой цепочки;
3. failover: sticky continuation остаётся на владельце thread, а при его недоступности допустимый другой слот получает новый Notion thread и полную локальную историю; старый thread ID между аккаунтами не переносится;
4. затем субагенты и реальное делегирование в Qwen.

Production и живой Notion в этом запуске не трогались; секреты не раскрывались.
