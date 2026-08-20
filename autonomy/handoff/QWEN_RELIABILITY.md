# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. На момент этой смены свежий head: `4bfe1cf36bb5022d30e924a4a871502c34b96622`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, последний известный head `8aac48866595981804589c91d695cb3f1be39b76`.

## Что уже доказано и не надо переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера; CAPTCHA/rate limit/expired auth допускают ограниченное переключение, WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет владельца-аккаунт, а при допустимом failover локальная история переносится в свежий тред другого аккаунта;
- критичное состояние аккаунтов, OpenCode-сессий и provider circuit сохраняется с защитой от падения процесса;
- fail-open через stale `current()`/`preferredAccount`, когда `accountStore.candidates()` пуст, уже закрыт: configured-but-none-eligible даёт `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие настроенных аккаунтов остаётся `401`;
- cooldown монотонный: слабая последующая ошибка не сокращает более сильную CAPTCHA/rate-limit паузу;
- вторичный дефект `Failed to generate chat_id` уже закрыт на текущем PR: `sendChatRequest()` больше не делает второй generic `markFailure` после `generateChatID()`, а `scripts/qwen-client-chat-id-classification-test.js` добавлен и включён в обычный `npm test` на commit `4bfe1cf36bb5022d30e924a4a871502c34b96622`;
- старый FREE FABRIC E1 DIRECT PROBE завершён и не повторяется.

## Новое существенное наблюдение этой смены

Найден следующий независимый дефект пула на exact head `4bfe1cf36bb5022d30e924a4a871502c34b96622`.

`src/chat-adapter.js` умеет обнаружить `RGV587_ERROR` и после того, как initial SSE gate уже отпустил поток, и превращает его в `Error('WAF_CAPTCHA_CHALLENGE:<url>')`. Но `server.js` в streaming `onError` сначала безусловно вызывает `accountStore.markFailure(error.message)`, а только затем вызывает `captchaResolver`.

Из-за этого поздняя CAPTCHA конкретного аккаунта получает обычный первый backoff около 30 секунд вместо установленного локального CAPTCHA cooldown 10 минут. Provider-wide circuit при этом не открывается, но аккаунт возвращается в пул слишком рано.

На ChatGPT hosted Node без provider traffic воспроизведена сама политика текущего кода и минимального исправления:
- текущая поздняя CAPTCHA: ~30 000 мс;
- после CAPTCHA-specific `markCaptchaChallenge`: 600 000 мс;
- контрольный RateLimited остаётся 21 600 000 мс;
- одна ошибка учитывается один раз.

Долговечное evidence: `autonomy/v3/evidence/QWEN_LATE_STREAM_CAPTCHA_COOLDOWN_20260820.json`.
Кандидат продуктовой правки: `autonomy/v3/candidates/QWEN_LATE_STREAM_CAPTCHA_COOLDOWN_20260820.patch`.
Кандидат регрессии: `autonomy/v3/candidates/QWEN_LATE_STREAM_CAPTCHA_COOLDOWN_REGRESSION_20260820.patch`.

Минимальная правка: в streaming `onError` сначала выделить `WAF_CAPTCHA_CHALLENGE`, вызвать `markCaptchaChallenge(..., 'CAPTCHA in accepted SSE response')`, сохранить существующий `captchaResolver.solveCaptcha(...)` и выйти; generic `markFailure` оставить только для остальных ошибок. Account/thread affinity, replay, provider circuit и rate-limit семантику не менять.

## Граница доказательства

- CircleCI/GitHub Actions не запускались и не перезапускались.
- Живых запросов к Qwen не было.
- Production, реальные аккаунты и секреты не тронуты.
- Полный exact-tree `npm test` на hosted машине в этой смене не заявляется: приватное дерево репозитория напрямую в контейнер не материализовано.
- Поэтому продуктовый patch поздней CAPTCHA пока оставлен кандидатом, а не перенесён через рискованную полную замену большого `server.js` посредством Contents API.

## Следующее

1. При доступном безопасном patch/git-исполнителе применить только `QWEN_LATE_STREAM_CAPTCHA_COOLDOWN_20260820.patch` к свежему head и добавить регрессию.
2. Локально прогнать минимум `server-late-stream-captcha-test`, `account-store-cooldown-test`, `account-selection-policy-test`, `server-no-eligible-account-test`, `qwen-client-chat-id-classification-test`, `qwen-client-thread-owner-test`, `opencode-thread-affinity-test`, связанные server/session tests; hosted CI для этого не нужен.
3. После PASS проверить следующий pool edge: late accepted-stream RateLimited/CAPTCHA не должны ни сокращать cooldown, ни менять thread owner, ни приводить к автоматическому повтору уже видимого клиенту ответа.
4. Старый разрешённый live-trigger не дублировать вслепую. Provider traffic без нового доказанного основания не запускать.
