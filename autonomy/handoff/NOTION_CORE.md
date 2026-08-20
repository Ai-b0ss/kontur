# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `2a3520cdaf8150f16d9bd8bd0b1b068fbd3db84f`.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Точный digest-разрез на Core всё ещё не получил executor:
- exact Core head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- на проверке этой смены все пять по-прежнему `pending`.

Дубликат не запускать. Продуктовый файловый слой пока не менять вслепую.

Если результат окажется `outside-digest`, уже подготовлен более точный call-cut на ветке `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`.

После нахождения одного точного вызова: минимальный фикс → `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → Windows `tests.test_crash_recovery` → полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрываем.

## Codex / Agent

В ветке уже есть:
- режимы `engineer/owner`;
- распределение foreground-слотов и sticky continuation;
- безопасный failover на новый account/thread с переносом локальной истории;
- provider-neutral delegation;
- Notion child-agent runtime/lifecycle поверх того же account pool;
- точные схемы локальных инструментов и fail-closed обработка MCP tool-result;
- настоящий проектный `codex exec` гейт и двухслотовые/failover варианты;
- server-wiring materializer, который пока ещё не внесён напрямую в `payload/server.py`.

### Что сделано в этой смене

Найден ещё один реальный identity-дефект в многошаговом tool-loop. Модель могла вернуть корректный по смыслу вызов инструмента с пробелами вокруг `call_id`/`name`. История уже записывала очищенные значения, но сам локальный executor получал исходный `DelegatedToolCall` с неочищенным именем. Для реального `write_file`/`run_shell` это могло превратить нормальный вызов в ложную ошибку и разъехаться с тем, что затем видит модель в tool-result.

Исправлено в `payload/delegated_tool_loop.py`:
- `call_id`, `name` и `arguments` один раз канонизируются сразу после model reply;
- в историю и в локальный executor идёт один и тот же новый `DelegatedToolCall`;
- повторные call-id проверяются уже по канонической форме.

Добавлен `test_tool_identity_is_canonical_before_executor_and_history` в `tests/test_delegated_tool_loop.py`: он подаёт `"  call-1  "` / `"  write_file  "` и требует, чтобы executor и следующий model step увидели ровно `call-1` / `write_file`. Логику дополнительно прогнал локально на минимальном изолированном сценарии: `tool → result → следующий model step → final` проходит с канонической identity.

Коммиты Agent этой смены:
- `5ea52fca7e3a51d235c10627ff8b8dac61d16e16` — canonicalize delegated tool calls before execution;
- `2a3520cdaf8150f16d9bd8bd0b1b068fbd3db84f` — regression на executor/history identity.

На exact head `2a3520cd…` автоматически создан CircleCI workflow `72ab0cbd-68ec-4acf-9caa-6935e2f988e0`.
Пять задач `agent`, `prompt`, `routing`, `delegation`, `server-wiring-rehearsal` на момент передачи тоже `pending`; дубликат не запускать.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять Agent workflow `72ab0cbd-...`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
