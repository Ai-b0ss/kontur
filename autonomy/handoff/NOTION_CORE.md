# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `837d5999481a24f6f62a1a9aae967760f05ef50f`.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Точный digest-разрез всё ещё не получил Windows executor:
- exact Core head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- на проверке этой смены все пять по-прежнему `pending`.

Дубликат не запускать. Продуктовый файловый слой пока не менять вслепую.

Если результат окажется `outside-digest`, уже подготовлен более точный call-cut на ветке `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`.

После нахождения одного точного вызова: минимальный фикс → `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → Windows `tests.test_crash_recovery` → полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрываем.

## Codex / Agent

Перед этой сменой PR #8 уже ушёл дальше старой передачи: фактический head был `1030084c819b9f4833544f69ecbff1d4b9d15dec`.

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

Нашёл реальный дефект в identity-контракте субагентов. `validate_delegation_request()` проверял `task_id` и `parent_turn_id` после `strip()`, но возвращал исходный объект. Из-за этого один и тот же логический child-id мог пройти проверку по каноническому значению, а затем попасть в `DelegationContext`/`DelegationResult` в виде whitespace-алиаса. Conversation key уже был каноническим, то есть внутри одного вызова могли существовать две формы одной identity.

Исправлено в `payload/delegation_policy.py`:
- валидатор теперь возвращает новый `DelegationRequest` с каноническими `task_id`, `parent_turn_id` и очищенным `objective`;
- `delegated_conversation_key()` строится уже из канонического request;
- downstream `DelegationDispatcher` автоматически получает и возвращает одну и ту же identity без алиасов.

Добавлены проверки:
- `tests/test_delegation_policy.py` доказывает канонизацию всех трёх полей;
- `tests/test_delegation_dispatcher.py` доказывает, что канонические task/parent/objective доходят до adapter context и возвращаются в result.

Коммиты Agent этой смены:
- `bcefbdc185212c3561eb6edb1d195b5af488cddb` — canonicalize delegated task identities end-to-end;
- `eed4f3417474fadaf89054c5c3b772d4ca153553` — policy regression;
- `837d5999481a24f6f62a1a9aae967760f05ef50f` — dispatcher regression.

На exact head `837d5999…` автоматически создан CircleCI workflow `33a3048d-b109-416e-8939-ba416a5e3234`.
Пять задач `agent`, `prompt`, `routing`, `delegation`, `server-wiring-rehearsal` на момент передачи `pending`; дубликат не запускать.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять Agent workflow `33a3048d-...`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
