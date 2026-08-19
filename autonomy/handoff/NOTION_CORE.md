# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `391bef061b383d4d6e8b303a61bc6d50402ff519`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Build-cut ранее доказал: Windows executor, Python, зависимости, исходный manifest и общий builder исправны; v23 собирается, широкий v26 — нет. v26 не продвигать.

В этом запуске удалось разделить две разные ошибки v25.

Первая была чисто в materialization builder. Windows preimage-cut на commit `4e84411b13d6d121c4bff3e06aa8ba70eee762ce`, workflow `9ef79939-822a-4761-ac91-a70c7d614b32`, дал `signature=SUCCESS`, `call=SUCCESS`, `load=FAILURE`. Через PR patch найден точный контракт v23: обычный recovery уже делает `_load_outer_journal(home, parent_guard=managed_guard)`, а v25 искал старую форму без guard. Это исправлено на `f2da5e8b4c6766e43289b60812813911cb621be4`.

На `f2da5e8b...` важный результат: `ncm28-windows-build-v25` стал SUCCESS. Значит материализация наконец починена. Но `happy-running`, `happy-stopped` и `auth-rollback` стали FAILURE (rerun-noop ещё выполнялся на момент чтения). Причина найдена в самом v25-патче: при переписывании сигнатуры `_recover_outer_transaction()` мы случайно выкинули уже существующий v23-параметр `managed_guard: Any | None = None`. Внутри функция продолжала использовать `managed_guard`, поэтому обычные интеграционные пути ломались уже в продукте.

Новый commit `391bef061b383d4d6e8b303a61bc6d50402ff519` сохраняет точную v23-сигнатуру с `managed_guard` и только добавляет `known_canonical_journal`. Обычный crash/restart продолжает идти через `_load_outer_journal(home, parent_guard=managed_guard)`. Только same-process `AUTH_ACTIVATION_FAILED` может использовать уже опубликованный canonical journal после точной повторной проверки байтов. Native Windows write primitive v23 не менялся.

Сейчас идёт CircleCI workflow `b47bcd5f-fc90-4f84-97c8-cb0e744a4181` на exact head `391bef06...`. Все основные jobs пока выполняются. Временный `preimage-load` всё ещё проверяет старый шаблон и ожидаемо будет красным — его не использовать как продуктовый сигнал.

Следующий шаг:
1. снять `ncm28-windows-build-v25`, затем `happy-running`, `happy-stopped`, `rerun-noop`, `auth-rollback` на `391bef06...`;
2. если build и все четыре case зелёные — удалить временный preimage-cut/helper из ветки, затем прогнать Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py` и закрыть NCM28;
3. если три обычных зелёные, а rollback красный — чинить только same-process auth rollback, не возвращаясь к native write primitive;
4. если обычные case снова красные — сначала проверить, не потерян ли ещё один уже доказанный v23-параметр/контракт при materialization; не менять native write слой вслепую.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Фактический свежий head: `7bc07486431abd0f286a3a69e3ecb81ccf5b5369`.

На этом head четыре постоянных CircleCI-контракта зелёные: `agent-contracts`, `prompt-contracts`, `routing-contracts`, `delegation-contracts` (workflow `dba1ab22-a8fd-4a51-8965-bda03d33f596`). Ветка уже содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing, cooldown failover и provider-neutral envelope для будущих дочерних задач.

Отдельно подтверждено, что в ветке уже есть настоящий пользовательский probe `tools/live_codex_project_probe.py`, а не только старый `probe_marker`. Он создаёт временный проект с неизвестным заранее токеном, даёт Notion/Codex реальные инструменты `read_file`, `write_file`, `bash`, требует создать `result.txt`, запустить `python verify.py` и не завершаться до успешной проверки. Это и есть ближайший пользовательский гейт после NCM28.

Проверил возможность восстановить зашифрованный Notion runtime прямо в CircleCI без обращения к провайдеру: временный `runtime-restore-gate` завершился FAILURE. Чтобы не держать продуктовую агентную ветку красной из-за инфраструктурной готовности, этот gate сразу убран; постоянные четыре контракта снова зелёные. Provider traffic не запускался, секреты не печатались. В репозитории действительно есть LFS-объект `.runtime-state/notion-agent-bridge-runtime-state.tar.gz.gpg` размером 14 908 874 байт после materialization, но доступность подходящего ключа именно в CircleCI этим запуском не доказана.

После закрытия NCM28 не добавлять новые синтетические `probe_marker`. Сначала запустить `live_codex_project_probe.py` в уже авторизованной среде: реальный файл -> tool result -> следующий модельный ход -> запись файла -> tool result -> локальная проверка -> финал. Затем проверить restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion в этом запуске не трогались; секреты не раскрывались.
