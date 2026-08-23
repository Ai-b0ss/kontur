# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний fresh product head: `747beb79d9f7f423c27e4b19c60949da83206b0b`.

Перед любой новой записью снова перечитать PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9, Circle policy и QWEN_CORE `LATEST.json`.

## Закрыто в этом проходе — required-tool reasoning leak
На предыдущем head `2611b67fa01a0d939dc05821c21e163b36dc8ed1` при `requireToolCall=true` обычный `content` уже удерживался до полноценного tool-call, но `reasoning_content` и текст из `<think>...</think>` обходили этот барьер и шли напрямую в `onData()`.

Root fix:
- commit `42dbc2df3aa290a0eaa2a503bdf1bd33d9becdce`;
- все reasoning/thinking SSE-дельты в `parseQwenSSE()` теперь проходят через тот же `emitData()` gate, что обычный content;
- отвергнутый required-tool ответ не выпускает reasoning клиенту;
- после принятия полноценного tool-call накопленный reasoning выпускается вместе с принятым ходом;
- parser/account/cooldown/provider-circuit не менялись.

Targeted hosted semantic check без provider/CI:
`TOOL_REQUIRED_REASONING_LEAK_TARGET_PASS rejected_reasoning=2 accepted_reasoning=1`.

Постоянный regression `scripts/tool-required-reasoning-leak-test.js` больше не standalone: commit `747beb79d9f7f423c27e4b19c60949da83206b0b` подключил его в штатный `npm test` сразу после `tool-required-terminal-frame-test.js`.

Fresh compare `2611b67...747beb79` показывает только:
- `src/chat-adapter.js` — root fix;
- `package.json` — wiring regression в `npm test`.

Полный exact-tree `npm test` этим targeted proof НЕ заменяется и пока PASS не заявлен.

## CircleCI freeze — новый owner override
Issue #9 содержит более свежую директиву владельца `OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23`: до отдельного явного сообщения владельца полностью запрещено запускать CircleCI для Qwen/Notion/Kontur, двигать disposable gate branches ради запуска и тратить credits. Это временно сильнее общей `autonomy/ci/CIRCLECI_GATE_POLICY.md`.

Поэтому:
- CircleCI в этом проходе = 0;
- final Linux/Windows Circle gate не запускать до явной разморозки;
- когда все локальные/exact prerequisites будут зелёными, состояние обозначать `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`, а не запускать gate самовольно.

## Targeted Core evidence, которое сохраняет силу
- plain-subagent exact cluster на ранее соответствующих байтах: `subagent dispatcher: PASS`;
- owner/session/restart кластер ранее закрывает owner authority, большой owner/system checkpoint, stale-backup fail-closed, tool-result progress и pending multi-tool restart;
- required-tool terminal-frame regression уже в `npm test`;
- reasoning-leak invariant теперь root-fixed и regression тоже в `npm test`.

Без нового контрпримера не открывать заново:
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- owner/system checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация внешнего system-prompt mode/owner aliases;
- direct agent/coding-subagents/plain subagents strict owner/engineer validation;
- internal prompt-mode bounded-error regressions;
- local tool `Error:` contract и required-argument validation;
- capability mode preflight;
- durable owner authority type validation;
- required-tool terminal frames и parser reset.

## Координация с QWEN_RELIABILITY
Fresh Reliability handoff/issue evidence:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- остаётся exact `scripts/provider-safety-test.js` на locked dependency tree (`axios` отсутствует в hosted filesystem; semantic stub PASS запрещён).

Core не трогает account-store/cooldown/provider-circuit. Перед общим экзаменом снова fresh-read Reliability и PR head.

## Следующий точный порядок
1. Fresh-read PR #6 head и Reliability. Если Core bytes не изменились — не повторять уже закрытый reasoning fix.
2. На текущем stable SHA материализовать максимально точный stream/session/restart cluster и прогнать как минимум:
   - `tool-required-reasoning-leak-test.js`;
   - `tool-required-terminal-frame-test.js`;
   - `tool-stream-truncation-test.js`;
   - ближайшие stream lifecycle/restart/session pending-tool regressions.
3. Закрыть Reliability exact `provider-safety-test.js` только на настоящем locked dependency tree.
4. Когда Core + Reliability targeted green на одном стабильном SHA — выполнить полный exact-tree Linux `npm test` доступным бесплатным executor/local surface.
5. Если после этого обязательный следующий шаг только Circle — выставить `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE` и ждать явной разморозки. Не запускать Circle самостоятельно.
6. После owner release: один native Windows Server 2022 Circle gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
7. Только после Linux + native Windows green создавать Windows owner doctor/acceptance harness. Раньше не создавать.

`QWEN_CORE_DONE` пока нет: full exact-tree Linux PASS, Reliability provider-safety exact PASS, native Windows PASS и проверенный owner-doctor ещё отсутствуют.

## Постоянная память / v4 CAS
Нормативный runtime fresh-read: `autonomy/v3/tools/capsule_runtime_v4.py`, Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Текущий `LATEST` fresh-read:
- capsule `20260822T230801Z-b2fff032a7`;
- archive SHA-256 `72602c3feae0ad139e4b17bc4e8b004ecf26e6796d704b45af9145803aa595fb`;
- pointer blob `0fb9c8b2deb1d947c64a40db7e88b5905eb4edde`;
- source_ref старой capsule `2611b67fa01a0d939dc05821c21e163b36dc8ed1`.

В этом проходе новую v4 capsule пока НЕ опубликована: нормативный runtime был fresh-read exact из GitHub, но текущая hosted filesystem не получила его побайтно идентичную локальную копию для обязательного `pack -> verify -> restore`; приблизительную/ручную реализацию v4 использовать запрещено. Force-write/CAS обход не применялся. Следующий проход при exact materialization должен сначала сверить `LATEST` blob с `0fb9c8b2...`, затем pack/verify/restore и публиковать только через CAS.

Live/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе не использовались.
