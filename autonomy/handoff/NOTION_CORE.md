# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `e9233b2ce6811809474004345b43fa4e9f526301`.

## NCM28

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive не менять без нового точного доказательства.

Что доказано настоящим Windows:
- на v25: `build`, `happy-running`, `happy-stopped`, `rerun-noop` — SUCCESS; `auth-rollback` — FAILURE;
- внутри rollback на v25: возврат управляемых файлов и сохранность non-targets — SUCCESS; auth и stable — FAILURE;
- v27/v28/v29/v30/v31 были только неудачными сборочными/preimage-попытками и не считаются продуктовыми Windows-регрессиями;
- отдельный fast-gate установил важную причину этих ложных сборочных тупиков: после materialize v25 в исходнике две текстовые версии `_rollback_committed_first_auth`; v23 намеренно добавляет более строгую позднюю реализацию, которая фактически и используется Python.

Сделан v32 (`tools/build_ncm28_windows_fixed_candidate_v32.py`). Он не меняет доказанный v23 write primitive и исправляет только destructive rollback namespace:
- `remove_plain_tree` умеет открыть transaction-owned корень относительно уже удерживаемого parent guard;
- `managed_guard` передаётся в auth/codex rollback-удаления;
- обе текстовые реализации `_rollback_committed_first_auth` теперь сохраняют этот guard, так что порядок определений не возвращает pathname-based удаление;
- два committed stable-пути удаления runtime/migration тоже получают тот же удерживаемый `.notionagents` guard.

Fast materialize+compile v32 — PASS: workflow `12e96ee2-f89a-4426-9156-06ac05648555`, job `fa3eccb9-987c-4e6c-9386-9a59b6ad3c40`.

Настоящий Windows acceptance v32 на commit `3978ecb264fdf2a7a5effc942621f1a1bd45fba9`, workflow `08837cc8-0149-465a-90a3-61ddc953bd43`:
- build — SUCCESS;
- happy-running — SUCCESS;
- happy-stopped — SUCCESS;
- rerun-noop — SUCCESS;
- auth-rollback — FAILURE.

То есть v32 не регрессировал три уже зелёных пути, но одного parent-guard на root-open оказалось недостаточно для аварийного rollback. Full crash-recovery job правильно не стартовал, потому что был gated всеми пятью проверками.

Следующий разрез уже запущен на Core head `e9233b2c...`, workflow `5a26bdc2-8dac-4a38-87c1-fe34df81bb85`: он не меняет продукт, а определяет точные классы исключений auth и stable независимо. После результата чинить только конкретную операцию rollback; не возвращаться к общему файловому примитиву и не расширять диагностику дальше необходимого.

После первого полностью зелёного `auth-rollback` сразу выполнить Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`, после PASS закрыть NCM28 и удалить временную диагностическую обвязку.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Текущий head: `5098f89ca6e0315fcfff7269b210325319f3be27`.

Все четыре постоянных CircleCI-набора на этом exact head зелёные, workflow `4e57cad5-ed8b-4f1b-9559-2a2006dc4cb0`:
- prompt-contracts — SUCCESS;
- agent-contracts — SUCCESS;
- routing-contracts — SUCCESS;
- delegation-contracts — SUCCESS.

Настоящий CLI-гейт `tools/run_real_codex_cli_project_probe.py` теперь сильнее прежнего: он запускает именно `codex exec` через Responses bridge и первый `python verify.py` намеренно создаёт неизвестный заранее `challenge.txt` и завершается ошибкой. Для PASS Codex обязан получить неудачный tool result, прочитать новую информацию, исправить `result.txt`, повторно запустить verifier и закончить только после `VERIFY_OK`. Этот контракт уже включён в зелёный `agent-contracts`.

После NCM28 порядок:
1. один настоящий `run_real_codex_cli_project_probe.py` в уже авторизованной среде;
2. restart/recovery незавершённой цепочки;
3. failover: обычное продолжение остаётся на владельце Notion thread; при недоступности владельца другой допустимый слот получает новый Notion thread и полную локальную историю, старый thread ID между аккаунтами не переносится;
4. только после этого углублять субагентов и реальное делегирование в Qwen.

Production и живой Notion в этой смене не трогались; секреты не печатались.
