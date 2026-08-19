# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `2dd1ed39cecba957f6488b006aa6e13c8ec776ab`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. Workspace в этом запуске не менялся.

Сделано:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый handoff был неактуален: PR #6 уже находился на `647ec7ada79518e5515dfb6505e50a5712aad7a9`.
- Исправлен дефект agent-stream CAPTCHA: ошибка из активного SSE теперь несёт `qwenAccountId` фактического upstream response, а не полагается на `accountStore.current()`. Это важно при LRU/ротации, когда UI/current аккаунт может быть другим.
- Обычная CAPTCHA активного agent-stream теперь ставит в локальный 10-минутный cooldown только точный challenged account через `markCaptchaChallenge()`, не открывает provider-wide circuit и очищает старый upstream `chatId/accountId`. Локальная история/tool-result сохраняется для следующего полного rebase на допустимый аккаунт.
- Добавлен `scripts/agent-captcha-owner-test.js`: current/UI = B, upstream owner = A; тест требует cooldown/recovery только A и карантин challenged thread. Тест включён в общий `npm test`.
- Закрыт следующий подтверждённый дефект OpenCode non-stream checkpoint. Раньше первичный non-stream route и особенно retry могли сохраниться сразу после HTTP-level `status=true`, ещё до того, как `collectNonStream()` доказал пригодный ответ. Пустой/оборванный поток мог оставить в checkpoint мёртвый `chatId/accountId`.
- В `server.js` non-stream route теперь коммитится только после успешного `collectNonStream()`. То же правило применено к retry: новый retry route сохраняется только после пригодного ответа. Streaming-путь пока оставлен отдельно с прежним ранним checkpoint, чтобы не менять его семантику в этом ремонте.
- Добавлен `scripts/server-nonstream-session-commit-test.js`; он отдельно фиксирует порядок `collect usable → sessionStore.set` для первичного ответа и retry. Старый `server-session-commit-order-test.js` обновлён под разделение stream/non-stream.
- Сверка commit diff после полной замены `server.js` показала только ожидаемые 25 строк изменений (`18 additions / 7 deletions`), без случайной потери остального файла.

Коммиты этого запуска в `qwen-free-api`:
- `8811358a62d899993328fdff2784a39a5a889616` — точная атрибуция streamed CAPTCHA к владельцу response;
- `42048d6bc620e48443bd1afd3fb0bae85101cab6` — первичный регресс владельца CAPTCHA;
- `a6d58484ba71635bda6c848ac8f38051d84bf2a0` — CAPTCHA-регресс включён в `npm test`;
- `8040cae598ef3fbdb94cd637c49a5bc66e31499e` — challenged account уходит в локальный cooldown, старый тред карантинится;
- `3b89f83cc4cd4ceddbb1d63ac034eee529d0922b` — регресс усилен проверкой cooldown + очистки ownership;
- `7d04731f0761d0cefbaf0858e1fff7d82f7d8ab5` — non-stream session route коммитится только после пригодного ответа;
- `d0e266a4393072e8802d3c33cb2ece6c1e1338c0` — новый регресс порядка non-stream commit;
- `b91e640fa79dbf4ea98e9c4d051dc232a024bf3b` — новый регресс включён в общий `npm test`;
- `2dd1ed39cecba957f6488b006aa6e13c8ec776ab` — прежний route-order regression приведён к новой stream/non-stream семантике.

Проверено:
- PR #6 действительно указывает на `2dd1ed39…`, остаётся draft/open и `mergeable=false` относительно актуального `main`.
- `qwen-workspace` PR #5 заново сверён: `468733b2…`, `mergeable=true`.
- CAPTCHA-ротация, bounded account failover, provider-wide circuit, account/thread affinity, многошаговый tool-loop и два режима системного промпта не откатывались.
- Новый живой запрос к Qwen не запускался; старый разрешённый one-shot trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- GitHub connector пока не показывает CircleCI status/check для exact head `2dd1ed39…`, поэтому полный regression новым изменениям зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `2dd1ed39…`; если красный — чинить конкретный regression без отката CAPTCHA-ротации, tool-loop и новых checkpoint-гейтов.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact продуктовой линии без provider traffic.
3. Проверить аналогичный streaming retry участок: `retryEmpty` пока подтверждает новый stream-route до окончательной проверки пригодности возвращённого retry stream. Не менять его вслепую — сначала посмотреть контракт `pipeThroughOpenAI/retryEmpty` и сделать тест, который различает пустой retry и реально начавшийся ответ.
4. Установить судьбу уже разрешённого live bridge `4de8bdae…`; второй живой запуск делать только если доказано, что прежний до Qwen не дошёл.
5. После одного живого многошагового PASS (`read_file → Qwen → bash → Qwen → final`) проверить restart + безопасный failover незавершённой цели и только потом аккуратно сводить PR #6 с `main`.