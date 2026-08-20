# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `29942f27d8b5ec404d88b33dfa70486283be4224`.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Точный digest-разрез на Core всё ещё ждёт CircleCI:
- exact Core head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- при повторной проверке этой смены все пять всё ещё `pending`.

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

Пока Windows executor занят, проверены два важных участка дочернего агентного цикла.

1. `DelegatedToolLoopSession` раньше превращал пустой результат локального executor `{}` в `{"ok": true}`. Для `write_file`/`edit_file`/`run_shell` это могло дать модели ложное подтверждение недоказанного side effect. Теперь пустой результат идёт в историю как `{"ok": false, "error": "tool_result_invalid"}`. Добавлена регрессия `test_empty_tool_result_is_not_treated_as_success`.

2. `NotionDelegationAdapter` защищал foreground reservation только когда `pool.size > 1`. При одном аккаунте независимый child мог взять единственный аккаунт, уже зарезервированный незавершённой parent tool-chain, и сломать sticky continuation. Теперь reserved account IDs учитываются при любом размере пула. В single-slot случае child получает `AccountPoolExhausted`, а родительский слот остаётся неприкосновенным. Добавлена регрессия `test_single_account_child_cannot_steal_reserved_parent_slot`.

Коммиты Agent этой смены:
- `4775c08228d16024fa9a860786a1378d3bf36e15` — fail-closed для пустого результата локального инструмента;
- `dbea66ccea647afba82917a61e53a996b9f613e0` — регрессия на пустой tool result;
- `169a4776bbf14f7c298b8a5b9ec5c8a9975801ca` — single-slot reservation теперь тоже защищена;
- `29942f27d8b5ec404d88b33dfa70486283be4224` — регрессия на запрет кражи единственного parent slot.

Новый CircleCI workflow на exact head должен появиться автоматически. Старые Agent workflow были `pending`; не запускать дубликаты вручную.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять CircleCI exact-head Agent `29942f27…`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
