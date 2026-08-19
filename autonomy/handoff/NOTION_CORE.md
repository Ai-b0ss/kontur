# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `18427776e1cbab1a94224254039134470fcaa160`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Build-cut на `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9` доказал: Windows executor, Python, зависимости, исходный manifest и общий builder исправны; v23 собирается, широкий v26 — нет. v26 не продвигать.

На свежем head `a4e60fdf19ad63341c602ea80829cdc09d1ee8c9` CircleCI workflow `e605107b-be50-4587-af4a-cbc6107b7bfa` снова дал FAILURE во всех пяти задачах, включая отдельный `ncm28-windows-build-v25`. Поэтому четыре integrated FAILURE опять не являются доказательством продуктового падения: v25 не успел материализоваться.

В этом запуске builder v25 переписан ещё уже: больше нет зависимости от точного однострочного форматирования объявления `_recover_outer_transaction()`. Функция находится по уникальной структурной границе, её сигнатура меняется целиком до `) -> UpgradeResult:`, загрузка журнала меняется только внутри тела этой функции, а coordinator rollback-call обязан встречаться ровно один раз. Семантика не расширена: база всё ещё v23; обычный crash/restart использует `_load_outer_journal()`, а только same-process `AUTH_ACTIVATION_FAILED` может передать уже опубликованный outer journal, который перед rollback повторно проверяется по точным canonical bytes. Native Windows write primitive не менялся.

Новый Core commit: `18427776e1cbab1a94224254039134470fcaa160`. CircleCI должен автоматически стартовать по существующей конфигурации; на момент записи статусы ещё не появились. Сначала снять именно `ncm28-windows-build-v25`. Если build зелёный, интерпретировать четыре integrated case. Если все четыре зелёные — сразу Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py` и закрыть NCM28. Если три обычных зелёные, а rollback красный — чинить только same-process rollback, не возвращаясь к native write primitive. Если build v25 снова красный — проблема всё ещё только в материализации v25, а не в продуктовой Windows-операции; не менять файловый слой вслепую.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Фактический свежий head: `5018836355acdfb50067c28f62a0fe647321a66b` (проверен в этом запуске). PR остаётся draft; base PR #8 ещё указывает на старый Core `a62833f...`, поэтому перед объединением агентной линии её надо синхронизировать со свежим Core.

Ветка содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing, cooldown failover и provider-neutral envelope для будущих дочерних задач. Старые синтетические контракты полезны как регрессия, но не являются пользовательским гейтом.

После закрытия NCM28 не добавлять ещё `probe_marker`. Следующий пользовательский гейт — настоящий Codex CLI во временном проекте: прочитать реальный файл -> получить tool result -> следующим модельным ходом изменить файл или выполнить безопасную локальную команду -> получить второй tool result -> проверить результат -> закончить обычную задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion не трогались; секреты не раскрывались.
