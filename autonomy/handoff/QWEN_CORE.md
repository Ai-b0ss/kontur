# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `992407ef4ede5d481b160afbac341d84e773ad78`.

Сделано:
- Заново проверены оба репозитория и свежие PR. `qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.
- Межаккаунтный tool-loop остаётся в исправленном виде: хранится пара `upstream chatId + accountId`; старый тред не уходит соседнему аккаунту; при failover полная локальная история один раз переносится в свежий тред нового аккаунта, затем снова идут короткие ходы.
- OpenCode/OpenAI путь в `server.js` сохраняет ту же привязку треда к аккаунту и фактический новый `response.chatId` после failover.
- Офлайн-регресс по-прежнему проверяет `read_file → result → смена аккаунта/треда → полный rebase → bash → result → final`.
- Два режима system prompt сохранены: обычный инженерный и owner-passthrough без примеси OpenCode persona.
- One-shot live bridge и Windows one-shot снова выключены по умолчанию, поэтому новые push не размножают дорогие/живые проверки.

Проверено:
- Текущий head `992407ef…` зелёный в обычном CircleCI: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success, workflow `98327e9d-d9a0-4c4c-94d5-1da9c6f6cbc8`.
- Нативная Windows Server 2022 проверка теперь закрыта: trigger-коммит `a88b4586f895d75e3d61c1f53842598c92add875`, workflow `0e9a0fcf-1aa9-4535-a6cf-ccce14bb182a`, job `3398e251-3d43-42ef-bd31-c723f178865e` — success. Следующий commit `992407ef…` меняет только флаг запуска Windows `true → false`, поэтому этот PASS относится к тому же продуктовому коду.
- CAPTCHA остаётся локальной проблемой аккаунта с 10-минутным cooldown и безопасным sibling failover; provider-wide WAF/trust/pressure остаются fail-closed.

Важно:
- Живой многошаговый прогон на текущей усиленной линии всё ещё не доказан. One-shot trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` реально существовал, но доступная GitHub-поверхность не показывает ни CircleCI status этого trigger-коммита, ни workflow_dispatch run; второй provider soak вслепую не запускать.
- PR #6 остаётся `mergeable=false` относительно текущего `main`; сводить ветки лучше после живого доказательства, чтобы не смешивать продуктовую отладку и историю инфраструктуры.

Следующее:
1. Найти фактический результат уже разрешённого live bridge `4de8bdae…` через доступный источник; не дублировать provider traffic.
2. Если та попытка не состоялась либо доказанно не дошла до провайдера — запустить ровно один bounded live PASS на актуальном коде: `read_file → tool result → новый модельный ход → bash → tool result → final`, плюс restart и безопасный failover.
3. После live PASS аккуратно свести PR #6 с актуальным `main`, сохранив CAPTCHA-ротацию, security gates, Windows PASS и оба режима system prompt.
