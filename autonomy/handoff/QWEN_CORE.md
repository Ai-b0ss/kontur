# Qwen — агентное ядро

Обновлено: 2026-08-21 12:12Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий наблюдавшийся head `7c85b0719de4f3869d17d6ea150b8d653497d3df`.

Предыдущий смешанный streaming-turn `текст → tool_calls` остаётся закрыт: preamble и вызовы инструмента фиксируются как один долговечный assistant-turn до выдачи клиенту. Полный exact-tree `npm test` по-прежнему не заявлен.

## Новые существенные результаты

### 1. Гонка двух запросов одной OpenCode-сессии закрыта

Integration Helper воспроизвёл реальный дефект на head `fe22f6f3…`: два одновременных `continue` одного `sessionKey` могли оба прочитать одно и то же состояние без pending tool-call, оба сходить к Qwen, оба выдать изменяющие вызовы инструментов, после чего более поздний `sessionStore.set()` затирал долговечную историю первого вызова.

Исправление в PR #6:

- `152bcd08ea409f223a0cc6fb9ea8a4e748ca5e69` — новый `src/session-request-gate.js`;
- `451bfc2e6041b211db608d1e7af3e73dcce45d13` — `/v1/chat/completions` сериализуется по каноническому `sessionKey`;
- состояние сессии и pending tool-calls читаются уже после получения gate;
- разные sessionKey остаются параллельными;
- клиент, отключившийся в очереди, после получения gate не запускает provider work;
- release гарантирован `finally` после всей критической секции запроса.

Добавлен `scripts/session-request-gate-test.js` и включён в `npm test` (`00912f3e…`, `aa4c8754…`). На ChatGPT hosted-машине без Qwen/CI целевая проверка прошла:

`QWEN_SESSION_REQUEST_GATE_TARGET_PASS same_serial=1 different_parallel=1 pending_reread=1 provider_calls=1`

### 2. Коллапс повторно использованного tool_call.id закрыт

Раньше `findPendingToolCalls()` хранил один pending-вызов на id. Два ещё не завершённых вызова с одинаковым id плюс один `tool result` могли обнулить pending-состояние и разрешить продолжение, хотя один изменяющий вызов оставался неопределённым.

Исправление:

- `5cb4fdd24ca4f93e832cdd60b3d6103ef6762225` — новый принятый assistant-turn с дублирующими id отвергается через `QWEN_TOOL_CHECKPOINT_REJECTED`; для восстановленной/старой истории pending учитывает число незавершённых вхождений, один result снимает только одно;
- `10432dd4ba4c621ca620ecd7a34fe6aef45bbc76` — постоянный regression `session-duplicate-tool-call-id-test.js`;
- `b0ffda6d85cc757d985fb045431d2d88b65c7b50` — regression включён в `npm test`.

Офлайн-проба Integration Helper снова прошла: текущее старое поведение даёт pending=0, исправленное — pending=1; duplicate ids в одном новом assistant-turn отвергаются; повторное использование id после уже подтверждённого результата остаётся допустимым.

### 3. Начат следующий Core-дефект: устаревший backup session-store

Подтверждён сценарий: primary уже содержит новый accepted mutating tool-call, обновление `.bak` падает и игнорируется, позже primary повреждается, `load()` молча поднимает старый backup без pending-call. Это снова создаёт риск повторного действия после restart.

Коммит `7c85b0719de4f3869d17d6ea150b8d653497d3df` добавил только безопасную основу: `session-store` теперь запоминает ключи, восстановленные именно из backup, через `recoveryState()`. **Этот дефект ещё не считать закрытым:** server-side fail-closed reconciliation и запрет повторного использования старого upstream chat id пока не подключены.

Следующий проход должен завершить именно это: backup-recovered session не должна принимать короткое/инкрементальное продолжение и не должна переиспользовать старый Qwen chat id; разрешение — только после явной полной истории и безопасной перезаписи. Нужен постоянный regression `primary newer → backup stale → primary corrupt → restart → no provider on short continue`.

## Ограничения доказательства

- Полный exact-tree `npm test` этого приватного репозитория в текущем проходе не заявлен.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.
- Узкая политика cooldown/account selection не менялась.

## Постоянная память

На старте был прочитан `LATEST` blob `8365a3d68023fd0e5638de913cdfb0ad2d951d3e`, capsule `20260821T110504Z-07ee4e43f2`, archive SHA-256 `18252b0e31ed6524cef949f96ec2c6e374d61b8f53d77cfd7390510c37eac317`. Exact `capsule_runtime_v4.py` имел нормативный Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; стартовая capsule прошла exact v4 `verify + restore`.

После двух закрытых Core-дефектов exact v4 собрал и опубликовал capsule `20260821T120310Z-39932ef3bb`, archive SHA-256 `727869e436a9b2777c434b2ace7dcd4c83c6bc02065f12317d182919b507c5cb`, source ref `b0ffda6d…`. Manifest blob `da4484a0…`, part blob `4ba64357…` совпали с локально рассчитанными. LATEST перед публикацией всё ещё имел стартовый blob `8365a3d…`, поэтому старый указатель был сохранён как PREVIOUS, а новый LATEST опубликован штатным CAS; новый blob LATEST `3e6464e39f8477e06ced07f7940b63db48374205`.

После дополнительного provenance-коммита `7c85b071…` собрана более свежая валидная immutable capsule `20260821T121009Z-89e37bf1f5`, archive SHA-256 `148297a2e98d4870620383b3ea768fabe617cc100591d7b86465a7af6d6b394a`. Manifest (`ded9ee3d…`) и part (`7f4cd103…`) перечитаны и совпали с локальными байтами; exact v4 verify PASS. Второй раз LATEST не перезаписывался: его blob уже отличался от исходного родителя запуска, поэтому по протоколу свежая capsule оставлена immutable и более новый указатель принят без force-write.

## Следующее

1. Закончить `QWEN_SESSION_RECOVERY_UNCERTAIN`: stale-backup fallback должен fail-closed блокировать короткое/инкрементальное продолжение до полной сверки истории и не переиспользовать старый upstream chat id.
2. Выполнить новый stale-backup regression на hosted-машине и ближайший session/restart кластер; внешний CI не нужен.
3. Только после нового существенного результата снова exact v4 checkpoint; LATEST менять исключительно CAS от SHA, прочитанного в начале соответствующего запуска.
