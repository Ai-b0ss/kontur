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
При повторной проверке в этом запуске все пять задач всё ещё `pending`; второй такой прогон не запускать.

Пока Windows ждёт, уже подготовлен следующий более точный разрез на отдельной ветке:
- ветка `autonomy/ncm28-callcut-ready-20260820`;
- commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`;
- `tools/circleci_ncm28_rollback_call_cut.py` различает `sanitized_active`, `sha_file`, pending/recovery/validation/_path_lexists, прямой `_strict_tree_listing` отдельно для auth/isolated-Codex/migration/runtime и `tree_digest` для тех же корней.
Это не продуктовый фикс. Если текущий digest-разрез покажет `outside-digest`, перенести этот файл на свежий Core head и сделать один следующий разрез, а не новую серию гипотез.

После установления одного точного вызова: исправить только его, затем снова `build + happy-running + happy-stopped + rerun-noop + auth-rollback`. При пяти зелёных сразу выполнить на Windows `python -B -m unittest -v tests.test_crash_recovery` и полный `python -B RUN_NCM28_LOCAL_VERIFY.py`. Только после этого NCM28 закрыт.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head: `4c151c6ea4925ca8f04771c773aeeb1443785a9a`.
Текущий Agent CircleCI workflow: `7b7fa638-b994-49e6-8799-42e898b9c3b9`; пять задач (`agent`, `prompt`, `routing`, `delegation`, `server-wiring-rehearsal`) на момент передачи `pending`.

Что уже есть в ветке:
- `payload/server_subagent_runtime.py` собирает provider-ready Notion child-agent поверх обычного account pool, использует существующие foreground reservations и только текущую runtime-tool границу;
- `payload/server_subagent_lifecycle.py` умеет bind/rebind/unbind текущего пула, ждёт завершения уже начатых детей перед закрытием старого пула и оставляет дочерние вызовы выключенными через динамический gate;
- `tests/test_notion_tool_subagent_runtime.py` проверяет rebase A→B без повторения локального side effect, существующие reservations, выключенный gate и bind/rebind/unbind lifecycle;
- настоящий `tools/run_real_codex_cli_project_probe.py` требует реальный `codex exec`: первый verifier создаёт неизвестный заранее `challenge.txt` и падает; Codex должен прочитать новую информацию, исправить результат и сам повторить verifier до `VERIFY_OK`;
- `tools/live_two_slot_codex_project_probe.py` дополнительно требует две независимые реальные задачи на разных account/thread владельцах и проверяет раздельность обоих проектов.

Что сделано в этом запуске по агентному продукту:
- найден реальный пробел в `SERVER_DELEGATED_TOOLS`: дочернему Notion-моделю показывались только имена инструментов и описания, но не точные аргументы. Для `list_files/read_file/write_file/edit_file/run_shell` добавлены реальные JSON-схемы, совпадающие с уже существующим `planner_tool`/runtime MCP контрактом (`directory`, `file_path`, `content`, `old_text`, `new_text`, `replace_all`, `command`, `cwd`, `timeout_ms`);
- добавлен `tests/test_server_subagent_tool_catalog.py`, который фиксирует набор инструментов, обязательные аргументы, запрет неизвестных полей и наличие реальных runtime-имён в каталоге, который увидит модель;
- найден второй продуктовый дефект: `call_runtime_tool()` может успешно вернуть MCP-ответ с `isError=true`, а дочерний runtime раньше безусловно заворачивал его как `ok=true`. Из-за этого модель могла поверить, что неудачный edit/command выполнен, и не исправить действие;
- добавлен `_normalize_runtime_result(...)`: malformed MCP result теперь fail-closed, `isError=true` становится `ok=false` с сохранённым структурированным результатом для следующего модельного хода, обычный результат остаётся `ok=true`;
- тесты фиксируют отдельно MCP tool-level error, нормальный success и битый runtime-result;
- `.circleci/config.yml` обновлён так, чтобы новый тест входил в `agent-contracts`, `delegation-contracts` и `server-wiring-rehearsal`.

Серверный lifecycle по-прежнему НЕ материализован в настоящий `payload/server.py`: `tools/apply_server_subagent_lifecycle_wiring.py` остаётся fail-closed материализатором и сначала должен пройти `server-wiring-rehearsal`. Проводка должна использовать один `ServerSubagentLifecycle`, тот же `account_pool`, `foreground_account_reservations.active_account_ids`, существующий `call_runtime_tool`; дети выключены по умолчанию, shutdown сначала делает `unbind_and_drain`, затем закрывает pool.

Следующий порядок:
1. снять результат Windows digest-разреза. Если он всё ещё инфраструктурно висит — не запускать дубликат; взять подготовленный call-cut только после появления точного `outside-digest` либо другого доказанного результата;
2. снять exact-head Agent CI `7b7fa638-b994-49e6-8799-42e898b9c3b9`; если красный — чинить только конкретный текущий агентный слой;
3. если `server-wiring-rehearsal` зелёный — применить материализатор к настоящему `payload/server.py` и повторить обычные Agent contracts;
4. затем один настоящий `tools/run_real_codex_cli_project_probe.py` и один настоящий two-slot project run в уже авторизованной среде;
5. после этого restart/recovery незавершённой цепочки и реальный failover: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального tool side effect;
6. только после крепкого Notion/Codex ядра углублять субагентов и подключать Qwen через тот же provider-neutral dispatcher.

Production и живой Notion в этом запуске не трогались; provider traffic не запускался; секреты не печатались.
