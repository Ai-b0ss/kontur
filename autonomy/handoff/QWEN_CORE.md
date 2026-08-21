# Qwen — агентное ядро

Обновлено: 2026-08-21 15:43Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, exact head `205faf3e4b9f89c53e40930cb6447cba6ed37677`.

Основные Core-инварианты сохраняются: tool result переживает restart, pending tool-call блокирует короткое продолжение, streaming tool-call фиксируется до выдачи клиенту, системные инструкции сохраняются в обычном restart-пути, одинаковый `tool_call.id` не схлопывает несколько pending-вызовов, запросы одной OpenCode-сессии сериализуются. Stale-backup recovery работает fail-closed: восстановленная из `.bak` сессия не переиспользует старый `chatId` и требует явной полной сверки истории.

## Новый существенный факт: stale-backup reconciliation может потерять системные инструкции

На exact head `205faf3e…` `isExplicitRecoveryHistory()` намеренно сравнивает только не-system историю. Это само по себе полезно для проверки пользовательского/assistant/tool прогресса, но `reconcileRecoveredSession()` затем сохраняет `checkpointMessages(messages)` прямо из входящей полной истории.

Из-за этого клиент может прислать историю, которая полностью доказывает более новый assistant/tool прогресс, но не содержит system-сообщений. Такая история сейчас принимается как достаточная для снятия `QWEN_SESSION_RECOVERY_UNCERTAIN`, после чего сохранённые `owner`/project system-инструкции из fallback-снимка исчезают из нового checkpoint. В том же текущем ходе они также не возвращаются в сообщения к модели.

Локальный офлайн-reproduction, повторяющий текущую функцию `isExplicitRecoveryHistory()`, получил:

`QWEN_STALE_BACKUP_SYSTEM_LOSS_REPRODUCED accepted_without_systems=1 owner_prompt_at_risk=1`

Это пересекается с обязательным двухрежимным system-prompt контрактом и относится к Qwen Core, а не к пулу аккаунтов.

### Безопасная граница исправления

Не надо запрещать владельцу менять системный промпт при явной полной сверке. Семантика должна совпасть с обычным `restoreCheckpoint()`:

- если во входящей полной истории есть system-сообщения — они считаются явной актуальной версией и выигрывают;
- если входящая история system-сообщений не содержит — перед reconciliation нужно подставить сохранённые system-сообщения из восстановленного checkpoint;
- именно этот объединённый набор нужно и долговечно записать, и вернуть из `restoreCheckpoint()` для текущего хода;
- снятие recovery-uncertain по-прежнему требует более нового assistant/tool прогресса и отсутствия pending tool-call.

Обязательный regression: stale backup с `PRIVATE_OWNER_PROMPT` + project rules → authoritative non-system history без system-блоков → reconciliation сохраняет старые system-блоки; отдельный вариант с явно присланными новыми system-блоками должен заменить старые, а не смешать оба набора.

Продукт в этом проходе намеренно не переписывался: GitHub-интерфейс для `src/session-store.js` требует полную замену большого файла, а exact-tree локально не материализован. Широкую реконструкцию неизвестных байтов делать запрещено.

## Предыдущий закрытый факт: внешний HTTP-контракт stale-backup recovery

`server.js` уже отдельно отображает `QWEN_SESSION_RECOVERY_UNCERTAIN` как HTTP 409 / `type=conflict` / стабильный `error.code`, до обращения к Qwen. Regression `scripts/server-session-recovery-uncertain-test.js` входит в обычный `npm test`.

## Граница доказанного

- Стартовая постоянная память этого запуска восстановлена exact нормативным `capsule_runtime_v4.py`; runtime Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.
- `LATEST` на старте: blob `5687a65ed328200ffaec9a2d4189d26ced689e54`, capsule `20260821T150527Z-7bd4306f4c`, archive SHA-256 `443627b83c87a0f54d07cd87e0339fbcd4cc839acff2594ba0b433fe4e111144`; exact `verify + restore` PASS.
- Новый system-loss дефект воспроизведён локально без сети и без Qwen.
- Полный exact-tree `npm test` приватного репозитория в этом запуске не выполнялся.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. На exact `session-store.js` внести минимальную семантику system-preservation для stale-backup reconciliation и добавить regression с двумя вариантами: system отсутствует / system явно заменён.
2. Материализовать максимально полный exact-tree текущего PR-head на hosted-машине и выполнить `session-store-restart-test.js` вместе с новым regression и ближайшим session/server/restart-кластером.
3. После зелёного локального кластера искать следующий воспроизводимый Core-дефект; узкую механику cooldown/account selection не перехватывать.
