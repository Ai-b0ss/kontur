# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `3dd0f3812877a07f0aba0f22b47594c4b0ac7219`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. В этом запуске workspace не менялся.

Сделано:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый head из handoff был сильно неактуален: PR #6 уже находился на `473cec3478d9178510f58ca090cb54cd8a5b03f1`.
- Дожат найденный ранее дефект OpenCode-пути в `server.js`: session metadata теперь записывается только после `response.status === true`. Неуспешный ответ Qwen больше не может заранее перепривязать checkpoint к новому `chatId/accountId`. Телеметрия фактического аккаунта при этом сохраняется.
- Добавлен `scripts/server-session-commit-order-test.js`; он фиксирует порядок `upstream failure gate → session commit` и проверяет, что первичная запись checkpoint недостижима до штатного `502 upstream_error`.
- Найден второй реальный дефект после свежего LRU-изменения пула. Внутренний `src/agent.js` для новой независимой задачи всё ещё выбирал `accountStore.current()`, поэтому мог залипать на вручную выбранном аккаунте и обходить новую балансировку пула.
- Новый независимый агентный ход теперь берёт `accountStore.candidates()[0] || accountStore.current()`. Уже существующий Qwen-тред по-прежнему жёстко держится за своего владельца; при недоступности владельца выполняется полный перенос истории на свежий тред другого аккаунта.
- Усилен `scripts/offline-agent-loop-test.js`: текущий/UI-аккаунт специально выставлен в B, а политика пула предпочитает A. Тест требует первый независимый запрос через A, затем сохраняет доказанный `A/A → failover → B/B` путь с `read_file → tool result → bash → final`.

Коммиты этого запуска в `qwen-free-api`:
- `7d437caeb70b873a88afe161b48f345f5f38a662` — session checkpoint только после успешного upstream status;
- `914e76419c120ed3d6a33aea64208841945b11b2` — регресс порядка commit/failure gate;
- `054a4ca2865f8ceeeeeb9fdaea1e37186629116b` — новый регресс включён в общий `npm test`;
- `6261d330757b62bf06c3f5e3b3124a0ee1eb3f39` — свежая независимая работа агента использует балансированный candidate;
- `3dd0f3812877a07f0aba0f22b47594c4b0ac7219` — поведенческий регресс на LRU fresh-work + сохранение thread affinity.

Проверено:
- PR #6 после изменений действительно указывает на `3dd0f381…`, остаётся draft/open и `mergeable=false` относительно актуального `main`.
- `qwen-workspace` PR #5 заново сверён по живому PR: head `468733b2…`, `mergeable=true`, новых изменений там нет.
- CAPTCHA-ротация, provider-wide circuit, bounded failover, account/thread affinity, многошаговый tool-loop и два режима системного промпта не откатывались.
- Новый живой запрос к Qwen не запускался; старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- Для exact head `3dd0f381…` GitHub пока не показывает CircleCI status/check, поэтому полный regression новым изменениям зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `3dd0f381…`. Если красный — чинить конкретный regression, не откатывая CAPTCHA-ротацию, tool-loop, LRU-балансировку и prompt-mode.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact продуктовой линии без провайдерного трафика.
3. Проверить следующий близкий участок checkpoint-семантики: non-stream retry сейчас записывает новый session route сразу после `retry.status === true`, ещё до доказательства, что `collectNonStream` получил пригодный ответ. Если все retries дают пустой/оборванный stream, последний неуспешный тред не должен оставаться подтверждённым checkpoint.
4. Установить судьбу уже разрешённого live bridge `4de8bdae…`; второй живой запуск делать только если доказано, что прежний до Qwen не дошёл.
5. После одного живого многошагового PASS (`read_file → Qwen → bash → Qwen → final`) проверить restart + безопасный failover незавершённой цели и только потом аккуратно сводить PR #6 с `main`.