# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head после этой смены: `245f6faa9e04b8d7e9069bee5b9128d5822f871c`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, последний известный head `8aac48866595981804589c91d695cb3f1be39b76`.

## Что уже доказано и не надо переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера; CAPTCHA/rate limit/expired auth допускают ограниченное переключение, WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет владельца-аккаунт, а при допустимом failover локальная история переносится в свежий тред другого аккаунта;
- критичное состояние аккаунтов, OpenCode-сессий и provider circuit сохраняется с защитой от падения процесса;
- fail-open через stale `current()`/`preferredAccount`, когда `accountStore.candidates()` пуст, уже закрыт: configured-but-none-eligible даёт `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие настроенных аккаунтов остаётся `401`;
- cooldown монотонный: слабая последующая ошибка не сокращает более сильную CAPTCHA/rate-limit паузу;
- вторичный дефект `Failed to generate chat_id` закрыт: `sendChatRequest()` больше не делает второй generic `markFailure` после `generateChatID()`, а `scripts/qwen-client-chat-id-classification-test.js` входит в обычный `npm test`;
- старый FREE FABRIC E1 DIRECT PROBE завершён и не повторяется.

## Закрыто в этой смене: поздняя CAPTCHA в уже принятом SSE-потоке

Freshest незавершённый дефект из прошлого handoff закрыт в продуктовой ветке.

До исправления `src/chat-adapter.js` мог обнаружить `RGV587_ERROR` уже после initial SSE gate и передать `WAF_CAPTCHA_CHALLENGE:<url>` в streaming `onError`, но `server.js` сначала безусловно делал `accountStore.markFailure(...)`. В результате конкретный аккаунт получал обычный первый backoff около 30 секунд вместо локального CAPTCHA cooldown 10 минут.

Исправление:
- commit `3f71c47a1a96dbceeab438622f1e2bb857eaa6d2`: в `server.js` CAPTCHA-ветка теперь идёт до generic failure, вызывает `markCaptchaChallenge(account, 'CAPTCHA in accepted SSE response')`, сохраняет существующий `captchaResolver.solveCaptcha(...)` и делает `return`; остальные ошибки по-прежнему идут в `markFailure`;
- commit `4157de61703f5ddc7e5d6efef5d6c90946a9a946`: добавлен `scripts/server-late-stream-captcha-test.js`;
- commit `245f6faa9e04b8d7e9069bee5b9128d5822f871c`: новый регресс включён в обычный `npm test`.

Read-back текущего `server.js` подтверждает именно нужный порядок: `WAF_CAPTCHA_CHALLENGE -> markCaptchaChallenge -> captchaResolver -> return -> generic markFailure`. Новый blob `server.js`: `1cc090da4bb82d149a459e818f5b8f5f5844690e`.

Долговечное evidence: `autonomy/v3/evidence/QWEN_LATE_STREAM_CAPTCHA_FIX_20260820.json`.

## Следующий pool edge уже проверен по исходникам

Late accepted-stream `RateLimited` сейчас проходит через generic `markFailure`, который распознаёт `RateLimited` и оставляет шестичасовой cooldown. Дополнительной специальной ветки для этого не требуется.

`pipeThroughOpenAI()` автоматически повторяет только строго пустой ответ с ошибкой `Qwen upstream closed without a usable response`. Поздние CAPTCHA/RateLimited после принятого SSE не попадают под этот retry, поэтому уже видимый клиенту ответ автоматически не проигрывается повторно. В `server.js` любой streaming `onError` оставляет `streamAccepted=false`, поэтому неуспешный поток не переносит `account/thread affinity` через `sessionStore.set`.

Это пока source-level проверка, а не полный exact-tree runtime-прогон.

## Capsule v3

До этой смены `autonomy/v3/workspaces/QWEN_RELIABILITY/LATEST.json` отсутствовал. Создан первый immutable checkpoint/capsule:
- capsule id: `20260820T1450Z-late-stream-captcha`;
- manifest: `autonomy/v3/workspaces/QWEN_RELIABILITY/20260820T1450Z-late-stream-captcha/manifest.json`;
- archive SHA-256: `4bf99520d0e7ca0332bf8fd7731970d1a1ec5820eca86339cd08d068ecab5538`;
- 2 base64 parts, обе перечитаны после записи;
- `LATEST.json` обновлён только после read-back частей и manifest.

## Граница доказательства

- CircleCI/GitHub Actions не запускались и не перезапускались.
- Живых запросов к Qwen не было.
- Production, реальные аккаунты и секреты не тронуты.
- На hosted машине выполнена точная проверка применения минимального патча к fetched streaming-fragment; GitHub read-back после продуктовой записи PASS.
- Полный exact-tree `npm test` на hosted машине в этой смене не заявляется: приватное дерево репозитория напрямую в контейнер не материализуется без сетевого clone.

## Следующее

1. На следующем запуске сначала восстановить capsule `20260820T1450Z-late-stream-captcha` через `LATEST.json` и проверить archive/parts перед продолжением.
2. Если exact-tree удастся материализовать через доступный локальный/patch-исполнитель, прогнать минимум `server-late-stream-captcha-test`, `account-store-cooldown-test`, `account-selection-policy-test`, `server-no-eligible-account-test`, `qwen-client-chat-id-classification-test`, `qwen-client-thread-owner-test`, `opencode-thread-affinity-test` и связанные server/session tests; hosted CI для этого не нужен.
3. Следующий независимый безопасный кусок в зоне пула: проверить, может ли поздняя ошибка после уже эмитированного tool-call оставить локальный checkpoint в состоянии, при котором следующий пользовательский ход повторно воспроизведёт потенциальный side effect. Автоматический retry уже отсутствует; надо проверить именно поведение session checkpoint/client retry, не трогая Qwen Core.
4. Старый разрешённый live-trigger не дублировать вслепую. Provider traffic без нового доказанного основания не запускать.
