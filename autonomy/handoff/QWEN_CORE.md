# Qwen — агентное ядро

Обновлено: 2026-08-21 17:05Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Core-исправление было зафиксировано на `a77b882c98d52932c9382d301579012f00d4eec3`; текущий наблюдавшийся head PR уже `925682bc36338a249a26dae2c684380c21ba8db7`. `a77b882…` является его предком; последующие 8 коммитов меняют `qwen-client.js` и reliability-тесты, но не откатывают `session-store.js` и новый Core-regression.

Основные Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call фиксируется до выдачи клиенту, обычный assistant-text сохраняется, системные инструкции сохраняются в restart-пути, одинаковый `tool_call.id` не схлопывает несколько pending-вызовов, запросы одной OpenCode-сессии сериализуются. Stale-backup recovery работает fail-closed: восстановленная из `.bak` сессия не переиспользует старый `chatId` и требует явной полной сверки истории.

## Закрыто: stale-backup reconciliation больше не теряет системные инструкции

Ранее `isExplicitRecoveryHistory()` корректно проверял только non-system прогресс, но `reconcileRecoveredSession()` затем сохранял ровно входящую историю. Если клиент доказал более новый assistant/tool-прогресс, но не прислал system-сообщения, fallback-снимок мог потерять приватный prompt владельца и project rules.

Исправлено в `src/session-store.js`, commit `f1389a4283945ed35c2e3bbd9daf32d43e8a424a`:

- если в явной полной истории есть system-сообщения, они считаются актуальными и полностью заменяют старые;
- если system-сообщений во входящей истории нет, сохраняются system-блоки из восстановленного checkpoint;
- один и тот же объединённый набор используется и для нового долговечного checkpoint, и для текущего хода к модели;
- условия снятия `QWEN_SESSION_RECOVERY_UNCERTAIN` не ослаблены: всё ещё нужен более новый assistant/tool-прогресс и отсутствие pending tool-call.

Постоянный regression `scripts/session-recovery-system-preservation-test.js` добавлен commit `87275b7f8fecbee370c933682ade78a0f320dfbf`; в обычный `npm test` включён на head `a77b882c98d52932c9382d301579012f00d4eec3`. Он проверяет оба обязательных варианта: отсутствие system-блоков сохраняет старые owner/project instructions; явно присланные новые system-блоки заменяют старые и сохраняются долговечно.

Целевой hosted-проход логики дал:

`QWEN_STALE_RECOVERY_SYSTEM_TARGETED_PASS retained=1 explicit_replace=1`

Полный exact-tree `npm test` всего приватного репозитория в этом проходе не выполнялся и зелёным не объявляется.

## Параллельный writer после Core-фикса

После `a77b882…` другой исполнитель продвинул PR до `925682bc…`. Compare показывает `ahead_by=8`, `behind_by=0`; изменены только `package.json`, несколько reliability-тестов и `src/qwen-client.js`. Новый `session-recovery-system-preservation-test.js` остался в test-chain, а `session-store.js` содержит Core-исправление без отката. Узкую account/provider механику здесь не перехватывать.

## Постоянная память

Стартовый `LATEST` этого запуска: blob `637e4e59456b9898284cdd416979764ce1e6e45f`, capsule `20260821T155256Z-3e3db3ae97`, archive SHA-256 `ba78dc06533712417531280759c266ebe5bc8a8bdfcfb7cff124044dfcc6ca6c`. Он восстановлен exact нормативным `capsule_runtime_v4.py`; runtime Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Первая post-fix упаковка `20260821T165311Z-e0fccf79da` НЕВАЛИДНА: после immutable-upload перечитывание выявило несовпадение `part-0001`. Она не публиковалась как `LATEST`; не ремонтировать её поверх байтов и не использовать для restore.

Нормативно перепакован и проверен checkpoint `20260821T165444Z-2d8865f51c`, archive SHA-256 `ace06f2c01b033c39c114671c3fbe2c2e2fc0a3a0318d52b5b25266abe6b2510`. Manifest и оба part после upload перечитаны и совпали. Перед публикацией `LATEST` всё ещё имел исходный blob `637e4e…`, поэтому CAS прошёл штатно. Старый указатель сохранён в `PREVIOUS`; текущий `LATEST` указывает на `20260821T165444Z-2d8865f51c`.

## Граница доказанного

- Core system-preservation fix присутствует и на текущем наблюдавшемся PR-head `925682bc…`.
- Новый regression существует и включён в текущий `npm test`.
- Целевая логика проверена на ChatGPT-hosted машине без сети к Qwen.
- Полный exact-tree `npm test` не выполнялся: весь приватный репозиторий локально не материализован.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. На hosted-машине материализовать достаточный exact session/restart-кластер текущего PR-head и выполнить `session-recovery-system-preservation-test.js`, `session-store-restart-test.js`, `session-stale-backup-recovery-test.js`, `session-checkpoint-system-retention-test.js` и ближайшие pending/tool-result проверки — без hosted CI и без live Qwen.
2. Если кластер зелёный, искать следующий воспроизводимый дефект в Core: continuation после tool result, restart, system-prompt modes, subagents, skills или ошибки исполнения.
3. Узкую механику cooldown/account selection не перехватывать у reliability-worker, кроме нарушения Core-инварианта.
