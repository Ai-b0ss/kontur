# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `5121e4ba7da529decec0f630960099fe8f9c862b`, PR draft/open, `mergeable=false` относительно текущего `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, текущий head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

Что сделано сейчас:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff, живые PR и исходники обоих Qwen-репозиториев. Старый head `53a2c6cb…` уже был устаревшим: до моей записи `qwen-free-api` дошёл до `cb213bd1…`; свежие чужие коммиты развивали локальные skills и не откатывали CAPTCHA-ротацию или агентный tool-loop.
- В `qwen-workspace` найден и исправлен реальный дефект пути к кэшу по умолчанию. Контракт ожидает `.runtime/cache.json`, но конструктор без `runtimeDir` строил `.runtime/.runtime/cache.json`. Теперь базовый каталог по умолчанию `.` и итоговый путь снова `.runtime/cache.json`.
- Для этого добавлен регресс: `OrchestratorCache()` без параметров запускается во временной рабочей папке, пишет кэш и обязан создать `.runtime/cache.json`, но не `.runtime/.runtime/cache.json`.
- В `qwen-free-api` найден более важный дефект владения Qwen-тредом внутри `sendChatRequest()`. Если payload уже содержал `chat_id` владельца A, но preferred A к моменту запроса ушёл в cooldown, `operationCandidates()` правильно выбирал B первым, однако старый код мог оставить исходный `chat_id` и отправить его через B. Это нарушало главный инвариант account/thread affinity.
- Исправлено: старый upstream `chat_id` теперь разрешено переиспользовать только если текущий кандидат — тот же доступный `preferredAccount`. Любой sibling или недоступный прежний владелец получает свежий Qwen chat через `generateChatID(..., account)`.
- Добавлен `scripts/qwen-client-thread-owner-test.js`: проверяет reuse только владельцем, запрет sibling reuse и обязательный свежий тред после cooldown владельца. Тест включён в общий `npm test`.

Коммиты этого запуска:

`qwen-free-api`:
- `b2b32828110b0da177d1e87fa717922992eff957` — `fix: never reuse a Qwen thread across account failover`;
- `6b4912c9b78de57ce52e23c5d6125525a3420ef5` — `test: protect Qwen thread ownership across failover`;
- `5121e4ba7da529decec0f630960099fe8f9c862b` — `test: include Qwen thread ownership regression`.

`qwen-workspace`:
- `efbc3bd86326bf0aa11260901c5adc5ccf770a16` — `fix: keep default cache path at .runtime/cache.json`;
- `ce51b26c227b08032301a8574fee4fe2ee9330a3` — `test: pin default orchestrator cache location`.

Что проверено:
- PR #6 действительно продвинут до `5121e4ba…`; изменённый участок `qwen-client.js` заново прочитан с этого exact head, helper `canReuseOriginalChatId()` и новая ветка fresh-chat на месте.
- PR #5 действительно продвинут до `ce51b26c…` и остаётся `mergeable=true`.
- CAPTCHA-ротация, bounded account failover, provider-wide circuit, checkpoint и два режима system prompt не откатывались.
- Через доступный GitHub status API для exact heads `5121e4ba…` и `ce51b26c…` пока нет опубликованных CI-statuses, поэтому полный regression зелёным не объявлять без фактического CircleCI/локального результата.
- Новый живой запрос к Qwen не запускался; прежний разрешённый provider-run не дублировать вслепую.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `qwen-free-api 5121e4ba…`. Если красный — чинить конкретную ошибку без отката CAPTCHA-ротации и account/thread семантики.
2. Для `qwen-workspace ce51b26c…` выполнить точный `node --test orchestrator/test/cache.test.mjs`.
3. После полного offline green — один bounded Windows offline parity на exact продуктовой линии без provider traffic.
4. Затем восстановить результат прежней разрешённой live-попытки. Второй provider-run вслепую не запускать. Если прежняя попытка до провайдера не дошла — ровно один живой многошаговый проход `read_file → Qwen → tool result → bash → Qwen → final`, затем restart и безопасный failover незавершённой цели.
5. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret-bridge/checkpoint решения.
