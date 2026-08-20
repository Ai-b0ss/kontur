# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `64c910584186140346e56029f0e3de36b63f3a78`, PR draft/open, `mergeable=false` относительно `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

Что сделано:
- Заново проверены живые PR и исходники обоих Qwen-репозиториев; старый handoff был устаревшим.
- Закрыт дефект owner-mode у coding-subagents: приватный `ownerSystemPrompt` больше не проходит через `.trim()` и передаётся в агент побайтно без переписывания. Пустой prompt по-прежнему отклоняется.
- Нашёл более глубокий разрыв: `subagent-agent-runner` раньше складывал приватный/инженерный prompt в обычное system-сообщение, а реальный `chat-adapter` сохраняет там только явно размеченный технический контекст. В результате prompt мог не доехать до Qwen, хотя мок-тест был зелёным.
- Исправлена настоящая проводка: внутренний `agent.js` теперь сам применяет два режима к уже подготовленному Qwen-payload. `engineer` ставит наш автономный инженерный prompt; `owner` ставит ровно приватный prompt и не добавляет конкурирующую инженерную персону. Выбранные skills остаются отдельным `Instructions from:`-контекстом.
- Приватный prompt не пишется в persisted batch-state: там остаётся только SHA-256 для проверки совместимости возобновления.
- Закрыт ложный «успех» при исчерпании лимита модельных ходов. `agent.runTurn()` теперь возвращает `incomplete=true`, `QWEN_AGENT_ROUND_LIMIT` и явное событие лимита, сохраняя локальную историю и результаты уже выполненных инструментов.
- Для persisted coding-subagents такое незавершённое состояние теперь записывается как `uncertain`, а не как обычный `failed`: автоматический повтор после перезапуска блокируется, потому что предыдущие `write/edit/bash` могли уже иметь побочные эффекты. Повтор возможен только при явном `retryUncertain=true`.
- Добавлены регрессы на настоящий round-limit, сохранение uncertain через restart, запрет автоматического повтора, точный owner prompt и реальное попадание engineer/owner prompt в Qwen payload.

Ключевые новые проверки в `npm test`:
- `scripts/agent-round-limit-test.js`;
- `scripts/agent-system-prompt-mode-test.js`;
- усилены `scripts/subagent-agent-runner-test.js` и `scripts/subagent-batch-resume-test.js`.

Что проверено:
- PR #6 действительно стоит на `64c910584186140346e56029f0e3de36b63f3a78`.
- PR #5 остаётся на `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`; в нём также есть точный CI-шаг `node --test orchestrator/test/cache.test.mjs`.
- CAPTCHA-ротация, account/thread affinity, bounded failover, provider circuit и checkpoint не откатывались.
- Живой Qwen не запускался; старую разрешённую provider-попытку не дублировать.
- На exact head `64c91058…` GitHub combined-status пока пуст, поэтому полный regression зелёным не объявлять до фактического результата CircleCI.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `64c91058…`; если красный — чинить конкретное падение, не откатывая CAPTCHA-ротацию и новые инварианты.
2. Отдельно убедиться, что `agent-system-prompt-mode-test`, `agent-round-limit-test`, `subagent-agent-runner-test` и `subagent-batch-resume-test` проходят вместе на Linux.
3. После offline green — один bounded Windows offline parity на exact продуктовой линии, без provider traffic.
4. Затем восстановить результат старой разрешённой live-попытки. Только если доказано, что она до провайдера не дошла, выполнить ровно один живой `read_file → Qwen → tool result → bash → Qwen → final`, затем restart и безопасный failover незавершённой задачи.
5. После live PASS свести PR #6 с текущим `main`, не возвращая старые небезопасные secret-bridge/checkpoint решения.