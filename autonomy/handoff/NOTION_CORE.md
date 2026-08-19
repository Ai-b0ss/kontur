# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `f2da5e8b4c6766e43289b60812813911cb621be4`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Build-cut ранее доказал: Windows executor, Python, зависимости, исходный manifest и общий builder исправны; v23 собирается, широкий v26 — нет. v26 не продвигать.

Свежая причина многократного падения v25 наконец локализована точнее. Отдельный Windows preimage-cut на commit `4e84411b13d6d121c4bff3e06aa8ba70eee762ce`, workflow `9ef79939-822a-4761-ac91-a70c7d614b32`, дал:
- `ncm28-v25-preimage-signature` — SUCCESS;
- `ncm28-v25-preimage-call` — SUCCESS;
- `ncm28-v25-preimage-load` — FAILURE;
- полный `ncm28-windows-build-v25` — FAILURE.

То есть builder ломался не на сигнатуре recovery и не на coordinator callsite. Точный источник найден в уже существующей v23-семантике: обычный crash/restart загружает outer journal как `_load_outer_journal(home, parent_guard=managed_guard)`, а v25 ошибочно искал старую форму без `parent_guard`. Это была ошибка материализации кандидата, а не новый продуктовый Windows-дефект.

На новом commit `f2da5e8b4c6766e43289b60812813911cb621be4` v25 исправлен: обычный recovery сохраняет `parent_guard=managed_guard`, а только same-process `AUTH_ACTIVATION_FAILED` может использовать уже опубликованный canonical journal после точной повторной проверки байтов. Native Windows write primitive v23 не менялся.

Сейчас идёт CircleCI workflow `fbc7e218-7f4d-46c8-9904-d220b1562a3f`. На момент записи signature/call preimage уже зелёные; build и четыре integrated Windows case ещё выполняются. Старый `preimage-load` в этом workflow всё ещё использует прежний диагностический шаблон и потому ожидаемо красный — его больше не использовать как продуктовый сигнал. Главный сигнал теперь `ncm28-windows-build-v25`, затем четыре integrated case.

Следующий шаг:
1. если `ncm28-windows-build-v25` зелёный — интерпретировать `happy-running`, `happy-stopped`, `rerun-noop`, `auth-rollback`;
2. если все четыре зелёные — убрать временный preimage-cut из ветки, затем прогнать Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py` и закрыть NCM28;
3. если три обычных зелёные, а rollback красный — чинить только same-process auth rollback, не возвращаясь к native write primitive;
4. если build снова красный — не менять файловый слой; остаток ошибки всё ещё в материализации v25.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Фактический свежий head: `7bc07486431abd0f286a3a69e3ecb81ccf5b5369`.

На этом head четыре постоянных CircleCI-контракта зелёные: `agent-contracts`, `prompt-contracts`, `routing-contracts`, `delegation-contracts` (workflow `dba1ab22-a8fd-4a51-8965-bda03d33f596`). Ветка уже содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing, cooldown failover и provider-neutral envelope для будущих дочерних задач.

Отдельно подтверждено, что в ветке уже есть настоящий пользовательский probe `tools/live_codex_project_probe.py`, а не только старый `probe_marker`. Он создаёт временный проект с неизвестным заранее токеном, даёт Notion/Codex реальные инструменты `read_file`, `write_file`, `bash`, требует создать `result.txt`, запустить `python verify.py` и не завершаться до успешной проверки. Это и есть ближайший пользовательский гейт после NCM28.

Проверил возможность восстановить зашифрованный Notion runtime прямо в CircleCI без обращения к провайдеру: временный `runtime-restore-gate` завершился FAILURE. Чтобы не держать продуктовую агентную ветку красной из-за инфраструктурной готовности, этот gate сразу убран; постоянные четыре контракта снова зелёные. Provider traffic не запускался, секреты не печатались. В репозитории действительно есть LFS-объект `.runtime-state/notion-agent-bridge-runtime-state.tar.gz.gpg` размером 14 908 874 байт после materialization, но доступность подходящего ключа именно в CircleCI этим запуском не доказана.

После закрытия NCM28 не добавлять новые синтетические `probe_marker`. Сначала запустить `live_codex_project_probe.py` в уже авторизованной среде: реальный файл -> tool result -> следующий модельный ход -> запись файла -> tool result -> локальная проверка -> финал. Затем проверить restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion в этом запуске не трогались; секреты не раскрывались.
