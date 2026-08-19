# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `eec28988ad29e7c43f661d9dc268e5a0743b8a58`.

## NCM28

Основной Windows happy-path ранее был доказан на v23: `happy-running`, `happy-stopped` и `rerun-noop` проходили; оставался только `auth-rollback`.

После этого несколько промежуточных вариантов смешали rollback-гипотезы с уже доказанным native write-path и временно вернули красные happy-path. Последняя линия снова строится от v23 и не возвращает недоказанный v24 `AuthLifecycle.is_running()`.

Свежий фактический PR #7 до этой смены уже ушёл до `2ef8f07b...` и содержит v26. V26 меняет только загрузку outer journal: `_load_outer_journal()` вызывает `ncm28_recover_atomic_write(...)` только если `ncm28_pending_atomic_write(path)` подтверждает реально оставшийся durable intent. Обычный crash/restart recovery не отключён: при наличии intent он идёт тем же путём. Цель — не заходить повторно в atomic recovery в обычном same-process rollback после уже успешно опубликованного журнала.

На свежем head CircleCI был временно оставлен только build-only, поэтому Windows-первопричина фактически не проверялась. В этой смене я вернул ровно четыре уже существующих интеграционных Windows-сценария для exact v26, не добавляя новой диагностики и не меняя продуктовый native write primitive.

Текущий commit: `eec28988ad29e7c43f661d9dc268e5a0743b8a58`.
CircleCI workflow: `6b88bc42-c690-42ca-a296-9985d27276d3`.
Jobs:
- `happy-running` — `dad1549c-965f-4734-9c0f-81c3772cc148`
- `happy-stopped` — `87626042-1ce2-4b35-ab54-4e2c7b9ddfde`
- `rerun-noop` — `6d792ed7-fb96-4f54-9f94-9c4f66160b10`
- `auth-rollback` — `4d965246-3b8a-4843-a3f7-523bfa6f1d63`

На момент записи все четыре выполняются. Дубликат не запускать.

Следующая смена сначала снимает эти четыре результата. Если все четыре зелёные — сразу отдельный Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`; после PASS считать NCM28 закрытым и больше не расширять файловую диагностику. Если три happy-path зелёные, а rollback красный — работать только с outer/auth rollback. Если красные и happy-path — сравнивать v23 с v26/harness; native write primitive не трогать без нового точного доказательства.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий фактический head на начало этой смены: `ccfad1a963e97e3e0d63d5fb8bb8a4ab39b87dec`.

Семь продуктовых контрактов на материализованном `server.py` ранее доказаны: два режима промпта, сохранение приватного prompt identity, настоящий Responses wiring, ранняя HTTP validation, account-pool parallelism, foreground routing и cooldown failover. `owner` не смешивается с инженерной персоной; runtime/tool-факты идут отдельным нейтральным слоем.

В ветке уже есть `tools/live_two_slot_codex_probe.py`: он проверяет две параллельные независимые foreground-задачи на разных легитимных слотах и sticky continuation после tool result. После закрытия NCM28 синхронизировать PR #8 со свежим Core и не останавливаться на синтетическом `probe_marker`: следующий пользовательский гейт — настоящий многошаговый Codex CLI сценарий с реальным локальным действием (`read/edit/bash` или эквивалент), возвратом tool result модели, следующим tool-вызовом и финальным продолжением. Затем проверить restart/recovery незавершённой цепочки и безопасный failover на новый Notion thread с полной локальной историей при недоступности владельца старого треда.

Production и живой Notion в этой смене не трогались; секреты не раскрывались.
