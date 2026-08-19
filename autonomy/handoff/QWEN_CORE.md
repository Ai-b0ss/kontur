# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `7d4948865e735f5668358e57272d30eca2046fe2`.

`qwen-workspace`: PR #5 без изменений, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

Сделано:
- Заново проверены текущие PR и исходники обоих репозиториев; старый head из handoff уже был устаревшим.
- Межаккаунтный tool-loop сохранён: Qwen-тред привязан к аккаунту-владельцу; при failover старый `chatId` не уходит соседнему аккаунту, полная локальная история один раз переносится в новый тред, затем снова идут короткие ходы.
- Длина автономной цепочки остаётся 12 модельных ходов по умолчанию с жёстким потолком 24.
- Закрыт ещё один реальный дефект агентности: раньше битый JSON в аргументах tool-call молча превращался в `{}`. Теперь такой вызов не исполняется, модель получает явный `tool result` с ошибкой и может на следующем ходе сама исправить аргументы и продолжить задачу. Неожиданное исключение самого executor тоже возвращается модели как tool-error вместо обрыва всей цепочки.
- Добавлен отдельный регресс `agent-tool-error-recovery-test.js`: первый вызов `read_file` приходит с битым JSON, executor его не получает; следующий модельный ход исправляет аргументы, инструмент выполняется, третий ход завершает задачу.
- Новый тест включён в общий `npm test`.
- Два режима system prompt, CAPTCHA cooldown/ротация, provider-wide fail-closed, OpenCode thread affinity и crash-safe session checkpoint не ослаблялись.

Проверено:
- Exact head `7d494886…` полностью зелёный в обычном CircleCI: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success; workflow `e22b2d37-eacd-4bf1-8e72-eb574b39a893`.
- Нативный Windows Server 2022 PASS остаётся действующим доказательством для предыдущей продуктовой линии: workflow `0e9a0fcf-1aa9-4535-a6cf-ccce14bb182a`, job `3398e251-3d43-42ef-bd31-c723f178865e`. После сегодняшнего изменения `src/agent.js` Windows желательно повторить bounded offline, но provider traffic для этого не нужен.
- Старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` повторно не запускался. GitHub по-прежнему не показывает его итоговый downstream-run/status, поэтому живой запрос вслепую не дублировать.

Следующее:
1. Один bounded Windows offline parity на текущем head, без Qwen/provider traffic.
2. Найти фактический результат уже разрешённого live bridge `4de8bdae…`. Если доказано, что он не дошёл до провайдера, выполнить ровно один живой многошаговый проход: `read_file → ошибка/результат → новый ход модели → bash → результат → final`, затем restart и безопасный failover незавершённой цели.
3. После живого PASS аккуратно свести PR #6 с актуальным `main`, не возвращая небезопасную передачу GPG passphrase через argv и сохранив ротацию, security gates, два prompt-режима и crash-safe checkpoint.
