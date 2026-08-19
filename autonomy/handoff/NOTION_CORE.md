# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `84fcd1e5b84f2ede0e5719198f8082f5b838eccc`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23. Низкоуровневый Windows write primitive v23 без нового точного доказательства не менять.

Перед этим запуском ветка уже ушла дальше старого handoff. На head `b094aa874fd14d56734df6d37f4b7808882a1c89` CircleCI дал очень важный результат:
- `ncm28-windows-build-v25` — SUCCESS;
- `happy-running` — SUCCESS;
- `happy-stopped` — SUCCESS;
- `rerun-noop` — SUCCESS;
- `auth-rollback` — FAILURE.

То есть materialization v25 и три обычных Windows-пути сейчас доказаны. Остался ровно same-process rollback после `AUTH_ACTIVATION_FAILED`; возвращаться к native write primitive или общему crash/restart без нового сигнала нельзя.

Текущий v25 строится строго от v23. `_recover_outer_transaction()` сохраняет уже существующий параметр `managed_guard` и добавляет только `known_canonical_journal`. Обычный crash/restart по-прежнему читает outer journal через `_load_outer_journal(home, parent_guard=managed_guard)`. Только same-process auth rollback может повторно использовать уже опубликованный canonical journal после точной проверки его байтов.

В этом запуске я не стал придумывать ещё одно исправление вслепую. Вместо этого добавил четыре независимых Windows-проверки уже существующего rollback-результата:
- `ncm28-auth-stage-non-targets` — сохранились ли нетронутые файлы;
- `ncm28-auth-stage-auth` — откатился ли auth-слой;
- `ncm28-auth-stage-stable` — откатился ли stable-слой;
- `ncm28-auth-stage-files` — восстановились ли исходные файлы без blocked/error.

Коммит диагностики: `84fcd1e5b84f2ede0e5719198f8082f5b838eccc`.
CircleCI workflow: `991823d9-cf2b-483d-97f0-619a0a63accc`.
На момент передачи все девять jobs ещё `pending`, поэтому второй прогон не создавать.

Следующий шаг очень конкретный:
1. снять четыре `ncm28-auth-stage-*` результата и обычный `auth-rollback` на `84fcd1e5...`;
2. если красный только один sub-result — исправлять только соответствующую операцию внутри same-process auth rollback;
3. если все четыре sub-result зелёные, а интеграционный `auth-rollback` красный — проблема уже в финальном контракте результата/классификации теста, сравнить его с ожидаемым `test_auth_verify_failure_rolls_back_every_layer`, не трогая файловый слой;
4. после первого зелёного `auth-rollback` удалить временные четыре stage-job из `.circleci/config.yml`, затем запустить настоящий Windows `tests.test_crash_recovery` и полный `RUN_NCM28_LOCAL_VERIFY.py`;
5. при их PASS считать NCM28 закрытым и больше не расширять эту диагностику.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Фактический свежий head на момент этого запуска: `8f1ad3013f699cb3f556111eaa7604e565733881`.

На этом exact head четыре постоянных CircleCI-контракта зелёные:
- `agent-contracts` — SUCCESS;
- `prompt-contracts` — SUCCESS;
- `routing-contracts` — SUCCESS;
- `delegation-contracts` — SUCCESS;
workflow `541e3e1b-1c13-4968-b186-f439ba2e9256`.

Ветка уже содержит настоящий `tools/live_codex_project_probe.py`. Он создаёт временный проект с неизвестным заранее токеном, даёт Notion/Codex реальные `read_file`, `write_file`, `bash`, требует создать `result.txt`, выполнить `python verify.py` и не позволяет считать задачу законченной до успешной локальной проверки. Это ближайший пользовательский гейт после NCM28; новые синтетические `probe_marker` не добавлять.

После закрытия NCM28 порядок такой:
1. запустить `live_codex_project_probe.py` в уже авторизованной среде: реальный файл → tool result → следующий модельный ход → запись → tool result → `python verify.py` → финал;
2. затем оборвать незавершённую цепочку, перезапустить bridge и доказать recovery/continuation;
3. затем проверить failover: пока владелец Notion thread доступен, продолжение остаётся на нём; если слот временно недоступен, независимая допустимая замена получает новый Notion thread и полную локальную историю — старый thread ID между аккаунтами не переносится;
4. только после устойчивого Codex-ядра переходить к субагентам и реальному делегированию в Qwen.

Production и живой Notion в этом запуске не трогались; секреты не раскрывались.
