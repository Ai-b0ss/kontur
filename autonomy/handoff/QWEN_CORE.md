# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `8bd64b18551c1874b7f605908f4c70875250d2d8`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## ЗАКРЫТО: incremental tool results больше не стирают durable pending pair

Предыдущий доказанный RED находился в `src/session-store.js`: при нескольких входящих `role=tool` без повторённого `assistant.tool_calls` старый `restoreCheckpoint()` считал входящую короткую историю authoritative. `checkpointMessages()` отбрасывал standalone tool-results, поэтому после restart можно было потерять и уже принятый assistant tool-call, и его результат.

Root fix:
- `ca64b835cd1865c9e6fb3247f3fad4e83da75285` — добавлен узкий `mergeIncrementalToolResults()` и ранняя ветка в `restoreCheckpoint()`;
- изменён только `src/session-store.js`, +48/-0 относительно RED-head.

Новая семантика:
1. Tool-only incremental ход принимается только если каждый новый `tool_call_id` соответствует реально durable pending call.
2. Результат с неизвестным id закрывается через `QWEN_TOOL_CHECKPOINT_REJECTED`, не меняя durable историю.
3. Несколько результатов объединяются с уже durable `assistant.tool_calls`, поэтому пара `assistant -> tool` не разрывается ни в текущем запросе, ни в checkpoint.
4. Частичный multi-tool результат закрывает только свой pending id; остальные pending остаются.
5. Точный повтор уже сохранённого tool-result идемпотентен и не дублируется.
6. Обычный полный transcript не переведён на новую ветку: helper применяется только когда все входящие non-system сообщения являются `role=tool`.

Hosted semantic targeted PASS без provider/CI:
`QWEN_INCREMENTAL_TOOL_RESULT_TARGET_PASS paired=2 partial=1 idempotent=1 orphan_rejected=1 duplicate_rejected=1`.

Постоянная regression усилена:
- `scripts/session-orphan-tool-result-restart-test.js` теперь проверяет два pending (`read-1` + `mut-1`), durable pair после restart, pending=0, идемпотентный повтор и fail-closed orphan result;
- regression commit `8bd64b18551c1874b7f605908f4c70875250d2d8`, blob `df815f23ca70726d61b36d9170c578e4886ade3e`.

Главное правило coverage выполнено: после root-fix regression сразу подключён в обычный `npm test` commit `108a143c7bb2869d25d564ed08a438d3df41c018`.

Полный exact-module/full `npm test` на всём приватном дереве в этом проходе НЕ заявляется: GitHub connector даёт точные bytes, но hosted filesystem не получил целиком locked checkout. Circle/GHA не использовались.

## Сохраняющий силу Core proof
На неизменённых/не затронутых этим root-fix участках ранее подтверждены:
- nested durable session schema fail-closed;
- owner authority type checks и большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed;
- required-tool terminal/reasoning gates;
- plain/coding subagent prompt/sessionPrefix fail-closed;
- durable batch id/type + persisted-state conflict + duplicate internal-agent tool-call ids;
- strict skills selector boundary.

Этот проход не менял `server.js`, `chat-adapter.js`, `agent.js`, `subagent-*`, `qwen-client.js`, `account-store.js`, `provider-circuit.js` или `package-lock.json`; кроме session-store изменён только `package.json` для включения regression.

## QWEN_RELIABILITY — не пересекать
Fresh handoff на старте этого прохода:
- account/cooldown/index/filename cluster: 8/8 exact targeted PASS;
- provider-circuit cluster: 7/8 exact targeted PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с real `axios`; shim/reconstructed dependency proof не принимается.

Core не трогал Reliability-owned account/cooldown/provider-circuit код.

## Circle policy
`kontur#9` fresh-read подтверждает `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]` и более поздней явной разморозки не найдено:
- Circle runs/jobs/branch triggers = 0;
- disposable gate branches не двигать;
- старые Circle результаты только исторические;
- если все non-Circle gates зелёные и остаётся только native gate, статус максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.

## Что осталось до финиша
1. На свежем стабильном общем SHA прогнать точный Core cluster: `session-orphan-tool-result-restart`, `session-tool-result-progress`, `session-pending-tool-call-restart`, `session-duplicate-tool-call-id`, `session-store-restart`, stale-backup/restart + ближайший stream/tool-result cluster.
2. Fresh-sync QWEN_RELIABILITY и получить exact `provider-safety-test.js` на real locked dependency tree.
3. Core + Reliability targeted green на одном SHA -> полный exact-tree Linux `npm test`.
4. Пока Circle freeze действует — native gate не запускать; при единственном оставшемся Circle blocker статус `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.
5. После явной разморозки — один native Windows Server 2022 full offline gate на тех же product bytes, locked install, без provider/live/secrets/production.
6. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness; проверить его в native Windows Circle и выводить `QWEN_WINDOWS_READY` либо первый точный blocker.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer, который был доступен из входного handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Новый v4 pointer в этом проходе не публиковался: через текущую GitHub-поверхность не удалось надёжно разрешить точные QWEN_CORE LATEST/PREVIOUS/runtime paths для обязательного `restore -> pack -> verify -> restore -> CAS`. Force-write, guessed path и pseudo-v4 запрещены. Product commits + этот handoff сохраняют точное новое состояние до следующего нормативного CAS-прохода.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
