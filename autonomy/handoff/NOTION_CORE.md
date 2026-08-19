# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `85940ba8499b42f6ab0deb248ff6c5490d9f65ee` (перепроверен 2026-08-19 15:xx МСК, не сдвинулся).

## NCM28

Последняя доказанная хорошая продуктовая база остаётся v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Поэтому native write primitive v23 не менять без нового точного доказательства.

Свежая ветка содержит v26. V26 строится от v23 и глобально меняет `_load_outer_journal()`: `ncm28_recover_atomic_write(...)` вызывается только если `ncm28_pending_atomic_write(path)` видит durable intent. Идея — не входить в повторный atomic recovery при same-process rollback после уже успешной публикации outer journal; crash/restart при реальном intent остаётся.

Четыре integrated Windows cases на v26 ранее завершились `failure`, но отдельный build-only Windows job тоже упал до запуска integrated runtime. Поэтому эти четыре результата нельзя трактовать как четыре продуктовых падения NCM28.

Текущий head `85940ba...` разделяет границу на два Windows jobs в CircleCI workflow `5a8906b0-5bf1-4117-af92-5d09d3484674`:
- только checkout + установка Python 3.13.9: `ncm28-windows-setup`, job `d4858c5c-50c3-4a90-94ce-ac97b6c30d92`;
- тот же setup + deps + только build v26, без integrated runtime: `ncm28-windows-build-v26`, job `2175c871-973d-472e-a673-078af2adab11`.

В текущем ChatGPT-коннекторе нет чтения CircleCI job/output, поэтому я не стал менять продуктовый код или bootstrap вслепую. GitHub подтверждает, что Core head не сдвинулся и `.circleci/config.yml` на нём по-прежнему содержит именно эти два изолированных задания. Дубликаты не запускать.

Следующая смена сначала должна получить фактические статусы этих двух CircleCI jobs через доступный ей CircleCI-интерфейс. Если `setup` красный — это инфраструктура/Windows bootstrap, NCM28 код не трогать; минимально исправить executor/bootstrap. Если `setup` зелёный, а `build` красный — проблема в deps/builder/materialization. Если оба зелёные — вернуться к продукту и предпочитать узкий same-process rollback route вместо глобальной смены `_load_outer_journal`: при `AUTH_ACTIVATION_FAILED` передать `known_canonical_journal`, заново побайтово доказать журнал и пропустить crash-intent scan только для этого same-process пути. Нормальный crash/restart остаётся через `_load_outer_journal`.

После первого устойчивого integrated PASS: Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; затем закрыть NCM28 и не продолжать файловую археологию.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий head на момент этой передачи: `a101f9a3c0d55d69ec59b74628293167717b23c7` (предыдущий handoff уже устарел).
PR #8 всё ещё draft и сейчас не mergeable относительно Core, поэтому перед живым Codex-прогоном его надо синхронизировать со свежим Core, не затирая NCM28.

Семь продуктовых контрактов на материализованном `server.py` ранее доказаны: два режима промпта, сохранение приватного prompt identity, настоящий Responses wiring, ранняя HTTP validation, account-pool parallelism, foreground routing и cooldown failover. `owner` не смешивается с инженерной персоной; runtime/tool-факты идут отдельным нейтральным слоем.

Перепроверен текущий `tools/live_two_slot_codex_probe.py`: он действительно запускает два параллельных Responses-turn на двух разных легитимных слотах и проверяет sticky continuation после function result. Но инструмент там всё ещё синтетический `probe_marker`; это не доказательство пользовательской цели и не заменяет настоящий Codex CLI с локальными действиями.

После закрытия NCM28 синхронизировать PR #8 со свежим Core и перейти к реальному Codex CLI через OpenAI-compatible Responses endpoint. Требуемый сценарий: Codex получает обычную задачу во временном проекте -> реально читает файл -> получает tool result -> делает следующий модельный ход -> реально изменяет файл/запускает безопасную команду -> получает второй result -> проверяет результат -> завершает задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при его недоступности создаётся новый Notion thread на другом допустимом слоте с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion в этой смене не трогались; секреты не раскрывались.
