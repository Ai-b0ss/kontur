# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `3b89f83cc4cd4ceddbb1d63ac034eee529d0922b`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. Workspace в этом запуске не менялся.

Сделано:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый handoff был неактуален: PR #6 уже находился на `647ec7ada79518e5515dfb6505e50a5712aad7a9`.
- Найден реальный дефект агентного потока: если CAPTCHA/WAF-ошибка приходила уже внутри активного SSE, `runTurn()` пытался восстанавливать `accountStore.current()`. При балансировке/ротации текущий UI-аккаунт мог отличаться от аккаунта, который реально владел Qwen-тредом, поэтому CAPTCHA могла быть приписана не тому аккаунту.
- `src/agent.js` теперь переносит `qwenAccountId` с фактического upstream response на потоковую ошибку и использует именно этот аккаунт для CAPTCHA recovery.
- Для обычной CAPTCHA активного agent-stream теперь вызывается локальный `markCaptchaChallenge()` на точном аккаунте, не открывается provider-wide circuit, а старый upstream `chatId/accountId` очищается. Локальная история сообщений и tool-result остаётся, поэтому следующий допустимый аккаунт сможет начать свежий тред с полным rebase без смешивания владельцев.
- Добавлен `scripts/agent-captcha-owner-test.js`: current/UI специально равен B, реальный upstream принадлежит A; тест требует cooldown/recovery только A и проверяет, что challenged thread не остаётся закреплённым.
- Новый тест включён в общий `npm test`.

Коммиты этого запуска в `qwen-free-api`:
- `8811358a62d899993328fdff2784a39a5a889616` — точная атрибуция streamed CAPTCHA к владельцу response;
- `42048d6bc620e48443bd1afd3fb0bae85101cab6` — первичный регресс владельца CAPTCHA;
- `a6d58484ba71635bda6c848ac8f38051d84bf2a0` — тест включён в `npm test`;
- `8040cae598ef3fbdb94cd637c49a5bc66e31499e` — challenged account уходит в локальный CAPTCHA cooldown, старый тред карантинится;
- `3b89f83cc4cd4ceddbb1d63ac034eee529d0922b` — регресс усилен проверкой cooldown + очистки thread ownership.

Проверено:
- PR #6 действительно указывает на `3b89f83c…`, остаётся draft/open и `mergeable=false` относительно актуального `main`.
- `qwen-workspace` PR #5 заново сверён: `468733b2…`, `mergeable=true`.
- CAPTCHA-ротация, bounded account failover, provider-wide circuit, account/thread affinity, многошаговый tool-loop и два режима системного промпта не откатывались.
- Новый живой запрос к Qwen не запускался; старый разрешённый one-shot trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- GitHub connector пока не показывает CircleCI status/check для exact head `3b89f83c…`, поэтому полный regression новым изменениям зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `3b89f83c…`; если красный — чинить конкретный regression без отката CAPTCHA-ротации и tool-loop.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact продуктовой линии без provider traffic.
3. Следующий уже подтверждённый участок для ремонта — non-stream retry в `server.js`: сейчас `sessionStore.set(...)` вызывается сразу после `retry.status === true`, до того как `collectNonStream()` доказал пригодный ответ. Пустой/оборванный retry не должен оставлять подтверждённый session route.
4. Установить судьбу уже разрешённого live bridge `4de8bdae…`; второй живой запуск делать только если доказано, что прежний до Qwen не дошёл.
5. После одного живого многошагового PASS (`read_file → Qwen → bash → Qwen → final`) проверить restart + безопасный failover незавершённой цели и только потом аккуратно сводить PR #6 с `main`.