# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `797c303b3cf0fbf805ef9bd4fd9246066d5fdad7`.

Сделано:
- Заново проверены оба репозитория. `qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.
- Закрыта реальная ошибка межаккаунтного tool-loop. Теперь Qwen хранит пару `upstream chatId + accountId`, не отправляет старый тред через другой аккаунт и при bounded failover переносит полную локальную историю в новый тред именно того аккаунта, который принял эстафету.
- Нормальный ход внутри уже принадлежащего аккаунту треда теперь отправляет только текущее сообщение/tool-result (`currentOnly=true`); первый ход и межаккаунтный rebase отправляют полную историю ровно один раз.
- Та же логика доведена до настоящего OpenCode/OpenAI пути в `server.js`: тред переиспользуется только пока жив его владелец; ответ sibling-аккаунта на incremental payload отбрасывается и переигрывается полной историей; в session store сохраняется фактический `response.chatId`, а не старый подготовленный id.
- Расширен офлайн-регресс: `read_file → result → смена аккаунта/треда → полный rebase → bash → result → final`, с проверкой привязки A/A/B/B и режимов payload `full/incremental/full/incremental`.
- Добавлен отдельный gate для OpenCode thread-affinity и `node --check server.js` в полный `npm test`.
- One-shot live bridge оставлен выключенным по умолчанию (`run_qwen_live_bridge=false`), поэтому новые коммиты не создают второй provider run.

Проверено:
- Exact-head CircleCI workflow `b5838d9d-6f28-4bdb-ab1d-490be921b922` на `797c303b…` полностью зелёный: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success.
- Предыдущий exact-head `defbe1ca…` тоже прошёл полный офлайн regression после исправления `currentOnly`.
- CAPTCHA остаётся локальной проблемой аккаунта с 10-минутным cooldown и безопасным sibling failover; provider-wide WAF/trust/pressure по-прежнему fail-closed.
- Два режима system prompt сохранены: обычный инженерный и owner-passthrough без примеси OpenCode persona; `opencode.example.jsonc` содержит оба подключения.

Важно:
- Live-soak на текущем head ещё не доказан. Старый trigger-коммит `4de8bdae…` включал one-shot bridge, но доступная GitHub-поверхность не показывает подтверждённый итог того запуска. Не запускать второй provider soak, пока сначала не найден/разобран фактический результат первой попытки.
- PR #6 сейчас расходится с `main`: +103 / -5 коммитов. Не сводить ветки до живого доказательства, чтобы не смешать отладку tool-loop с инфраструктурной историей main.

Следующее:
1. Сначала установить судьбу уже разрешённого one-shot live bridge; если запуск реально существует — разобрать его и не дублировать.
2. Затем нужен ровно один bounded live PASS на актуальном коде: `read_file → tool result → новый модельный ход → bash → tool result → final`, плюс restart и безопасный failover.
3. После live PASS — нативная Windows-проверка и только затем аккуратно свести PR #6 с актуальным `main`, сохранив CAPTCHA-ротацию, security gates и оба режима system prompt.
