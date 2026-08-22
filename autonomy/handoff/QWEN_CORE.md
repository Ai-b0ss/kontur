# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний fresh product head: `2611b67fa01a0d939dc05821c21e163b36dc8ed1`.

Перед любой новой записью снова перечитать PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9 и QWEN_CORE `LATEST.json`.

## Новый открытый Core RED — reasoning leak до обязательного tool-call
На предыдущем product head `6bdc4b315bf83ffe9a8c2a87c03f909a2c156fbc` `parseQwenSSE()` уже fail-closed для terminal frames при `requireToolCall=true`, но буферизует только обычный `content`. `reasoning_content` и текст из `<think>...</think>` всё ещё идут напрямую в `onData()` до принятия полного tool-call.

Следствие: required-tool turn может затем правильно завершиться `closed without a usable response`, но клиент уже успел получить reasoning/thinking. Это нарушает тот же invariant, который держит `tool-required-terminal-frame-test.js`: отвергнутый required-tool ответ не должен выдавать клиенту никаких частей результата до принятия инструмента.

Зафиксирован отдельный намеренно RED regression:
- commit `2611b67fa01a0d939dc05821c21e163b36dc8ed1`;
- файл `scripts/tool-required-reasoning-leak-test.js`;
- проверяет `reasoning_content + terminal`, `<think> + terminal` и положительный случай `reasoning -> complete read_file tool_call`.

Regression пока намеренно НЕ подключён к `npm test`: root fix ещё не внесён. Это не «забытый standalone» — следующий Core-проход обязан сначала закрыть root cause, получить targeted green и сразу после этого включить regression в штатный `npm test`.

Минимальный root fix локализован в `src/chat-adapter.js`: все reasoning/thinking SSE-дельты внутри `parseQwenSSE()` должны проходить через тот же `emitData()`-gate, что и обычный content. Тогда при `requireToolCall=true` reasoning хранится до принятия tool-call, выпускается вместе с принятым tool-call, а при terminal rejection полностью отбрасывается. Не менять tool parser, account/cooldown/provider-circuit.

В этом проходе большой `chat-adapter.js` не переписывался через Contents API: доступный интерфейс требует полную замену файла, а безопасного line-patch primitive нет. Реконструировать 39 КБ активно меняющегося файла вручную запрещено. Следующий проход должен fresh-read exact blob и применить изменение только побайтно безопасным способом; если такого способа нет, не делать approximate replacement.

## Targeted Core proof на fresh tree
На product head `6bdc4b315...` локально на машине ChatGPT материализованы exact Git blobs и реально выполнен `scripts/subagent-dispatcher-test.js`:
- `src/config.js` blob `e6bfdf206c0ee60bb7faecf398add28500f3993d`;
- `src/subagent-dispatcher.js` blob `ad3cc72c7a317c5d2ed8aed2ea13f9f2d4f6d721`;
- `scripts/subagent-dispatcher-test.js` blob `fa146bc9bb6fa61dbba89f4f88684388e45e43a0`;
- verdict: `subagent dispatcher: PASS`.

Это подтверждает plain-subagent fail-closed validation для prompt/id/mode/owner prompt/sessionPrefix и отсутствие provider calls в негативных сценариях. После добавления RED-test продуктовый код Core не менялся, поэтому этот targeted PASS сохраняет силу для соответствующих файлов.

## Уже закрыто — без нового контрпримера не открывать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация внешнего system-prompt mode/owner aliases;
- direct agent/coding-subagents и plain subagents строго валидируют owner/engineer и private prompt;
- internal prompt-mode bounded-error regressions входят в `npm test`;
- local tool errors используют `Error:`-контракт;
- required tool arguments валидируются до handler;
- ordinary Qwen capability mode валидируется строго до мутаций сессии;
- durable owner authority не приводит object/number/array через `String(...)`;
- plain subagent dispatcher строго валидирует mode, owner prompt, task prompt/id и explicit sessionPrefix;
- required-tool terminal frames для plain content/partial tool уже fail-closed и regression подключён в `npm test`.

## Координация с QWEN_RELIABILITY
Fresh Reliability handoff до нынешнего Core RED:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider cluster: 7/8 exact PASS;
- остаётся exact proof `provider-safety-test.js` на hosted dependency tree.

Core не трогает `account-store` / cooldown / provider-circuit. Финальный общий SHA выбирать только после fresh Reliability-read.

## Финальный порядок до Windows-ready
1. Fresh-read PR #6 + QWEN_RELIABILITY.
2. Закрыть `tool-required-reasoning-leak-test.js`: минимальный root fix -> targeted green -> сразу подключить regression в `npm test`.
3. На одном stable exact head выполнить Core stream/session/restart cluster, включая terminal-frame + reasoning-leak + truncation/lifecycle/restart.
4. Закрыть оставшийся Reliability exact provider proof.
5. Когда Core + Reliability targeted green на одном стабильном SHA — полный exact-tree Linux `npm test`.
6. Только после Linux PASS — один native Windows Server 2022 CircleCI gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
7. Только после Linux+Windows green готовить owner Windows doctor/acceptance harness; раньше не создавать.

`QWEN_CORE_DONE` пока нет: открыт новый воспроизводимый Core RED и отсутствуют full exact-tree Linux PASS, native Windows PASS и проверенный owner-doctor.

## Постоянная память / v4 CAS
Нормативный runtime: `autonomy/v3/tools/capsule_runtime_v4.py`, Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Входной LATEST этого прохода был `20260822T220756Z-eacfe56704`, archive SHA-256 `dc302ee8dcfb43c6f3ceb15a05315779ccd1e866c6393a7f3971504bfbb6be85`, blob указателя `25d5d1660d1cd9b8425b2e35d3d9fc8fb91ea9d8`; exact v4 `verify + restore` прошли.

Новый опубликованный checkpoint:
- capsule `20260822T230801Z-b2fff032a7`;
- archive SHA-256 `72602c3feae0ad139e4b17bc4e8b004ecf26e6796d704b45af9145803aa595fb`;
- source_ref `2611b67fa01a0d939dc05821c21e163b36dc8ed1`;
- part blobs после reread: `fe8a7cd9732a8f8165359106ab17575050e8a234`, `43eaa36f84258a24bc3be09fe0be5b202a4ad155`;
- manifest blob `fb700dfc9a22dc513c8448857325213db8e58417`;
- local exact v4 `pack -> verify -> restore`: PASS;
- старый LATEST сохранён в `PREVIOUS`;
- новый LATEST опубликован через CAS от exact стартового blob, force-write не использовался;
- новый LATEST blob `0fb9c8b2deb1d947c64a40db7e88b5905eb4edde`.

В этом проходе live/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI не использовались.
