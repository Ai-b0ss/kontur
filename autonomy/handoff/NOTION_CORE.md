# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9`.

## NCM28

Последняя доказанная хорошая продуктовая база остаётся v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Снята важная граница по предыдущему head `85940ba8499b42f6ab0deb248ff6c5490d9f65ee`: CircleCI `ncm28-windows-setup` SUCCESS, а `ncm28-windows-build-v26` FAILURE (workflow `5a8906b0-5bf1-4117-af92-5d09d3484674`). Значит Windows executor и установка exact Python 3.13.9 исправны; падение находится в deps/builder/materialization до integrated runtime. Предыдущие четыре красных integrated case пока нельзя считать продуктовым падением NCM28.

Чтобы не гадать по недоступному логу CircleCI, новый head `53a11cbb...` делит build на пять наблюдаемых Windows-проверок в workflow `63a1c509-c783-4c86-83f6-04f1aa3bac00`:
- `ncm28-windows-deps` job `2c550313-fc35-4dbf-a710-7346bc3f74b4` — только pip deps;
- `ncm28-windows-import-v26` job `2e1da898-795c-4e9b-92a1-6547379096b9` — импорт всей цепочки builder v26 без deps/materialization;
- `ncm28-windows-manifest-v26` job `0ab0e346-9154-4c4d-8aad-8de74e0b0372` — exact manifest/source identity;
- `ncm28-windows-build-v23` job `2e495f5a-066d-4411-a2af-37a1d1ac7c35` — сборка последней доказанной v23;
- `ncm28-windows-build-v26` job `fcc11c97-4fbe-4519-a644-984c6a40663c` — полная сборка v26.
На момент передачи все пять pending; дубликаты не запускать.

Развилка следующего прохода простая. Если deps красный — чинить только bootstrap deps. Если import/manifest красный — чинить конкретную цепочку builder/source identity. Если v23 build красный — это общая materialization/build-проблема, продуктовый v26 не трогать. Если v23 зелёный, а v26 красный — дефект строго в v26 patch. Если все build-проверки зелёные — возвращаем integrated Windows cases.

Для продуктового rollback предпочтительный кандидат уже существует как `tools/build_ncm28_windows_fixed_candidate_v25.py`: он строится от доказанной v23 и ограничивает обход crash-intent scan только same-process `AUTH_ACTIVATION_FAILED`, при этом заново побайтово доказывает уже опубликованный canonical outer journal. Глобальный v26-патч `_load_outer_journal()` шире необходимого; не продвигать его без доказательства. После локализации build разумно проверить v25 на четырёх integrated Windows cases. Нормальный crash/restart должен продолжать идти через обычный `_load_outer_journal`.

После первого устойчивого integrated PASS: Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; затем закрыть NCM28 и не продолжать файловую археологию.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий фактический head: `c01e6ded0c2ec72a5d1db84c54878e4ed8fc5340`; PR draft и сейчас `mergeable=false` относительно Core. Старый head из предыдущей передачи устарел.

Ветка уже содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing и cooldown failover; PR описывает семь ранее зелёных контрактов. Текущий `tools/live_two_slot_codex_probe.py` всё ещё синтетический: два независимых Responses-turn действительно расходятся по двум слотам и sticky continuation возвращается на своего владельца, но локальное действие — только `probe_marker`.

Пока Windows build-cut выполняется, перепроверен именно этот пробел: следующая пользовательская проверка после NCM28 должна быть не ещё одним marker-тестом, а настоящий Codex CLI во временном проекте: прочитать реальный файл -> получить tool result -> следующим модельным ходом изменить файл или выполнить безопасную локальную команду -> получить второй tool result -> проверить результат -> закончить обычную задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion не трогались; секреты не раскрывались.
