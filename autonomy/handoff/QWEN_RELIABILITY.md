# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head по read-back: `896dea540fa3c73aefb69e319dd07d8622fef383`.

## Уже доказано и не переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, provider-wide WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет account/thread affinity, а допустимый failover переносит локальную историю в свежий тред другого аккаунта;
- stale `current()`/`preferredAccount` fail-open уже закрыт: configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- cooldown монотонный; поздняя CAPTCHA в принятом SSE идёт через `markCaptchaChallenge`;
- duplicate `Failed to generate chat_id` classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- automatic retry поздней SSE-ошибки отсутствует;
- pending tool-call в durable checkpoint уже блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`.

## Freshest defect: streaming tool-call может стать видимым раньше durable checkpoint

По exact head подтверждено: `src/chat-adapter.js` эмитирует OpenAI `tool_calls` внутри `writeToolCallDeltas()`, а `server.js` сохраняет streaming checkpoint только после успешного окончания `pipeThroughOpenAI()`. Если mutating tool-call уже ушёл клиенту, затем приходит поздняя SSE-ошибка и процесс падает до tool-result, после restart старый checkpoint может не содержать pending call. Это оставляет окно повторного side effect.

### Важное новое уточнение этого запуска

Предыдущий bounded patch из capsule `20260820T155435Z-f29775a5df` был недостаточен для нескольких tool-calls в одном ответе. `createToolCallStreamParser()` может выдавать завершённые вызовы в разных `push()`-порциях. Если callback сохраняет только текущий `calls` batch, второй checkpoint способен затереть первый pending call.

Патч усилен:
- `parseQwenSSE` хранит cumulative accepted tool calls на протяжении принятого stream;
- перед эмитом каждого нового batch callback получает весь накопленный набор;
- durable save остаётся acknowledgement boundary: при ошибке сохранения новый mutating call не должен стать видим клиенту;
- server сохраняет cumulative assistant `tool_calls` через существующий `checkpointAcceptedToolProgress()`;
- matching tool results снимают pending calls по одному штатной логикой `session-store`.

Hosted Node invariant test PASS: два tool-calls приходят отдельными batch; первый checkpoint содержит call-1, второй содержит call-1 + call-2; после результата call-1 остаётся только call-2; после второго результата pending-пусто.

Текущий patch/evidence находятся в normative v4 capsule `20260820T165340Z-397ec501aa`:
- `patches/stream-tool-checkpoint-guard.patch`;
- `evidence/side-effect-window-test.js`;
- `evidence/CHECKPOINT.md`.

Продуктовые `server.js` и `src/chat-adapter.js` пока не переписывались через GitHub Contents API: оба общие большие файлы, а доступный интерфейс требует полной замены; byte-safe git/patch executor предпочтительнее, чтобы не затереть соседние изменения.

## Capsule runtime

Стартовый `LATEST.json` Git blob SHA: `f1fb662761b1370472badb0e33569e84e1e9b597`, capsule `20260820T155435Z-f29775a5df`.

Он полностью восстановлен нормативным `capsule_runtime_v4.py restore`: PASS, archive SHA-256 `6a6fd2bbaf520587e42b1b1de4d713831dfd4bb0d4675dfa3e7fdfa0c5e75fd6`.

Новый checkpoint упакован нормативным v4:
- capsule id `20260820T165340Z-397ec501aa`;
- archive SHA-256 `014f2a19a2b70cce4b21d9806d7cd08d5f6e02d52f9b30147c11cd5072365362`;
- 3 parts: 2048 / 2048 / 156 chars;
- manifest и все parts загружены immutable и перечитаны с GitHub;
- перед публикацией `LATEST` перечитан повторно, blob SHA остался `f1fb662761b1370472badb0e33569e84e1e9b597`;
- прежний LATEST сохранён как PREVIOUS;
- новый LATEST опубликован CAS-обновлением с exact родительским blob SHA; новый content blob `4aee26d1c26df44870c4f38fc9b8d6482a32d855`.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный exact-tree `npm test` не заявляется;
- продуктовый fix ещё не применён, но patch-кандидат теперь закрывает и multi-tool overwrite edge.

## Следующее

1. Восстановить `LATEST` через нормативный v4.
2. Применить `stream-tool-checkpoint-guard.patch` byte-safe способом к свежему PR #6 head.
3. Добавить настоящий regression: `tool_call #1 -> tool_call #2 -> late SSE error -> restart -> short continue` должен видеть оба pending calls и вернуть `409 QWEN_PENDING_TOOL_RESULT`.
4. Отдельно проверить fail-closed границу: ошибка durable save до первого delta конкретного нового call не позволяет клиенту увидеть этот mutating call.
5. После matching tool results continuation снова должен работать; provider/live не повторять без доказанной необходимости.
