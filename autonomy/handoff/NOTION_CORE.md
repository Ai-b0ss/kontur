# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `85940ba8499b42f6ab0deb248ff6c5490d9f65ee`.

## NCM28

Последняя доказанная хорошая продуктовая база остаётся v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Поэтому native write primitive v23 не менять без нового точного доказательства.

Свежая ветка до этой смены содержала v26. V26 строится от v23 и глобально меняет `_load_outer_journal()`: `ncm28_recover_atomic_write(...)` вызывается только если `ncm28_pending_atomic_write(path)` видит durable intent. Идея — не входить в повторный atomic recovery при same-process rollback после уже успешной публикации outer journal; crash/restart при реальном intent остаётся.

В этой смене сначала вернул четыре уже существующих Windows integrated cases на exact v26. Commit `eec28988...`, CircleCI workflow `6b88bc42-c690-42ca-a296-9985d27276d3`. Все четыре завершились `failure`:
- `happy-running` `dad1549c-965f-4734-9c0f-81c3772cc148`
- `happy-stopped` `87626042-1ce2-4b35-ab54-4e2c7b9ddfde`
- `rerun-noop` `6d792ed7-fb96-4f54-9f94-9c4f66160b10`
- `auth-rollback` `4d965246-3b8a-4843-a3f7-523bfa6f1d63`

Но это пока НЕ доказательство, что четыре продуктовых сценария реально дошли до integrated runtime. Доступный интерфейс CircleCI не отдаёт вывод job. Поэтому я отдельно запустил Windows job, который только устанавливает Python/deps и строит v26. Commit `66da25f7...`, workflow `09e00da9-43f6-4907-a25d-98c2ca454382`, job `e2f3a8c7-63bc-48f9-a5b0-8a6d580df093` — он тоже `failure`. Значит сначала надо отделить проблему Windows executor/setup/build от NCM28 runtime, а не снова чинить `integrated_upgrade.py` наугад.

Для этого текущий head `85940ba...` запускает ровно два Windows jobs в одном workflow `5a8906b0-5bf1-4117-af92-5d09d3484674`:
- только checkout + проверенный Python 3.13.9 installer: `ncm28-windows-setup`, job `d4858c5c-50c3-4a90-94ce-ac97b6c30d92`;
- тот же setup + deps + только build v26, без integrated runtime: `ncm28-windows-build-v26`, job `2175c871-973d-472e-a673-078af2adab11`.
На момент передачи оба ещё выполняются. Дубликаты не запускать.

Следующая смена сначала снимает эти два статуса. Если `setup` красный — это инфраструктура/Windows bootstrap, NCM28 код пока не трогать; минимально исправить executor/bootstrap. Если `setup` зелёный, а `build` красный — проблема в deps/builder/materialization; разделить deps от builder только если без логов иначе не установить границу. Если оба зелёные — четыре предыдущих failure действительно лежат после сборки; тогда вернуться к продукту. В таком случае сравнивать v23 с v26 и предпочитать узкий same-process rollback route, а не глобальную смену `_load_outer_journal`. В репозитории уже есть более узкий v25-подход: только при `AUTH_ACTIVATION_FAILED` передать `known_canonical_journal`, заново побайтово доказать журнал и пропустить crash-intent scan только для этого same-process пути. Нормальный crash/restart остаётся через `_load_outer_journal`.

После первого устойчивого integrated PASS: Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; затем закрыть NCM28 и не продолжать файловую археологию.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий проверенный в этой смене head: `ccfad1a963e97e3e0d63d5fb8bb8a4ab39b87dec`.

Семь продуктовых контрактов на материализованном `server.py` ранее доказаны: два режима промпта, сохранение приватного prompt identity, настоящий Responses wiring, ранняя HTTP validation, account-pool parallelism, foreground routing и cooldown failover. `owner` не смешивается с инженерной персоной; runtime/tool-факты идут отдельным нейтральным слоем.

Проверен существующий `tools/live_two_slot_codex_probe.py`: он уже делает два параллельных Responses-turn на разных свободных легитимных слотах и проверяет sticky continuation после function result. Но инструмент там синтетический `probe_marker`, поэтому это не конечная пользовательская проверка.

После закрытия NCM28 синхронизировать PR #8 со свежим Core и перейти к реальному Codex CLI через OpenAI-compatible Responses endpoint. Требуемый сценарий: Codex получает обычную задачу в временном проекте -> реально читает файл -> получает tool result -> делает следующий модельный ход -> реально изменяет файл/запускает безопасную команду -> получает второй result -> проверяет результат -> завершает задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при его недоступности создаётся новый Notion thread на другом допустимом слоте с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion в этой смене не трогались; секреты не раскрывались.
