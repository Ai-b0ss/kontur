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

Полезная статическая находка этой смены: после materialize v25 существуют две текстовые реализации `_rollback_committed_first_auth`; v23 намеренно добавляет более строгую позднюю реализацию. Не строить следующие patch-builder на предположении, что определение одно.

Также проверено: обычные чтения `sanitized_active`, config SHA, tree digest auth/migration/runtime и pending-check сами по себе не воспроизводят `PermissionError` только от факта удержания внешнего `.notionagents` guard. Значит ошибка зависит от реального состояния после провала auth, а не просто от наличия guard.

Сейчас уже запущен следующий настоящий Windows-разрез без изменения продукта:
- exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- проверки: auth/codex/migration/runtime `tree_digest` и `outside-digest` во время реального падающего rollback.
На момент передачи все пять задач ещё `pending`; второй такой прогон не запускать.

Если `outside-digest` станет SUCCESS, следующий готовый диагностический инструмент уже лежит в ветке: `tools/circleci_ncm28_rollback_call_cut.py`. Он различает реальный `PermissionError` в `sanitized_active`, `sha_file`, `ncm28_pending_atomic_write`, `recover_migration`, `_validate_owned_migration_tree`, `_validate_owned_partial_runtime`, `_path_lexists` и вне этих вызовов. Перед включением обязательно перечитать свежий head/config: параллельный рабочий процесс тоже двигает эту ветку, и слепо перетирать `.circleci/config.yml` нельзя.

После установления одного точного вызова: исправить только его, затем снова `build + happy-running + happy-stopped + rerun-noop + auth-rollback`. При пяти зелёных сразу выполнить на Windows `python -B -m unittest -v tests.test_crash_recovery` и полный `python -B RUN_NCM28_LOCAL_VERIFY.py`. Только после этого NCM28 закрыт.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head на момент передачи: `07798da1078fb34fc41d9e344b1f1ef92e3e5ec7`.

На этом exact head все четыре постоянных CircleCI-набора зелёные, workflow `4d35bdd6-420a-42fe-a2dc-bf3b19edbfbe`: prompt, agent, routing, delegation.

Агентная линия уже заметно дальше старого handoff: кроме двух режимов промпта и sticky/cooldown routing, там есть provider-neutral delegation, stateful child-session, безопасный A→B rebase на новый Notion thread и provider-ready Notion subagent runtime; последние delegated-контракты тоже включены в зелёный CI.

Настоящий CLI-гейт `tools/run_real_codex_cli_project_probe.py` в этой смене усилен: он запускает именно `codex exec` через Responses bridge; первый `python verify.py` намеренно создаёт неизвестный заранее `challenge.txt` и падает. Для PASS Codex обязан получить неудачный tool result, прочитать новую информацию, исправить `result.txt`, повторно запустить verifier и закончить только после `VERIFY_OK`. Офлайн-контракт этого поведения входит в зелёный `agent-contracts`.

После NCM28 порядок:
1. один настоящий `run_real_codex_cli_project_probe.py` в уже авторизованной среде;
2. restart/recovery незавершённой цепочки;
3. реальный failover: нормальное продолжение остаётся на владельце Notion thread; при недоступности владельца другой легитимный слот получает НОВЫЙ Notion thread и полную локальную историю без повторения уже выполненного локального side effect;
4. затем уже углублять реальные субагенты и делегирование в Qwen.

Production и живой Notion в этой смене не трогались; секреты не печатались.
