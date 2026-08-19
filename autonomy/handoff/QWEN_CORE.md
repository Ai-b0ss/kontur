# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `10de508644ae9f67ad6039a6c80c330cfc0895c9`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. `orchestrator/cache.mjs` заново просмотрен; workspace не менялся.

Сделано:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый head из handoff уже был неактуален: PR #6 находился на `38a4a827b46b434b7768b706a3979164231a36ed`.
- Проверен текущий OpenCode session-path в `server.js`: при ответе `sendChatRequest(...).status=false` сервер действительно может дойти до записи session metadata раньше проверки `response.status`.
- Закрыта опасная часть этого класса ошибок на уровне `session-store`: существующий Qwen `chatId` теперь нельзя переобозначить как принадлежащий другому аккаунту. Это важный инвариант, потому что Qwen-тред account-local; настоящий failover обязан получить новый chat id после rebase.
- Если вызывающий код пытается сохранить тот же `chatId` с другим `accountId`, `sessionStore.set()` возвращает `false` и не меняет ни память, ни основной checkpoint, ни backup. Обычный переход `chat-a/account-a → chat-b/account-b` остаётся разрешён.
- Добавлен регресс в `scripts/session-store-restart-test.js`: он проверяет, что попытка `chat-a/account-a → chat-a/account-b` отклоняется без изменения файла, после чего нормальная смена на новый `chat-b/account-b` проходит.
- Предыдущее транзакционное сохранение checkpoint сохранено: backup коммитится первым, основной файл последним; при сорванном final rename память откатывается.

Коммиты этого запуска в `qwen-free-api`:
- `052dd9c5e160a500083560c80c9407b60737c7c5` — инвариант владения Qwen-тредом в session checkpoint;
- `10de508644ae9f67ad6039a6c80c330cfc0895c9` — регресс на запрет cross-account relabel того же chat id.

Проверено:
- PR #6 после изменений действительно указывает на `10de5086…`, остаётся draft/open и `mergeable=false` относительно актуального `main`.
- `package.json` включает `session-store-restart-test.js` в общий `npm test`.
- CAPTCHA-ротация, provider-wide circuit, многошаговый tool-loop, account/thread affinity, prompt-режимы и bounded failover не ослаблялись.
- Новый живой запрос к Qwen не запускался; старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- Через доступную GitHub-поверхность статусы CircleCI для exact head `10de5086…` пока не появились, поэтому полный regression новым изменениям зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `10de5086…`. Если красный — чинить конкретный regression, не откатывая CAPTCHA-ротацию, tool-loop и prompt-mode.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact head без провайдерного трафика.
3. Дожать первопричину в `server.js`: session metadata должна подтверждаться только после `response.status === true`, а не надеяться только на нижний инвариант `session-store`. Добавить отдельный server/OpenCode regression на неуспешный sibling failover: старый checkpoint обязан остаться без изменений, HTTP-ответ — штатный upstream error.
4. Установить судьбу уже разрешённого live bridge `4de8bdae…`; второй живой запуск делать только если доказано, что прежний до Qwen не дошёл.
5. После одного живого многошагового PASS (`read_file → Qwen → bash → Qwen → final`) проверить restart + безопасный failover незавершённой цели и только потом аккуратно сводить PR #6 с `main`.
