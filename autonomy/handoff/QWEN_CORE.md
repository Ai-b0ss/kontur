# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `9ffd5c366ee159a4c08bb6ed43a6ab26f5e8d5bc`.

`qwen-workspace`: PR #5 без изменений, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

Сделано:
- Заново проверены текущие PR и исходники обоих репозиториев; `qwen-free-api` действительно оставался на PR #6, `qwen-workspace` PR #5 не уехал.
- Исправлен дефект восстановления незавершённой OpenCode-сессии после падения процесса. Раньше, если входящий пользовательский ход уже успел попасть в durable checkpoint, а клиент после рестарта повторял тот же короткий запрос, `restoreCheckpoint()` добавлял его второй раз. Теперь точное пересечение «хвост сохранённой истории → начало повторного запроса» удаляется, а настоящий новый `continue`/следующий ход всё ещё добавляется нормально.
- Расширен `session-store-restart-test.js`: отдельно проверяется повтор того же пользовательского хода после оборванного ответа и обычный новый ход после рестарта.
- Нашёл ещё один дефект двухрежимного system prompt. Неявный generic owner-mode раньше мог увидеть в приватном тексте буквальный `<mcp_instructions>` и ошибочно принять весь промпт за обёртку OpenCode, отрезав текст вокруг тега. Теперь generic owner prompt сохраняется целиком; выделение внутреннего MCP-блока разрешено только для запроса, положительно похожего на OpenCode (заголовок сессии OpenCode либо его явная системная обёртка).
- Расширен `system-prompt-mode-test.js`: приватный generic prompt с буквальным MCP-тегом обязан пройти целиком, а реальная OpenCode-обёртка по-прежнему отдаёт только приватный внутренний блок без конкурирующей персоны.
- CAPTCHA cooldown/ротация, provider-wide fail-closed, межаккаунтная привязка Qwen-треда, 12/24 модельных ходов и recovery tool-errors не ослаблялись.

Проверено:
- Промежуточный head `c32765018c521fecadf0240afd6e38b0238631da` после restart-dedupe полностью зелёный в CircleCI, workflow `5e35b57e-2d9b-4540-8a38-f8cc01ce0b8d`.
- Текущий exact head `9ffd5c366ee159a4c08bb6ed43a6ab26f5e8d5bc` тоже полностью зелёный в обычном CircleCI: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success; workflow `568d857f-d18c-47b4-9cff-7f9d9e32b813`.
- Нативный Windows Server 2022 PASS остаётся доказан для предыдущей продуктовой линии: workflow `0e9a0fcf-1aa9-4535-a6cf-ccce14bb182a`, job `3398e251-3d43-42ef-bd31-c723f178865e`. После нынешних изменений `session-store`/prompt-mode нужен один bounded offline Windows parity, без provider traffic.
- Старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` повторно не запускался. Не создавать второй живой запрос, пока его судьба не установлена либо не доказано, что до провайдера он не дошёл.

Следующее:
1. Выполнить один bounded Windows offline parity на текущем head, без Qwen/provider traffic.
2. Найти фактический результат уже разрешённого live bridge `4de8bdae…`. Только если доказано, что он не дошёл до провайдера, выполнить ровно один живой многошаговый проход: `read_file → tool result → новый модельный ход → bash → tool result → final`, затем restart и безопасный failover незавершённой цели.
3. После живого PASS аккуратно свести PR #6 с актуальным `main`, не возвращая небезопасную передачу GPG passphrase через argv и сохранив ротацию, security gates, два prompt-режима и crash-safe checkpoint.
