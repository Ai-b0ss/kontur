# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `c95fadd552c6db26b18efcc193d74074c43119f2`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. Workspace в этом запуске не менялся.

Сделано:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый handoff уже отставал: PR #6 был на `620d418cd1e1d73a42815ee2ff7899b810252a39`.
- Найден дефект внутреннего agent-stream пути: `sendPrepared()` записывал новый `qwenChatId/qwenAccountId` сразу после HTTP-level `status=true`, ещё до того, как SSE-поток доказал пригодный ответ. Оборванный/невалидный stream мог отравить локальное состояние новым тредом, который фактически не был принят.
- Исправлено: route теперь коммитится только после успешного `consumeQwenStream()`. Сам `sendPrepared()` больше не меняет состояние `chat` заранее.
- Сохранена правильная account/thread affinity при failover. Если incremental-ответ пришёл на другом треде, он по-прежнему отбрасывается, полная локальная история переносится на свежий тред выбранного аккаунта, а route фиксируется только после пригодного ответа.
- Исправлен связанный fresh-stream случай: нулевой поток (`frames=0`) теперь получает один свежий retry даже если первый не успел записать `chatId`. Повтор не переиспользует отвергнутый route.
- Добавлен `scripts/agent-stream-route-commit-test.js`: он проверяет, что обычная ошибка stream не оставляет `qwenChatId/accountId`, а fresh zero-frame stream повторяется на новом route и коммитит только успешный второй ответ.
- Новый регресс включён в общий `npm test`.

Коммиты этого запуска в `qwen-free-api`:
- `28129633dc8410d5f4e101ce387dfba6ebc685be` — agent route коммитится только после пригодного stream;
- `21291144f2bae8715afb3c12f144f1a2b7400e7f` — отдельный regression на failed stream + fresh zero-frame retry;
- `c95fadd552c6db26b18efcc193d74074c43119f2` — новый regression включён в общий `npm test`.

Проверено:
- PR #6 действительно указывает на `c95fadd5…`, остаётся draft/open и `mergeable=false` относительно актуального `main`.
- `qwen-workspace` PR #5 заново сверён: `468733b2…`, `mergeable=true`.
- CAPTCHA-ротация, bounded account failover, provider-wide circuit, account/thread affinity, многошаговый tool-loop, checkpoint и два режима системного промпта не откатывались.
- Новый живой запрос к Qwen не запускался; старый разрешённый one-shot trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- GitHub connector пока не показывает CircleCI status/check для exact head `c95fadd5…`, поэтому полный regression новым изменениям зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `c95fadd5…`; если красный — чинить конкретный regression без отката CAPTCHA-ротации, tool-loop и route-commit защиты.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact продуктовой линии без provider traffic.
3. Дальше закрыть аналогичный OpenCode streaming retry участок в `server.js`: `retryEmpty` пока сохраняет новый route сразу после `retry.status=true`, до доказательства, что возвращённый retry stream реально дал пригодный ответ. Сначала сделать точный тест контракта `pipeThroughOpenAI/retryEmpty`, затем переносить commit route на момент первого пригодного stream-события/успешного завершения.
4. Установить судьбу уже разрешённого live bridge `4de8bdae…`; второй живой запуск делать только если доказано, что прежний до Qwen не дошёл.
5. После одного живого многошагового PASS (`read_file → Qwen → bash → Qwen → final`) проверить restart + безопасный failover незавершённой цели и только потом аккуратно сводить PR #6 с `main`.