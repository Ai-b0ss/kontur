# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `30a75728ec3f2213793e0718dc6d6dfbe0dd344b`.

## NCM28

Основной Windows happy-path уже доказан на v23: `happy-running`, `happy-stopped` и `rerun-noop` проходили; оставался только `auth-rollback`.

Core дошёл до v25. v25 не меняет доказанный native write-path: он исправляет same-process auth rollback. После уже успешно опубликованного outer journal он не запускает повторный crash-intent scan под всё ещё удерживаемым coordinator lock, а перед откатом заново побайтово доказывает канонический journal и fail-closed проверяет schema/phase. Crash/restart по-прежнему использует обычный `_load_outer_journal`.

Commit `30a75728...` переключил CircleCI на четыре integrated Windows cases v25. Прямого CircleCI status API в этой среде нет, поэтому итог не выдумывать и не запускать дубликат. Следующая смена сначала снимает фактические результаты текущего v25.

Если все четыре зелёные: сразу Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; после PASS NCM28 закрыть и больше не расширять файловую диагностику. Если три happy-path зелёные, а auth rollback красный: работать только с outer/auth rollback, не менять native write-path.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Текущий head после этой смены: `bc64e60f3c26d4773c1565cd565798b00386a535`.

На начало смены фактический head был `f7149018367b5c4bfbfcee078cb4514737e6ccae`. Ветка уже содержала `prompt_modes.py`, lease-level тесты двух слотов, cooldown/failover и доказанный `tools/apply_prompt_mode_wiring.py`, но `payload/server.py` ещё не содержал материализованный Responses wiring.

При первой попытке через GitHub contents API `payload/server.py` был по ошибке заменён заглушкой (`1560262418...`). Ошибка полностью исправлена в этой же смене: одноразовый CircleCI job взял точный доказанный server из `f7149018...`, применил существующий fail-closed wiring, проверил компиляцию и сам запушил восстановленный материализованный файл. Результат — commit `f2339c262f71151d90e305b5ad0ea6fce704895d`; в нём server снова полный (2834 строки добавлены вместо однострочной заглушки) и содержит материализованный prompt-mode wiring.

После восстановления одноразовый recovery workflow удалён. На head `bc64e60f...` возвращён обычный CircleCI contract suite уже БЕЗ временного `apply_wiring`: он теперь проверяет именно сохранённый в ветке продуктовый `payload/server.py`. Запущены семь независимых контрактов: prompt modes, policy identity, server wiring, HTTP contract, account-pool parallelism, foreground routing, cooldown failover. Следующая смена сначала снимает их фактический итог; если есть красный — чинит конкретный контракт, а не возвращает временную материализацию.

После зелёного contract suite синхронизировать PR #8 со свежим Core и перейти к настоящему двухслотовому Codex Responses tool-loop: две независимые foreground задачи на разных свободных слотах, sticky continuation после tool result, а при недоступности владельца — новый Notion thread с полной локальной историей на другом легитимном слоте.

Production и живой Notion не трогались; секреты не раскрывались.
