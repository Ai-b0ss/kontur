# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head на начало этой смены: `30a75728ec3f2213793e0718dc6d6dfbe0dd344b`.

## NCM28

Основной Windows happy-path уже был доказан на v23: `happy-running`, `happy-stopped` и `rerun-noop` проходили; оставался только `auth-rollback`.

После неудачной серии диагностических изменений ветка вернулась к доказанному native `NtCreateFile` пути. Затем Core продвинулся до v25. Текущий v25 не трогает основной native write-path: он исправляет только same-process auth rollback. После уже успешно опубликованного outer journal он не запускает повторный crash-intent scan под всё ещё удерживаемым coordinator lock, а перед откатом заново побайтово доказывает канонический journal и fail-closed проверяет schema/phase. Crash/restart по-прежнему идёт через обычный `_load_outer_journal`.

Commit `30a75728...` переключил CircleCI обратно на четыре integrated Windows cases для v25. В этой среде прямого CircleCI status API нет, поэтому точный итог этих четырёх jobs здесь не выдумывать: следующая смена сначала должна снять фактический результат текущего v25, а не запускать ещё одну диагностику.

Если все четыре зелёные: сразу Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; после PASS NCM28 закрыть и больше не расширять файловую диагностику.
Если три happy-path зелёные, а auth rollback красный: работать только с outer/auth rollback, не менять доказанный native write-path.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
На начало смены фактический head был `f7149018367b5c4bfbfcee078cb4514737e6ccae`, а не старый head из карты. Ветка уже содержит `prompt_modes.py`, lease-level тесты двух слотов, cooldown/failover и доказанный скрипт `tools/apply_prompt_mode_wiring.py`, но `payload/server.py` ещё не содержал материализованный Responses wiring.

Во время попытки материализовать wiring через GitHub contents API `payload/server.py` был ошибочно заменён заглушкой на commit `156026241809496f73ab71ab75aee5f2a7cfd31f`. Это не продуктовый результат и его нельзя сохранять. Сразу после обнаружения добавлен одноразовый CircleCI recovery на head `91ee2417056a1682ddc7186f32fa1b8eedb9c417`: job должен взять точный доказанный `payload/server.py` из `f7149018...`, применить уже существующий fail-closed `tools/apply_prompt_mode_wiring.py`, проверить `py_compile`, закоммитить восстановленный+материализованный server обратно в ту же агентную ветку. Следующая смена ОБЯЗАНА первым делом проверить, появился ли новый head после этого recovery. Если push не состоялся, сначала восстановить `payload/server.py` из `f7149018...`; не продолжать агентную разработку на заглушке.

После восстановления server вернуть обычный CircleCI contract suite и прогнать на exact materialized source: prompt modes, policy identity, server wiring, HTTP contract, account-pool parallelism, foreground routing, cooldown failover. Затем синхронизировать PR #8 со свежим Core и перейти к настоящему двухслотовому Codex Responses tool-loop: две независимые foreground задачи на разных свободных слотах, sticky continuation после tool result, а при недоступности владельца — новый Notion thread с полной локальной историей на другом легитимном слоте.

Production и живой Notion не трогались; секреты не раскрывались.
