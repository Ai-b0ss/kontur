# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

## NCM28

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive не менять без нового точного доказательства.

Что уже доказано настоящим Windows:
- на v25: `build`, `happy-running`, `happy-stopped`, `rerun-noop` — SUCCESS; `auth-rollback` — FAILURE;
- внутри rollback: возврат управляемых файлов и сохранность non-targets — SUCCESS; auth и stable — FAILURE;
- v32 собрался и не регрессировал основной путь: workflow `08837cc8-0149-465a-90a3-61ddc953bd43`, build + три обычных сценария SUCCESS, `auth-rollback` FAILURE;
- ошибки обоих аварийных подэтапов — именно `PermissionError`;
- отдельный Windows-разрез `f81e9dbf-5779-460a-9b55-2c4968cf5562` доказал, что этот `PermissionError` возникает НЕ внутри `remove_plain_tree`: `permission-outside-remove` SUCCESS, а auth/codex/runtime/migration remove-маркеры не сработали;
- значит предыдущая гипотеза про повторное pathname-open при самом удалении была недостаточной. Низкоуровневый writer v23 и уже зелёные happy-path не трогать.

Полезная статическая находка: после materialize v25 существуют две текстовые реализации `_rollback_committed_first_auth`; v23 намеренно добавляет более строгую позднюю реализацию. Не строить следующие patch-builder на предположении, что определение одно.

Также проверено: обычные чтения `sanitized_active`, config SHA, tree digest auth/migration/runtime и pending-check сами по себе не воспроизводят `PermissionError` только от факта удержания внешнего `.notionagents` guard. Значит ошибка зависит от реального состояния после провала auth, а не просто от наличия guard.

Сейчас уже запущен следующий настоящий Windows-разрез без изменения продукта:
- exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- проверки: auth/codex/migration/runtime `tree_digest` и `outside-digest` во время реального падающего rollback.
На 2026-08-19 23:24 МСК все пять задач всё ещё `pending`; второй такой прогон не запускать.

Если `outside-digest` станет SUCCESS, следующий готовый диагностический инструмент уже лежит в ветке: `tools/circleci_ncm28_rollback_call_cut.py`. Он различает реальный `PermissionError` в `sanitized_active`, `sha_file`, `ncm28_pending_atomic_write`, `recover_migration`, `_validate_owned_migration_tree`, `_validate_owned_partial_runtime`, `_path_lexists` и вне этих вызовов. Перед включением обязательно перечитать свежий head/config: слепо перетирать `.circleci/config.yml` нельзя.

После установления одного точного вызова: исправить только его, затем снова `build + happy-running + happy-stopped + rerun-noop + auth-rollback`. При пяти зелёных сразу выполнить на Windows `python -B -m unittest -v tests.test_crash_recovery` и полный `python -B RUN_NCM28_LOCAL_VERIFY.py`. Только после этого NCM28 закрыт.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head на момент передачи: `484b9a6c8faf778d5df5a7f5d80500ea734f02af`.

Предыдущий exact head `07798da1078fb34fc41d9e344b1f1ef92e3e5ec7` полностью зелёный: workflow `4d35bdd6-420a-42fe-a2dc-bf3b19edbfbe`, все четыре набора prompt/agent/routing/delegation SUCCESS.

В этой смене добавлен следующий полезный слой без provider traffic: `payload/server_subagent_runtime.py`. Он собирает provider-ready Notion child-agent поверх уже существующего account pool, обязательно получает существующий `foreground_account_reservations.active_account_ids` как источник занятых слотов, использует только уже имеющуюся runtime-tool границу (`list_files/read_file/write_file/edit_file/run_shell`) и остаётся выключенным через явный `enabled_predicate`. Исключения локальных инструментов наружу не печатаются: модель получает стабильный `tool_execution_failed`.

Постоянный `tests.test_notion_tool_subagent_runtime` расширен проверкой этой серверной композиции: занятые родительские слоты передаются в `avoid_account_ids`, реальный tool result возвращается в child-loop, а выключенный gate не делает provider-вызовов. Текущий CircleCI workflow для head `484b9a6c...` — `07883e0d-36d3-48d0-addd-0b0d48d8d073`; четыре Agent job на момент передачи `pending`.

Настоящий CLI-гейт `tools/run_real_codex_cli_project_probe.py` уже запускает именно `codex exec` через Responses bridge; первый `python verify.py` намеренно создаёт неизвестный заранее `challenge.txt` и падает. Для PASS Codex обязан получить неудачный tool result, прочитать новую информацию, исправить `result.txt`, повторно запустить verifier и закончить только после `VERIFY_OK`.

После NCM28 порядок:
1. дождаться зелёного Agent CI на `484b9a6c...`; при красном исправить только новый server-subagent слой;
2. подключить `build_server_notion_subagents(...)` к реальному server startup/lifecycle, передав существующие `account_pool`, `foreground_account_reservations.active_account_ids` и `call_runtime_tool`; сам запуск детей оставить выключенным по умолчанию;
3. один настоящий `run_real_codex_cli_project_probe.py` в уже авторизованной среде;
4. restart/recovery незавершённой цепочки;
5. реальный failover: нормальное продолжение остаётся на владельце Notion thread; при недоступности владельца другой легитимный слот получает НОВЫЙ Notion thread и полную локальную историю без повторения уже выполненного локального side effect;
6. затем углублять реальные субагенты и делегирование в Qwen.

Production и живой Notion в этой смене не трогались; секреты не печатались.
