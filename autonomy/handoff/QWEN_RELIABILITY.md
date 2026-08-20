# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head по read-back: `896dea540fa3c73aefb69e319dd07d8622fef383`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, последний известный head `8aac48866595981804589c91d695cb3f1be39b76`.

## Что уже доказано и не надо переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера; CAPTCHA/rate limit/expired auth допускают ограниченное переключение, WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет владельца-аккаунт, а при допустимом failover локальная история переносится в свежий тред другого аккаунта;
- критичное состояние аккаунтов, OpenCode-сессий и provider circuit сохраняется с защитой от падения процесса;
- fail-open через stale `current()`/`preferredAccount`, когда `accountStore.candidates()` пуст, уже закрыт: configured-but-none-eligible даёт `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие настроенных аккаунтов остаётся `401`;
- cooldown монотонный: слабая последующая ошибка не сокращает более сильную CAPTCHA/rate-limit паузу;
- вторичный дефект `Failed to generate chat_id` закрыт: `sendChatRequest()` больше не делает второй generic `markFailure` после `generateChatID()`;
- поздняя CAPTCHA в уже принятом SSE-потоке идёт через `markCaptchaChallenge`, а не generic `markFailure`;
- старый FREE FABRIC E1 DIRECT PROBE завершён и не повторяется.

## Freshest finding: окно повторного side effect после streaming tool-call

Проверен следующий edge из прошлого handoff. Дефект подтверждён по текущим исходникам PR #6.

Сейчас `src/chat-adapter.js` может полностью эмитировать OpenAI `tool_calls` клиенту внутри `writeToolCallDeltas()`, а `server.js` сохраняет streaming checkpoint только после успешного завершения `pipeThroughOpenAI()`. Если после эмитированного tool-call приходит поздняя SSE-ошибка, `streamAccepted=false`, и streaming `sessionStore.set(...)` не выполняется.

Опасное окно:
1. клиент получил mutating tool-call и выполнил side effect;
2. поздняя SSE-ошибка не сохранила assistant tool-call в checkpoint;
3. процесс/сервер падает до следующего tool-result запроса клиента;
4. после restart короткий `continue` восстанавливает старый checkpoint без pending tool-call;
5. существующий `QWEN_PENDING_TOOL_RESULT` guard не срабатывает, поэтому модель теоретически может повторить уже выполненное действие.

Имеющиеся защиты остаются правильными:
- automatic retry поздней ошибки отсутствует;
- non-stream путь сохраняет accepted tool-call через `checkpointAcceptedToolProgress()`;
- когда tool-result уже дошёл до сервера, `restoreCheckpoint()` сохраняет завершённый прогресс до следующего upstream-запроса;
- если pending tool-call уже есть в checkpoint, короткий continuation даёт `409 QWEN_PENDING_TOOL_RESULT`.

### Bounded fix candidate

Подготовлен и локально проверен кандидат без изменения Qwen Core:
- `parseQwenSSE/pipeThroughOpenAI` получает синхронный callback `onToolCallsAccepted(calls)`;
- callback вызывается в `writeToolCallDeltas()` ДО первого tool-call delta клиенту;
- если durable checkpoint падает, поток fail-closed и tool-call не эмитируется;
- `server.js` внутри callback сохраняет `checkpointAcceptedToolProgress(restoredMessages, assistantMessage)` с текущими route account/chat id;
- поздняя CAPTCHA/rate-limit затем может пометить аккаунт, но pending-call checkpoint уже остаётся долговечным;
- matching tool result штатно снимает pending guard на следующем ходе.

Локальный hosted-тест `side-effect-window-test.js` PASS: старый checkpoint не видит pending call; guarded checkpoint видит ровно один pending call; matching tool-result снимает его.

Patch и тест лежат в v4 capsule `20260820T155435Z-f29775a5df`:
- `patches/stream-tool-checkpoint-guard.patch`;
- `evidence/side-effect-window-test.js`;
- `evidence/CHECKPOINT.md`.

Продуктовые `server.js` и `src/chat-adapter.js` в эту смену не переписывались через GitHub Contents API: оба большие и общие для нескольких линий, а коннектор отдаёт их частями; полная замена из усечённого read-back создаёт ненужный риск повреждения/перетирания свежих изменений. Следующий безопасный исполнитель должен применить маленький patch нормальным git/patch способом или иным byte-safe способом и затем добавить настоящий regression на SSE `tool_call -> late error -> restart -> continue`.

## Capsule runtime

На старте `LATEST.json` был прочитан с Git blob SHA `1a96f9899bff959230bd3253e7d6a74bb0024b85`. Он указывал на legacy capsule `20260820T1450Z-late-stream-captcha` со схемой `free_fabric_capsule_v3_b64`. Нормативный `capsule_runtime_v4.py restore` отклонил её с `RuntimeError: bad schema`; `PREVIOUS.json` отсутствовал. По protocol v2 применён recovery floor: exact GitHub source/evidence и продолжение полезной работы без угадывания байтов.

После работы создан настоящий v4 capsule:
- capsule id: `20260820T155435Z-f29775a5df`;
- manifest: `autonomy/v3/workspaces/QWEN_RELIABILITY/20260820T155435Z-f29775a5df/manifest.json`;
- archive SHA-256: `6a6fd2bbaf520587e42b1b1de4d713831dfd4bb0d4675dfa3e7fdfa0c5e75fd6`;
- 2 parts, обе перечитаны с GitHub и проверены: 2048 / 1960 chars, SHA-256 совпадают; reconstructed archive 3005 bytes, SHA-256 совпадает manifest.

Перед публикацией `LATEST` обязательно перечитать pointer и применить CAS по исходному blob SHA; при конфликте pointer не форсировать.

## Граница доказательства

- CircleCI, GitHub Actions и Cloudflare не запускались.
- Живых запросов к Qwen не было.
- Production, реальные аккаунты и секреты не тронуты.
- Полный exact-tree `npm test` не заявляется.
- Продуктовый fix side-effect window пока не применён; подготовлен точный bounded patch + локальный инвариантный тест.

## Следующее

1. Сначала восстановить новый v4 capsule через нормативный `capsule_runtime_v4.py`.
2. Применить `stream-tool-checkpoint-guard.patch` byte-safe способом в свежий head PR #6.
3. Добавить regression, который реально моделирует `accepted streaming tool-call -> late SSE error -> process restart -> short continue` и требует `409 QWEN_PENDING_TOOL_RESULT`; после matching tool result continuation должен снова работать.
4. Проверить, что callback вызывается до первого tool-call delta и ошибка durable save не позволяет клиенту увидеть mutating call.
5. Provider/live не повторять без отдельной доказанной необходимости.
