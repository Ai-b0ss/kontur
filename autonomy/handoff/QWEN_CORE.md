# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `adb84d33290008f63f04c2fa543565143381ba2a`, PR остаётся draft/open и `mergeable=false` относительно текущего `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. В этом запуске исходники `orchestrator/cache.mjs` заново просмотрены; новых изменений там не понадобилось.

Что сделано сейчас:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff, живые PR и исходники обоих Qwen-репозиториев. Старый handoff уже был устаревшим: до начала работы PR #6 дошёл до `6a62bd5c…`; последние изменения развивают metadata/catalog skills, а не откатывают агентное ядро.
- Закрыта найденная ранее граница eligibility для V3/vision. До исправления `server.js` мог передать в раннюю V3-подготовку `accountStore.current()`, даже когда этот активный аккаунт уже был в cooldown и список `candidates()` был пуст. Основной `qwen-client` фильтрует такие аккаунты позже, но браузерный vision работает раньше и мог начать работу с уже запрещённым аккаунтом.
- В `src/qwen-v3-capabilities.js` добавлен `resolveCapabilityAccount()`. Если сервер передал аккаунт, он принимается только когда `accountStore.isAvailable(account)`; иначе берётся первый настоящий кандидат. Если подходящих аккаунтов нет, подготовка завершается `QWEN_NO_ELIGIBLE_ACCOUNT` до vision/браузера и без provider traffic.
- Обычные офлайн-вызовы capability-layer без поля `ctx.account` не ломаются: новая проверка включается только для серверного пути, где account уже был выбран.
- `scripts/account-selection-policy-test.js` усилен двумя регрессами: cooled-down active account заменяется на первый разрешённый кандидат; при cooldown всех аккаунтов V3 обязан fail-closed и не «оживлять» `current()`.

Коммит этого запуска в `qwen-free-api`:
- `adb84d33290008f63f04c2fa543565143381ba2a` — `fix: keep V3 preprocessing off cooled-down accounts`.

Что проверено:
- PR #6 после записи действительно указывает на `adb84d33…`.
- Новый regression входит в уже существующий `npm test` через `account-selection-policy-test.js`; package scripts менять не пришлось.
- `qwen-client` по-прежнему делает bounded failover только по `accountStore.candidates()` и не считает CAPTCHA конкретного аккаунта provider-wide отказом.
- CAPTCHA-ротация, account/thread affinity, многошаговый tool-loop, checkpoint, skills и два режима system prompt этим изменением не ослаблялись.
- `qwen-workspace` PR #5 остаётся на `468733b2…`, `mergeable=true`.
- Новый живой запрос к Qwen не запускался; прежний разрешённый provider-run не дублировать вслепую.
- GitHub status для exact head `adb84d33…` пока не показывает фактический CircleCI result, поэтому полный regression зелёным не объявлять без реального результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `adb84d33…`; если красный — чинить конкретную ошибку, не откатывая CAPTCHA-ротацию и account/thread семантику.
2. После green проверить аналогичный fallback в `src/agent.js`: при новой работе там ещё есть `accountStore.candidates()[0] || accountStore.current()`. Он не должен resurrect-ить cooldown account; нужен fail-closed выбор и отдельный офлайн-регресс.
3. После зелёного офлайн-набора — один bounded Windows offline parity на exact продуктовой линии без provider traffic.
4. Затем восстановить результат прежней разрешённой live-попытки. Второй provider-run вслепую не запускать.
5. Если прежняя попытка до провайдера не дошла, провести ровно один живой многошаговый проход `read_file → Qwen → tool result → bash → Qwen → final`, затем проверить restart и безопасный failover незавершённой цели.
6. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret-bridge/checkpoint решения.
