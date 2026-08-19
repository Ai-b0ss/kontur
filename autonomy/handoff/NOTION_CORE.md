# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `0eddec1ee2c2e4e6036ec993adfe5511a02ca4ed`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Build-cut на `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9` уже доказал: Windows executor, Python, зависимости, исходный manifest и общий builder исправны; v23 собирается, а широкий v26 — нет. v26 не продвигать.

Следующий v25 workflow `b7c648e5-4912-44ca-9a75-a67c35a99be3` завершился: все пять задач FAILURE, включая отдельный `ncm28-windows-build-v25`. Поэтому четыре integrated FAILURE нельзя считать четырьмя продуктовыми падениями — они не дошли до сценария, потому что сам v25 не материализовался.

Причина в самом v25 builder: патч входа `_recover_outer_transaction()` был привязан к большому многострочному preimage. На новом head `0eddec1e...` builder переписан так, чтобы менять три маленьких однозначных якоря с `count == 1`: объявление функции, загрузку outer journal и конкретный rollback-callsite. Семантика не расширена: база всё ещё v23; обычный crash/restart идёт через `_load_outer_journal()`, а только same-process `AUTH_ACTIVATION_FAILED` может передать уже опубликованный outer journal, который перед rollback повторно проверяется по точным canonical bytes. Native Windows write primitive не менялся.

CircleCI на `0eddec1e...` должен стартовать автоматически по существующей конфигурации. Сначала снять его статусы. Если build v25 зелёный, интерпретировать четыре integrated case. Если все четыре зелёные — сразу Windows `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py` и закрыть NCM28. Если три обычных зелёные, а rollback красный — чинить только same-process rollback, не возвращаясь к native write primitive. Если build v25 снова красный — локализовать только оставшийся builder preimage; продуктовый NCM28 ещё не запускался.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Последний подтверждённый head в предыдущей передаче: `61100e2bac7e2f87684c7a5976557f744e15a3ee`; перед работой заново проверить фактический head.

На том head четыре текущих CircleCI-контракта были зелёными: prompt, routing, agent и delegation. Ветка содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing, cooldown failover и provider-neutral envelope для будущих дочерних задач.

После закрытия NCM28 не добавлять ещё синтетические `probe_marker`. Следующий пользовательский гейт — настоящий Codex CLI во временном проекте: прочитать реальный файл -> получить tool result -> следующим модельным ходом изменить файл или выполнить безопасную локальную команду -> получить второй tool result -> проверить результат -> закончить обычную задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion не трогались; секреты не раскрывались.
