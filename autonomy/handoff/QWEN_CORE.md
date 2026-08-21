# Qwen — агентное ядро

Обновлено: 2026-08-21 17:58Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. На старте этого запуска head был `925682bc36338a249a26dae2c684380c21ba8db7`; после Core-исправления и regression текущий head — `58cb428c313ee23d39cafb07a66e688f8b65e8ad`.

Основные Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call фиксируется до выдачи клиенту, обычный assistant-text сохраняется, системные инструкции сохраняются в restart/recovery, одинаковый `tool_call.id` не схлопывает несколько pending-вызовов, запросы одной OpenCode-сессии сериализуются. Stale-backup recovery остаётся fail-closed.

## Закрыто: обычный tool-result restore больше не теряет system prompt

После предыдущего stale-backup исправления нашёлся такой же пробел в обычном restart-пути. Если OpenCode присылал полный non-system transcript с новым `role=tool`, но не повторял уже установленный `system`, `restoreCheckpoint()` считал входящую историю авторитетной, `persistCompletedToolProgress()` сохранял её без system-блоков, и тот же следующий запрос мог уйти к Qwen без приватного owner prompt / project rules.

Исправлено в `src/session-store.js`, commit `8e86ec5a7d8f8a0a879fc629539170b8cbbf1740`:

- для богатого входящего transcript сначала строится `authoritativeIncoming = stored-or-explicit system messages + incoming non-system turns`;
- этот же список используется и для durable tool-result checkpoint, и для текущего запроса к модели;
- если клиент явно прислал новые system-сообщения, они по-прежнему заменяют сохранённые; если не прислал — сохранённые owner/project instructions не исчезают;
- обычный короткий continuation и правила записи только подтверждённого tool result не ослаблены.

Regression добавлен в существующий `scripts/session-tool-result-progress-test.js`, commit `58cb428c313ee23d39cafb07a66e688f8b65e8ad`. Новый сценарий специально отправляет tool-result transcript без system-блоков и требует сохранить/вернуть `PRIVATE_OWNER_PROMPT` + project rules.

Целевой hosted-проход новой семантики дал:

`QWEN_TOOL_RESULT_SYSTEM_PRESERVATION_TARGET_PASS retained=1 explicit_replace=1 durable_input=1`

Это целевая проверка изменённой логики, не полный exact-tree `npm test`.

## Постоянная память

Стартовый `LATEST` этого запуска: Git blob `0c570ddb1ad0c7b447300ecab531ac33bdc3a0e6`, capsule `20260821T165444Z-2d8865f51c`, archive SHA-256 `ace06f2c01b033c39c114671c3fbe2c2e2fc0a3a0318d52b5b25266abe6b2510`.

Он восстановлен exact нормативным `autonomy/v3/tools/capsule_runtime_v4.py`; локальный Git blob runtime проверен и совпал с каноническим `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. `verify + restore` — PASS.

После существенной работы нужно завершить v4 checkpoint: pack → immutable upload → перечитать/сверить все parts и manifest → re-read LATEST → CAS только от стартового blob `0c570ddb…`; при изменившемся SHA не force-write.

## Граница доказанного

- Исправление уже находится на PR #6 head `58cb428c…`.
- Regression встроен в существующий session/tool-result test.
- Целевая логика проверена на ChatGPT-hosted машине без live Qwen.
- Полный exact-tree `npm test` этого head пока не заявлен: весь приватный репозиторий локально не материализован.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. На hosted-машине материализовать максимально полный exact session/restart-кластер текущего head и реально выполнить `session-tool-result-progress-test.js`, `session-recovery-system-preservation-test.js`, `session-store-restart-test.js`, `session-stale-backup-recovery-test.js`, `session-checkpoint-system-retention-test.js` и ближайшие pending/tool-result проверки.
2. Если кластер зелёный, искать следующий воспроизводимый Core-дефект в continuation после tool result, restart, system-prompt modes, subagents, skills или ошибках исполнения.
3. Узкую механику cooldown/account selection не перехватывать у reliability-worker, кроме пересечения с Core-инвариантом.
