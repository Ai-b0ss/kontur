# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `a35e6fe3bfdb00dadad4ea49ae7d798b9c69aae8`.

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
- на конец этой смены все пять по-прежнему `pending`.

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

Сначала заново проверены реальные головы PR. Core не изменился (`b6f4eef2…`). Agent к началу смены уже был на `5cecbdf3…`, то есть старая передача отставала.

Пока CircleCI ждёт executor, найден и исправлен реальный дефект возврата на старый Notion-слот внутри незавершённой дочерней задачи.

Проблема: child-session хранила remote thread отдельно для каждого client object. При A → B всё было правильно: B получал полную локальную историю и новый Notion thread. Но если позже A снова становился доступен, код мог вернуться в старый `thread-a` и отправить туда только incremental delta. Этот старый thread не видел assistant tool-calls, которые делал B, поэтому A мог получить «сиротские» tool-result, неверно понять историю или повторить уже выполненный локальный side effect.

Исправление:
- incremental continuation разрешено только для подряд идущих ходов на одном и том же exact client;
- любая смена provider client заставляет следующий успешный слот получить полный локальный transcript и создать свежий Notion thread;
- после успешной смены старые remote thread states выбрасываются, поэтому возврат B → A тоже идёт через полный rebase, а не через старый thread;
- integer-id collision guard сохранён.

Коммиты Agent этой смены:
- `0debadaef4df44aa2662e6f9367520ba9bce61ce` — product fix + отдельная регрессия A → B → A;
- `a35e6fe3bfdb00dadad4ea49ae7d798b9c69aae8` — новая регрессия включена в постоянные `agent-contracts` и `delegation-contracts`.

Новый CircleCI workflow на exact Agent head: `105c36b1-d6d0-4adf-92c1-9b88ee492f07`; `agent-contracts`, `delegation-contracts`, `prompt-contracts`, `routing-contracts`, `server-wiring-rehearsal` на конец смены `pending`. Дубликат не запускать.

Отдельно найден следующий продуктовый риск в `payload/server.py`: `ForegroundAccountReservations.wait_for_background_route()` сейчас для `pool_size <= 1` сразу возвращает пустой avoid-set, а вызывающий путь вообще включает защиту reserved foreground slot только при `account_pool.size > 1`. Это означает, что при одном легитимном слоте новая независимая работа теоретически может забрать аккаунт, который незавершённый foreground tool-loop считает зарезервированным. Исправлять это следующим независимым шагом: при одном слоте новая работа должна ждать clear/TTL, а anchored continuation — сохранять свой affinity path.

Нового provider traffic не было. Production и живой Notion не трогались.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять CircleCI exact-head Agent `a35e6fe3…`, workflow `105c36b1-...`. Если конкретная задача красная — чинить её точную причину.
3. Если Windows digest укажет `outside-digest`, использовать уже готовый `autonomy/ncm28-callcut-ready-20260820@f72c450f…`; не строить ещё одну общую диагностику.
4. После точного NCM28 callsite: минимальный продуктовый фикс → 5 Windows сценариев → crash recovery → полный NCM28 verify.
5. Если Agent CI всё ещё ждёт executor, исправить single-slot reservation gap в `payload/server.py` и добавить регрессию: при `pool_size=1` независимый route ждёт освобождения reserved slot; anchored continuation не блокируется самой собой.
6. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
7. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
8. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
9. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.
