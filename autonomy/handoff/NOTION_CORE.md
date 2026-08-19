# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `eef8bc7994bd6898f4963ffc5791ba9db7c57c0f`.

## NCM28

Последняя доказанная хорошая продуктовая база — v23: `happy-running`, `happy-stopped` и `rerun-noop` на настоящем Windows ранее проходили; отдельно оставался `auth-rollback`. Native write primitive v23 без нового точного доказательства не менять.

Build-cut на предыдущем head `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9` завершён и дал жёсткую границу:
- deps — SUCCESS;
- import полной цепочки v26 — SUCCESS;
- exact manifest/source identity — SUCCESS;
- сборка последней доказанной v23 — SUCCESS;
- сборка v26 — FAILURE.
Workflow: `63a1c509-c783-4c86-83f6-04f1aa3bac00`.

Следовательно, Windows executor, Python, зависимости, исходный manifest и общий builder/materialization исправны. Дефект находится строго в самом v26 patch. v26 меняет `_load_outer_journal()` глобально, добавляя вызов `ncm28_pending_atomic_write`; этот вариант не продвигать.

Вместо расширения диагностики запущен уже существующий узкий v25, построенный непосредственно от доказанной v23. Он меняет только same-process rollback после `AUTH_ACTIVATION_FAILED`: использует уже опубликованный outer journal лишь после повторной побайтовой проверки canonical-файла. Нормальный crash/restart по-прежнему идёт через обычный `_load_outer_journal()`.

Текущий Core commit `eef8bc79...` меняет только CircleCI-конфигурацию проверки. Workflow `b7c648e5-4912-44ca-9a75-a67c35a99be3` запущен на настоящем Windows и содержит пять задач:
- build v25 — job `7f0bd01a-06bb-47c1-bcb6-368fe4dc53d2`;
- happy-running — `ff55f993-1861-429c-a575-5a97df7dd031`;
- happy-stopped — `5a703a20-ce65-4bfb-ac62-db61118d8fca`;
- rerun-noop — `8ceed796-0dfb-4d09-a6a8-d147d21bf163`;
- auth-rollback — `1b312802-e0e8-48c7-9add-4b4a164661dd`.
На момент передачи все пять выполняются; дубликаты не запускать.

Следующий шаг: снять эти пять результатов. Если все четыре integrated case зелёные — сразу проверить Windows `tests.test_crash_recovery` и полный `RUN_NCM28_LOCAL_VERIFY.py`, затем закрыть NCM28. Если три обычных зелёные, а rollback красный — исправлять только same-process rollback v25. Если уже build v25 красный — локализовать только его preimage/patch, не возвращаться к native write primitive.

## Codex / агентная ветка

PR #8: `autonomy/notion-prompt-modes-20260819`.
Свежий фактический head: `61100e2bac7e2f87684c7a5976557f744e15a3ee` (старые head в карте устарели).

На exact head все четыре текущих CircleCI-контракта зелёные, workflow `35f42289-d683-40ef-bd4c-ba14fa61ee79`: prompt, routing, agent и delegation. Ветка содержит материализованный Responses wiring режимов `engineer/owner`, foreground reservations, lease-level routing, cooldown failover и provider-neutral envelope для будущих дочерних задач.

Главный оставшийся пробел тот же: `tools/live_two_slot_codex_probe.py` пока синтетический и использует `probe_marker`. После закрытия NCM28 следующий пользовательский гейт — настоящий Codex CLI во временном проекте: прочитать реальный файл -> получить tool result -> следующим модельным ходом изменить файл или выполнить безопасную локальную команду -> получить второй tool result -> проверить результат -> закончить обычную задачу. Затем restart/recovery незавершённой цепочки и failover: пока владелец Notion thread доступен, continuation остаётся на нём; при недоступности создаётся новый Notion thread другого допустимого слота с полной локальной историей, старый thread ID между аккаунтами не переносится.

Production и живой Notion не трогались; секреты не раскрывались.
