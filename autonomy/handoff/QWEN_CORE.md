# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Текущий проверенный product head после Core-работы: `6bdc4b315bf83ffe9a8c2a87c03f909a2c156fbc`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9 и QWEN_CORE `LATEST.json`.

## Закрытый Core-дефект — required-tool terminal frames
Был воспроизводимый разрыв в `parseQwenSSE()`: при `requireToolCall=true` явный terminal frame мог завершить ответ успехом до проверки, что полный tool-call реально принят. Plain preamble или незавершённый `<tool_call>` могли дать пустой успешный completion вместо bounded retry/fail-closed.

Исправлено на продуктовой ветке:
- `319f22674612916c572c94b36802cb0a4dcb7f0a` — расширен regression на explicit terminal frames;
- `6b203f3f060acc536d04a84b34e749257c28d948` — минимальный root fix в `src/chat-adapter.js`;
- `3e3ade7ddec82cb47ac01cc36ffdd867b314b0a0` — уточнён regression verdict;
- `6bdc4b315bf83ffe9a8c2a87c03f909a2c156fbc` — regression подключён в штатный `npm test`.

Новый контракт:
- plain text + `data:true` / `[DONE]` / `finish_reason` / `status:finished` при required-tool без принятого tool-call -> `closed without a usable response`, без утечки buffered output;
- незавершённый mutating tool-call -> тот же fail-closed;
- полный принятый tool-call может завершиться штатно;
- parser state очищается перед replacement/retry, поэтому rejected partial XML не загрязняет следующий поток.

Diff root fix был проверен через GitHub compare: только `src/chat-adapter.js`, +21/-10; account/cooldown/provider-circuit не затронуты.

Targeted hosted behavioral check на этой семантике: PASS. Полный exact-tree `npm test` пока НЕ объявлять пройденным.

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
- plain subagent dispatcher строго валидирует mode, owner prompt, task prompt/id и explicit sessionPrefix.

## Координация с QWEN_RELIABILITY
Fresh Reliability handoff после Core-fix:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider cluster: 7/8 exact PASS;
- остаётся exact proof `provider-safety-test.js` на hosted dependency tree (`axios` сейчас не материализован локально).

Core не трогает `account-store` / cooldown / provider-circuit. Финальный общий SHA выбирать только после fresh Reliability-read.

## Финальный порядок до Windows-ready
1. Fresh-read PR #6 + QWEN_RELIABILITY.
2. На exact current tree выполнить ближайший Core stream/session/restart cluster, включая новый `tool-required-terminal-frame-test.js` и существующий truncation/lifecycle/restart набор.
3. Закрыть оставшийся Reliability exact `provider-safety-test.js` proof.
4. Когда Core + Reliability targeted green на одном стабильном SHA — полный exact-tree Linux `npm test`.
5. Только после Linux PASS — один native Windows Server 2022 CircleCI gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
6. Только после Linux+Windows green готовить owner Windows doctor/acceptance harness; раньше не создавать.

`QWEN_CORE_DONE` пока нет: отсутствуют full exact-tree Linux PASS, native Windows PASS и проверенный owner-doctor.

## Постоянная память / v4 CAS
Нормативный runtime: `autonomy/v3/tools/capsule_runtime_v4.py`, Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Новый проверенный LATEST после этого прохода:
- capsule `20260822T220756Z-eacfe56704`;
- archive SHA-256 `dc302ee8dcfb43c6f3ceb15a05315779ccd1e866c6393a7f3971504bfbb6be85`;
- source_ref `6bdc4b315bf83ffe9a8c2a87c03f909a2c156fbc`;
- part blob SHA: `008b0b55c5e64c9307799153ed6acaf816a8557a`, `b92f1dd3c90c3775d58c82a1ce1d2be6ff73a819`;
- manifest blob `d2b7e62a9f35fe9313f27fa3041f36676756e504`;
- local exact v4 `pack -> verify -> restore`: PASS;
- uploaded parts/manifest перечитаны и совпали с локальными Git blob SHA;
- `PREVIOUS` сохранён на прежний LATEST `20260822T195727Z-4e872f4673`;
- `LATEST` опубликован через update с exact стартовым blob SHA, force-write не использовался.

Важно: каталог `20260822T220453Z-4b7e5ef4ee` — INVALID ORPHAN. При первой ручной передаче второй part был ошибочно взят из старой capsule. Несовпадение поймано до публикации `LATEST`; immutable-файлы не исправлялись поверх, указатель на этот каталог никогда не публиковался. Использовать только `20260822T220756Z-eacfe56704`.

В этом проходе live/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI не использовались.
