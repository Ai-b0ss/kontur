# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `75d5127c6da0a45f7a1a9d1fe2d78620c067ed34`.

## NCM28

Основной Windows happy-path был доказан на v23: `happy-running`, `happy-stopped` и `rerun-noop` проходили; оставался только `auth-rollback`.

Фактический результат v25 на commit `30a75728...` снят через GitHub status: все четыре integrated Windows cases стали красными. Это не повод снова менять native write-path. Проверка истории показала, что v25 наследовал v24, а v24 добавил недоказанное изменение `AuthLifecycle.is_running()` поверх уже зелёного v23. Поэтому v25 одновременно тащил новый rollback-fix и отдельную непроверенную auth-lifecycle гипотезу; именно после этого исчезли все три ранее зелёных happy-path.

Commit `75d5127c...` изолирует rollback-fix на последнем доказанном v23 baseline: `build_ncm28_windows_fixed_candidate_v25.py` теперь строится от v23 и НЕ включает v24. Native Windows write-path не менялся. Сам fix остаётся узким: при same-process `AUTH_ACTIVATION_FAILED` после успешной публикации outer journal повторный crash-intent scan под всё ещё удерживаемым coordinator lock не запускается; вместо этого точные канонические bytes журнала заново проверяются fail-closed и rollback продолжается. Обычный crash/restart всё ещё идёт через `_load_outer_journal`.

CircleCI workflow на exact head `75d5127c...`: `e3ca28ce-cb70-4312-8609-4ca4bce5db1e`. Четыре jobs уже появились и на момент передачи выполняются:
- `happy-running` job `97823bbe-762e-4aca-930a-730e8cc01c62`
- `happy-stopped` job `0f780ff8-8c2b-413a-9ba3-55d7c1938392`
- `rerun-noop` job `5901eca8-2c6c-4456-a09e-627da67d21fd`
- `auth-rollback` job `5da88615-af82-49b5-9e64-86706e966d41`

Следующая смена сначала снимает эти четыре результата, НЕ запускает дубль. Если все четыре зелёные — сразу Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`, после PASS закрыть NCM28 и больше не расширять файловую диагностику. Если три happy-path вернулись в green, а rollback красный — работать только с outer/auth rollback. Если happy-path всё ещё красные — сравнивать именно v23→v25 isolated patch/harness, не возвращать v24 и не трогать native write primitive без нового доказательства.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий фактический head: `7d975caa811f5d729e5dcc864f922fa95cc54b3f`, `mergeable=true` относительно пока старого Core base.

Семь контрактов на материализованном продукте ранее уже доказаны зелёными (workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6`): prompt modes, private prompt identity, настоящий `server.py` Responses wiring, ранняя HTTP validation, account-pool parallelism, foreground routing и cooldown failover. `payload/server.py` реально вызывает `compose_responses_planner_prompt(...)`; owner prompt не переписывается и отделён от нейтрального runtime/tool слоя.

После закрытия NCM28 синхронизировать PR #8 со свежим Core и сразу перейти к настоящему двухслотовому Codex Responses tool-loop: две независимые foreground задачи на разных свободных легитимных слотах, sticky continuation после tool result на своём владельце, а при недоступности владельца — новый Notion thread с полной локальной историей на другом допустимом слоте. Затем реальный многошаговый локальный сценарий Codex CLI `tool call -> локальное действие -> tool result -> продолжение -> следующий tool` и recovery/restart.

Production и живой Notion в этой смене не трогались; секреты не раскрывались.
