# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `42db5b991729faf43dbeed375a001feae95f8634`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23. Низкоуровневый Windows write primitive v23 не менять без нового точного сигнала.

На head `510a03203a76fe33551c29a4933f1518f6c786de` настоящий Windows дал важный разрез:
- `happy-running` — SUCCESS;
- `happy-stopped` — SUCCESS;
- `rerun-noop` — SUCCESS;
- `auth-rollback` — FAILURE;
- внутри rollback: `files` и `non-targets` — SUCCESS, а `auth` и `stable` — FAILURE.

Это показало общую границу: обычные записи и возврат управляемых файлов уже работают, а два аварийных удаления дочерних деревьев всё ещё теряют удерживаемый namespace. В исходнике оба пути сходятся в `remove_plain_tree(...)`: внешний `.notionagents` guard уже удерживается, но корень auth/runtime/migration снова открывается по абсолютному пути. Это тот же класс Windows-конфликта, который ранее был исправлен для write-path, только теперь в destructive rollback.

Сделан v27 (`tools/build_ncm28_windows_fixed_candidate_v27.py`):
- `remove_plain_tree` получил необязательный `parent_guard` и открывает корень относительно уже удерживаемого handle;
- тот же `managed_guard` протянут только в rollback-удаления auth/codex/runtime/migration и в два residue-helper;
- v23 native write primitive не менялся;
- обычные happy-path/restart контракты не расширялись.

CircleCI workflow для exact head `42db5b99...`: `f8c942d2-8fef-48ab-9b63-902fefc74008`.
Проверки: `ncm28-windows-build-v27`, `happy-running-v27`, `happy-stopped-v27`, `rerun-noop-v27`, `auth-rollback-v27`. На момент записи все ещё выполняются. Старый диагностический workflow больше не используется новым head.

Следующий шаг:
1. снять пять результатов v27;
2. если все зелёные — сразу заменить временный интеграционный набор на Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; при PASS закрыть NCM28;
3. если build красный — исправлять только preimage/сборщик v27, не продукт;
4. если три happy-path зелёные, а rollback красный — новый файловый примитив не трогать; сузить только оставшийся rollback operation.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Текущий head после независимой подготовки: `31a52d13cd03cb194e6d890dbd718d3ac5cb71b0`.

Четыре постоянных Agent-контракта на предыдущем exact head `84039a5d...` были зелёными: prompt, agent, routing, delegation.

Настоящий CLI-гейт уже существует в `tools/run_real_codex_cli_project_probe.py` и запускает именно `codex exec` через Responses bridge. В этом запуске он усилен без обращения к Notion: первый `python verify.py` теперь намеренно создаёт неизвестный заранее `challenge.txt` и падает. Для успеха Codex обязан получить ошибку инструмента, прочитать новую информацию, изменить `result.txt` и повторно запустить verifier до PASS. То есть будущий live PASS будет доказывать не просто создание файла, а реальное продолжение после неудачного tool result и исправление собственной работы. Добавлен офлайн-контракт этого двухшагового verifier.

CircleCI Agent workflow на `31a52d13...` запущен автоматически; на момент записи четыре job ещё выполняются.

После NCM28 порядок такой:
1. один настоящий `run_real_codex_cli_project_probe.py` в уже авторизованной среде;
2. restart/recovery незавершённой цепочки;
3. failover: sticky continuation остаётся на владельце thread, а при его недоступности допустимый другой слот получает новый Notion thread и полную локальную историю; старый thread ID между аккаунтами не переносится;
4. затем субагенты и реальное делегирование в Qwen.

Production и живой Notion в этом запуске не трогались; секреты не печатались.
