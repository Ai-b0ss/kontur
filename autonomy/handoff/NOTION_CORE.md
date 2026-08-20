# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `1978c0f5cd509235028c84af583de0193b2c58da`.

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
- на эту смену все пять всё ещё `pending`.

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

Сначала заново проверены реальные головы PR. Core не изменился (`b6f4eef2…`). Agent к началу смены уже ушёл дальше старой передачи до `073a5431…`, поэтому старые Agent head больше не использовать.

Пока оба CircleCI-контура ждут executor, найден и исправлен ещё один реальный дефект многошагового child tool-loop.

Проблема была в автоматически создаваемых `call_id`. Короткий дочерний промпт специально не требует от Notion придумывать `call_id`, поэтому код создавал его сам из SHA-256 текста JSON-вызова. Это ломало нормальную самокоррекцию: если локальный инструмент реально вернул ошибку и модель законно решила повторить тот же самый вызов без собственного `call_id`, JSON получался тем же, локальный id повторялся, а `DelegatedToolLoopSession` закрывал повтор как reuse старого вызова. То есть агент мог не суметь повторить безопасное действие после временной ошибки инструмента.

Теперь:
- в каждой изолированной child-session есть свой монотонный счётчик локальных synthetic call id;
- вызовы без provider `call_id` получают `delegated-auto-1`, `delegated-auto-2`, ...;
- явный `call_id`, который прислал провайдер, по-прежнему сохраняется как есть, поэтому защита от настоящего повторного call id не ослаблена;
- одинаковый по смыслу повтор после реального tool-result больше не блокируется только из-за одинакового JSON.

Коммиты Agent этой смены:
- `8ec5883f09b5ebe1dda7faf88b511c6e94e70074` — turn-unique synthetic call ids;
- `e9c1ed511c53664477954bb3961c48cd3afe32a6` — отдельная регрессия: первый `write_file` получает временную ошибку, второй идентичный вызов исполняется с новым локальным id и задача завершается;
- `1978c0f5cd509235028c84af583de0193b2c58da` — включить новую регрессию в постоянные agent/delegation проверки.

На exact Agent head автоматически создан CircleCI workflow `4bc5b6fc-840b-48a6-9de9-50874399775a`; `agent-contracts`, `delegation-contracts`, `prompt-contracts`, `routing-contracts`, `server-wiring-rehearsal` пока `pending`. Дубликат не запускать.

Нового provider traffic не было. Production и живой Notion не трогались.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять CircleCI exact-head Agent `1978c0f5…`, workflow `4bc5b6fc-...`. Если конкретная задача красная — чинить её точную причину.
3. Если Windows digest укажет `outside-digest`, использовать уже готовый `autonomy/ncm28-callcut-ready-20260820@f72c450f…`; не строить ещё одну общую диагностику.
4. После точного NCM28 callsite: минимальный продуктовый фикс → 5 Windows сценариев → crash recovery → полный NCM28 verify.
5. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
6. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
7. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
8. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.
