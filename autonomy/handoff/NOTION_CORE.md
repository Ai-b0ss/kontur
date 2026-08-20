# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `42f148282584fbc6318c289b2286fb01676e767a`.

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
- на начало и конец этой смены все пять остаются `pending`.

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

Пока CircleCI не выдаёт Windows/Agent executor, найден и исправлен реальный дефект в многошаговом дочернем tool-loop.

Раньше при ответе модели с несколькими tool calls `DelegatedToolLoopSession` добавлял `call_id` в `_seen_call_ids` по одному прямо во время проверки пачки. Если первый вызов был нормальным, а более поздний вызов в той же пачке был malformed, весь ответ отклонялся до выполнения локальных действий, но ранний `call_id` уже считался использованным. После retry/failover исправленная модель могла законно повторить тот же `call_id` и получить ложную ошибку `call id was reused`.

Теперь пачка проверяется атомарно:
- все `call_id`, имена и аргументы сначала нормализуются во временную структуру;
- дубликаты проверяются и против старой истории, и внутри текущей пачки;
- невалидные аргументы закрываются как `delegated tool call arguments are invalid`;
- `_seen_call_ids`, model-turn budget и `assistant_tool_calls` коммитятся только после полной проверки всей пачки;
- malformed пачка не расходует model-turn budget и не оставляет частичного состояния.

Добавлена регрессия `test_invalid_batch_does_not_poison_earlier_call_id_for_retry`: первая пачка содержит валидный `call-1` и сломанный второй вызов; локальное действие не выполняется, история и счётчик ходов не меняются; повторная исправленная пачка с тем же `call-1` проходит ровно один раз и задача заканчивается.

Коммиты Agent этой смены:
- `23d663a337e85cf186ecd883471db8ef7cbb5194` — атомарная проверка пачки tool calls;
- `841735701cacd0e0b004dff93f532f9a5a0bfc26` — model-turn считается только после валидной пачки;
- `42f148282584fbc6318c289b2286fb01676e767a` — итоговая регрессия на retry без ложного replay.

На exact head должен появиться новый обычный Agent CircleCI. Старые pending workflow вручную не дублировать.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять CircleCI exact-head Agent `42f148282…`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
