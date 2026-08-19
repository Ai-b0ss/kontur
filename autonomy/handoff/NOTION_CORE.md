# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

## NCM28

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive не менять без нового точного доказательства.

Что уже доказано настоящим Windows:
- на v25: `build`, `happy-running`, `happy-stopped`, `rerun-noop` — SUCCESS; `auth-rollback` — FAILURE;
- внутри rollback возврат управляемых файлов и сохранность non-targets — SUCCESS; auth и stable — FAILURE;
- v32 собрался и не регрессировал основной путь: workflow `08837cc8-0149-465a-90a3-61ddc953bd43`, build + три обычных сценария SUCCESS, `auth-rollback` FAILURE;
- ошибки обоих аварийных подэтапов — именно `PermissionError`;
- Windows-разрез `f81e9dbf-5779-460a-9b55-2c4968cf5562` доказал, что `PermissionError` возникает НЕ внутри `remove_plain_tree`;
- обычные чтения сами по себе не воспроизводят ошибку только от удержания внешнего `.notionagents` guard. Ошибка зависит от реального состояния после провала auth.

Сейчас уже запущен настоящий Windows-разрез без изменения продукта:
- exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- проверки auth/codex/migration/runtime `tree_digest` и `outside-digest` во время реального падающего rollback.
На 2026-08-20 00:10 МСК все пять задач всё ещё `pending`; второй такой прогон не запускать.

Пока Windows ждал, подготовлен следующий более точный разрез на отдельной ветке, чтобы не размножать текущие CI-задачи:
- ветка `autonomy/ncm28-callcut-ready-20260820`;
- commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`;
- `tools/circleci_ncm28_rollback_call_cut.py` теперь различает не только `sanitized_active`, `sha_file`, pending/recovery/validation/_path_lexists, но и прямой `_strict_tree_listing` отдельно для auth, isolated Codex, migration и runtime, а также `tree_digest` для тех же корней.
Это не продуктовый фикс и не запускать вслепую. Если текущий digest-разрез покажет `outside-digest`, этот подготовленный файл надо перенести на свежий Core head и включить одним следующим диагностическим прогоном.

После установления одного точного вызова: исправить только его, затем снова `build + happy-running + happy-stopped + rerun-noop + auth-rollback`. При пяти зелёных сразу выполнить на Windows `python -B -m unittest -v tests.test_crash_recovery` и полный `python -B RUN_NCM28_LOCAL_VERIFY.py`. Только после этого NCM28 закрыт.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head при этой проверке: `8663366faeef3fcce3323ef74feea003523ccc56` (старые head из предыдущих передач устарели).
Текущий Agent workflow: `04641a6d-fef5-474a-90f6-97afd3f1bed0`; prompt/agent/routing/delegation на момент проверки ещё `pending`.

Что уже материализовано в ветке:
- `payload/server_subagent_runtime.py` собирает provider-ready Notion child-agent поверх обычного account pool, использует существующие foreground reservations и только текущую runtime-tool границу;
- `payload/server_subagent_lifecycle.py` уже умеет безопасно bind/rebind/unbind текущего пула, не хранит отдельную provider affinity и оставляет дочерние вызовы выключенными через динамический gate;
- `tests/test_notion_tool_subagent_runtime.py` проверяет rebase A→B без повторения локального side effect, существующие reservations, выключенный gate и bind/rebind/unbind lifecycle;
- настоящий `run_real_codex_cli_project_probe.py` требует реальный `codex exec`: первый verifier создаёт неизвестный заранее `challenge.txt` и падает; Codex должен прочитать новую информацию, исправить результат и сам повторить verifier до `VERIFY_OK`.

Важный свежий факт: lifecycle пока ещё НЕ подключён в `payload/server.py` startup/shutdown. В PR patch сервер меняет prompt wiring, но не bind/unbind `ServerSubagentLifecycle`. После NCM28 это ближайший продуктовый шаг перед live Codex: привязать lifecycle к уже созданному `account_pool`, `foreground_account_reservations.active_account_ids` и `call_runtime_tool`, запуск детей оставить выключенным по умолчанию.

После NCM28 порядок:
1. снять exact-head Agent CI; если красный — исправить только текущий агентный слой;
2. подключить существующий `ServerSubagentLifecycle` к реальному server startup/shutdown без второго реестра слотов;
3. один настоящий `run_real_codex_cli_project_probe.py` в уже авторизованной среде;
4. restart/recovery незавершённой цепочки;
5. реальный failover: продолжение остаётся на владельце Notion thread, а при недоступности владельца другой легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального действия;
6. затем углублять реальные субагенты и делегирование в Qwen.

Production и живой Notion в этой смене не трогались; секреты не печатались.
