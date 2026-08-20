# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, живой head `cb213bd17fa1033cec741564908fa5d4d0e95c63`, PR draft/open, `mergeable=false` относительно текущего `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, новый head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

Что сделано сейчас:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff, живые PR и исходники обоих Qwen-репозиториев. Старый head `53a2c6cb…` уже устарел: `qwen-free-api` дошёл до `cb213bd1…`; три свежих коммита развивают локальные skills — metadata/catalog, priority и path-gates — и не откатывают CAPTCHA-ротацию или агентный tool-loop.
- В `qwen-workspace` найден реальный дефект пути к кэшу по умолчанию. Комментарий и контракт ожидают `.runtime/cache.json`, но конструктор при отсутствии `runtimeDir` строил `.runtime/.runtime/cache.json` из-за двойного добавления `.runtime`.
- Исправлено: базовый `runtimeDir` по умолчанию теперь `.`; явный `runtimeDir` по-прежнему означает корень проекта/временной рабочей папки и даёт `<runtimeDir>/.runtime/cache.json`.
- Добавлен регресс, который запускает `OrchestratorCache()` без параметров в отдельной временной рабочей папке, делает `flush()` и требует наличие ровно `.runtime/cache.json` и отсутствие `.runtime/.runtime/cache.json`.

Коммиты этого запуска в `qwen-workspace`:
- `efbc3bd86326bf0aa11260901c5adc5ccf770a16` — `fix: keep default cache path at .runtime/cache.json`;
- `ce51b26c227b08032301a8574fee4fe2ee9330a3` — `test: pin default orchestrator cache location`.

Что проверено:
- PR #5 действительно продвинут до `ce51b26c…` и остаётся `mergeable=true`.
- Исправление не меняет TTL, stale-while-revalidate, атомарную запись или очистку протухших значений; затронут только ошибочный путь по умолчанию и его тест.
- Через доступный GitHub status API для новых exact heads сейчас нет опубликованных CI-statuses, поэтому ни `qwen-workspace ce51b26c…`, ни `qwen-free-api cb213bd1…` не объявлять полностью зелёными без фактического результата CircleCI/локального прогона.
- Новый живой запрос к Qwen не запускался; прежний разрешённый provider-run не дублировать вслепую.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `qwen-free-api cb213bd1…`; если красный — чинить конкретную ошибку без отката CAPTCHA-ротации, account/thread affinity и двух режимов system prompt.
2. Для `qwen-workspace ce51b26c…` выполнить точный `node --test orchestrator/test/cache.test.mjs`; новый регресс должен подтвердить правильный путь по умолчанию.
3. В `qwen-free-api` отдельно проверить OpenCode streaming retry: там ещё есть fallback `accountStore.candidates()[0] || preferredAccount`; нельзя позволить retry повторно оживлять аккаунт, который уже ушёл в cooldown. Если это воспроизводится — fail-closed либо переход только на реального кандидата и отдельный регресс.
4. После полного offline green — один bounded Windows offline parity на exact продуктовой линии без provider traffic.
5. Затем восстановить результат прежней разрешённой live-попытки. Второй provider-run вслепую не запускать. Если прежняя попытка до провайдера не дошла — ровно один живой многошаговый проход `read_file → Qwen → tool result → bash → Qwen → final`, затем restart и безопасный failover незавершённой цели.
6. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret-bridge/checkpoint решения.
