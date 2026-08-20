# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `cca981db8a0ab7934d8df2abbe960c50ae6f37a5`.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Точный текущий разрез уже запущен и до сих пор ждёт Windows-исполнителя:
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- все пять на последней проверке всё ещё `pending`.

Дубликат этого прогона не запускать. Продуктовый файловый слой пока не менять вслепую.

Если результат окажется `outside-digest`, уже подготовлен более точный call-cut на ветке `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. Он различает конкретные чтения/сканирования/проверки вокруг rollback. Использовать его только после доказанного `outside-digest`, а не как ещё одну случайную диагностику.

После нахождения одного точного вызова: минимальный фикс → `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → Windows `tests.test_crash_recovery` → полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрываем и не продолжаем археологию.

## Codex / Agent

Перед началом этой смены PR #8 уже ушёл вперёд относительно старого handoff: был head `691af38d9bcf5e42b245c5f7e704fc9bed8c1d4f`. В нём уже есть:
- режимы `engineer/owner`;
- распределение foreground-слотов и sticky continuation;
- безопасный failover на новый account/thread с переносом локальной истории;
- настоящий проектный `codex exec` гейт и двухслотовый вариант;
- provider-neutral delegation;
- Notion child-agent runtime и lifecycle поверх того же account pool;
- точные схемы локальных инструментов;
- server-wiring materializer, который пока ещё не применён напрямую к `payload/server.py`.

### Что исправлено в этой смене

Найден ещё один реальный дефект в пути дочернего агента к локальным инструментам.

`call_runtime_tool()` сериализует MCP `result`. Если транспорт вернул JSON-объект без нормального результата инструмента, например `{}`, старый `_normalize_runtime_result()` считал это `ok=true`. Для coding-agent это опасно: модель могла решить, что `write_file`, `edit_file` или `run_shell` выполнился, хотя фактического результата инструмента не было.

Исправлено в `payload/server_subagent_runtime.py`:
- успешный MCP `tools/call` теперь обязан содержать `content` как список объектов;
- `{}`, объект без `content`, `content` неправильного типа и не-объекты внутри `content` закрываются как `tool_result_invalid`;
- `isError=true` по-прежнему возвращается модели как `ok=false` с сохранённым структурированным результатом, чтобы она могла исправить следующий шаг.

Добавлены постоянные проверки в `tests/test_server_subagent_tool_catalog.py` для `{}`, отсутствующего `content`, неправильного типа `content` и битого элемента списка.

Коммиты:
- `a1f75fd3f45cb2d4ccaf97abb974e3f5eb0343a1` — fail-closed нормализация MCP result;
- `cca981db8a0ab7934d8df2abbe960c50ae6f37a5` — тесты на malformed MCP object result.

Новый Agent workflow на exact head `cca981db…`: `eacff33d-51b7-49f5-9b66-acf76e18a738`.
Пять задач `agent`, `prompt`, `routing`, `delegation`, `server-wiring-rehearsal` на последней проверке всё ещё `pending`; дубликат не запускать.

## Следующий порядок

1. Сначала снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять Agent workflow `eacff33d-...`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить Agent contracts уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → tool result → изменение/команда → второй tool result → повтор verifier → завершение.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
