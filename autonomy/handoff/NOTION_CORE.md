# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `8d47632248dc8031620a4adced4b05e92ab21821`.

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

Если результат окажется `outside-digest`, уже подготовлен более точный call-cut на ветке `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. Он различает прямые `sanitized_active`, `sha_file`, `pending_atomic`, recovery/validation, `_strict_tree_listing`, отдельные `tree_digest`, `_path_lexists` и `outside_known`.

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

Сначала заново проверены реальные головы PR. Core не изменился (`b6f4eef2…`), а Agent уже был дальше старой передачи — `659304b9…`; предыдущие старые head больше не использовать.

Пока CircleCI не выдаёт executor, исправлен реальный дефект поведения дочернего coding-agent в `payload/notion_delegated_model_step.py`.

Раньше модель могла явно попытаться вызвать локальный инструмент, но ошибиться в его имени, например `wriet_file`. `_extract_reply()` принимал JSON как tool-call только если имя уже входило в локальный allowlist. Любая опечатка/неизвестное имя поэтому тихо превращалась в обычный финальный текст, и дочерняя задача могла закончиться JSON-строкой вместо того, чтобы получить ошибку инструмента и исправиться на следующем ходе.

Теперь:
- явный JSON tool intent сохраняется как tool-call даже при неизвестном имени;
- имя нормализуется `.strip()`;
- authoritative allowlist остаётся у локального executor, который возвращает `unsupported_tool`;
- этот tool-result попадает обратно в тот же Notion thread, поэтому модель может исправить имя и продолжить работу;
- действительно malformed tool JSON (`tool/name` без нормального имени или с не-object arguments) больше не выдаётся за успешный финальный ответ, а закрывается явной ошибкой структуры.

Добавлена регрессия `test_unsupported_tool_attempt_is_returned_as_tool_result_for_correction`: первый ход делает опечатку `wriet_file`, второй видит `unsupported_tool` и исправляет вызов на `write_file`, третий завершает задачу. Тест также проверяет нормализацию имени с пробелами.

Коммиты Agent этой смены:
- `d4399938370f464e68973428f6acfd09a0cf164a` — сохранять ошибочный tool intent для самокоррекции;
- `8d47632248dc8031620a4adced4b05e92ab21821` — регрессия на `unsupported_tool -> correction -> final`.

На exact Agent head создан CircleCI workflow `ba6ceb9c-d676-418c-afcc-16a14000a2c6`; `agent-contracts`, `delegation-contracts`, `prompt-contracts`, `routing-contracts`, `server-wiring-rehearsal` пока `pending`. Дубликат не запускать.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять CircleCI exact-head Agent `8d476322…`, workflow `ba6ceb9c-...`. Если конкретная задача красная — чинить её точную причину.
3. Если Windows digest укажет `outside-digest`, использовать уже готовый `autonomy/ncm28-callcut-ready-20260820@f72c450f…`; не строить ещё одну общую диагностику.
4. После точного NCM28 callsite: минимальный продуктовый фикс → 5 Windows сценариев → crash recovery → полный NCM28 verify.
5. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
6. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
7. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
8. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
