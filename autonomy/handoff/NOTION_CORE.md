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
При последней проверке все пять задач всё ещё `pending`; второй такой прогон не запускать.

Пока Windows ждёт, уже подготовлен следующий более точный разрез на отдельной ветке:
- ветка `autonomy/ncm28-callcut-ready-20260820`;
- commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`;
- `tools/circleci_ncm28_rollback_call_cut.py` различает `sanitized_active`, `sha_file`, pending/recovery/validation/_path_lexists, прямой `_strict_tree_listing` отдельно для auth/isolated-Codex/migration/runtime и `tree_digest` для тех же корней.
Это не продуктовый фикс. Если текущий digest-разрез покажет `outside-digest`, перенести этот файл на свежий Core head и сделать один следующий разрез, а не новую серию гипотез.

После установления одного точного вызова: исправить только его, затем снова `build + happy-running + happy-stopped + rerun-noop + auth-rollback`. При пяти зелёных сразу выполнить на Windows `python -B -m unittest -v tests.test_crash_recovery` и полный `python -B RUN_NCM28_LOCAL_VERIFY.py`. Только после этого NCM28 закрыт.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head: `396ce55c2587c85b5240309366efea1c7b8da33a`.
Текущий Agent CircleCI workflow: `6f8587da-ced4-4737-ba52-c13ee30973b2`; prompt/agent/routing/delegation при последней проверке `pending`.

Что уже материализовано в ветке:
- `payload/server_subagent_runtime.py` собирает provider-ready Notion child-agent поверх обычного account pool, использует существующие foreground reservations и только текущую runtime-tool границу;
- `payload/server_subagent_lifecycle.py` умеет bind/rebind/unbind текущего пула, ждёт завершения уже начатых детей перед закрытием старого пула и оставляет дочерние вызовы выключенными через динамический gate;
- `tests/test_notion_tool_subagent_runtime.py` проверяет rebase A→B без повторения локального side effect, существующие reservations, выключенный gate и bind/rebind/unbind lifecycle;
- настоящий `tools/run_real_codex_cli_project_probe.py` требует реальный `codex exec`: первый verifier создаёт неизвестный заранее `challenge.txt` и падает; Codex должен прочитать новую информацию, исправить результат и сам повторить verifier до `VERIFY_OK`.

Что сделано в этой смене по серверному lifecycle:
- добавлен `tools/apply_server_subagent_lifecycle_wiring.py`, commit `3d2e9bc84285a3d519b210a960a0afbfe7f75173`;
- добавлен fail-closed тест `tests/test_server_subagent_wiring_materializer.py`, commit `54b716b34d4b01d0926f730df5eeac21051595f0`;
- CircleCI теперь включает этот контракт в `agent-contracts` и `delegation-contracts`, итоговый head `396ce55c2587c85b5240309366efea1c7b8da33a`.

Материализатор уже фиксирует точную проводку, которую надо внести в `payload/server.py` после освобождения агентного CI/доступного исполнителя:
- один `ServerSubagentLifecycle` на сервер;
- тот же `account_pool`, без второго пула;
- `reserved_account_ids=foreground_account_reservations.active_account_ids`, без второго реестра занятости;
- локальные действия через существующий `call_runtime_tool`;
- дети выключены по умолчанию, включение только через `NOTION_SUBAGENTS_ENABLED`;
- startup bind без provider traffic;
- shutdown сначала `unbind_and_drain`, затем закрытие `account_pool`, чтобы не закрыть provider pool под уже работающим child-agent.

Важно: `payload/server.py` на этом head ещё НЕ изменён этим материализатором. Не считать lifecycle подключённым, пока скрипт не применён к настоящему файлу и соответствующие тесты не зелёные. Никаких скрытых импорт-сайд-эффектов ради обхода этого шага не добавлять.

После NCM28 порядок:
1. снять exact-head Agent CI; если красный — исправить только текущий агентный слой;
2. применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py`, проверить startup/shutdown и существующие контракты;
3. один настоящий `tools/run_real_codex_cli_project_probe.py` в уже авторизованной среде;
4. restart/recovery незавершённой цепочки;
5. реальный failover: продолжение остаётся на владельце Notion thread, а при недоступности владельца другой легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального действия;
6. затем углублять реальные субагенты и делегирование в Qwen.

Production и живой Notion в этой смене не трогались; секреты не печатались.
