# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head по read-back: `0834b5c6b3c710342db8f4454eb75140f95d18d5`.

## Уже доказано и не переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, provider-wide WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет account/thread affinity, а допустимый failover переносит локальную историю в свежий тред другого аккаунта;
- stale `current()`/`preferredAccount` fail-open закрыт: configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- cooldown монотонный; поздняя CAPTCHA в принятом SSE идёт через `markCaptchaChallenge`;
- duplicate `Failed to generate chat_id` classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- automatic retry поздней SSE-ошибки отсутствует;
- pending tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`.

## Что выяснено в свежем запуске

Предыдущий handoff считал незакрытым окно `streaming tool_call -> late SSE error -> restart`. На свежем PR #6 это окно уже закрыто другим, более консервативным механизмом: `src/stream-session-guard.js` удерживает потоковые tool-call delta и предшествующий вывод до вызова `onToolCallsAccepted`. При поздней ошибке mutating tool-call вообще не выпускается клиенту. `server.js` уже использует `streamSessionGuard.pipeThroughOpenAIGuarded()` и durable callback.

Слабым местом оставались регрессии: прежний тест проверял только один tool-call. На hosted Node расширенный вариант прошёл: два вызова, пришедшие раздельными delta, восстанавливаются вместе; до durable acceptance клиент не получает их; при поздней CAPTCHA ни один mutating call не выпускается. Изменение внесено в продуктовую ветку коммитом `0834b5c6b3c710342db8f4454eb75140f95d18d5`, файл `scripts/stream-session-guard-test.js`.

## Freshest defect: callback игнорирует `sessionStore.set() === false`

В текущем `server.js` `checkpointStreamingToolCalls(calls)` вызывает `sessionStore.set(...)`, но игнорирует его boolean-результат и затем безусловно считает `streamAcceptedHistory` подтверждённым.

Это настоящий fail-open именно на acknowledgement boundary. `sessionStore.set()` может вернуть `false`, если:
- нет ключа/`chatId`;
- тот же upstream `chatId` пытаются переобозначить на другой `accountId` (защита account/thread affinity).

Сейчас при таком `false` callback не бросает ошибку, guard считает durable acceptance успешным и может выпустить mutating tool-call клиенту, хотя checkpoint был отвергнут.

Ограниченный fix-кандидат уже проверен на hosted Node:

```js
const saved = sessionStore.set(...);
if (!saved) {
  const error = new Error('Accepted streaming tool call checkpoint was rejected');
  error.code = 'QWEN_TOOL_CHECKPOINT_REJECTED';
  throw error;
}
streamAcceptedHistory = nextHistory;
```

Invariant test PASS: unchecked `false` => поток считается принятым; guarded `false` => `QWEN_TOOL_CHECKPOINT_REJECTED`; `true` => обычное продолжение.

Точный patch и evidence лежат в нормативной v4 capsule `20260820T175839Z-e9ef25c0bf`:
- `patches/server-checkpoint-set-false-guard.patch`;
- `evidence/set-false-boundary-test.js`;
- `evidence/CHECKPOINT.md`.

Большой общий `server.js` через GitHub Contents API целиком не переписывался: безопаснее применить маленький patch нормальным byte-safe git/patch-исполнителем.

## Capsule runtime

В начале запуска `LATEST.json` имел Git blob SHA `4aee26d1c26df44870c4f38fc9b8d6482a32d855` и указывал на `20260820T165340Z-397ec501aa`. Capsule полностью восстановлена нормативным `capsule_runtime_v4.py restore`: PASS, archive SHA-256 `014f2a19a2b70cce4b21d9806d7cd08d5f6e02d52f9b30147c11cd5072365362`.

Первая новая immutable upload-попытка `20260820T175506Z-809d20f200` НЕ опубликована: read-back последней части показал лишний байт относительно manifest. Этот каталог считать только orphan/evidence of failed verification, никогда не назначать LATEST.

После повторного нормативного `pack` создана и полностью проверена capsule:
- id `20260820T175839Z-e9ef25c0bf`;
- archive SHA-256 `ba56ae4ed6dc52c4bc5e5761334d5204ba2e9b293f1c38daf1cc32f460d91f8c`;
- 3 parts: 2048 / 2048 / 1308 chars;
- remote Git blob SHA manifest и всех частей совпали с локально рассчитанными exact bytes;
- локальный `capsule_runtime_v4.py verify` PASS;
- локальный `capsule_runtime_v4.py restore` PASS с тем же archive SHA;
- перед CAS `LATEST` перечитан дважды и его blob SHA остался исходным `4aee26d1...`;
- старый LATEST сохранён в PREVIOUS;
- новый LATEST опубликован CAS с exact parent SHA; новый LATEST content blob `281fa187c07c12b0959f0e45bcb5af4539759e9a`.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- расширенный `stream-session-guard-test.js` фактически прогнан на hosted Node до push;
- полный exact-tree `npm test` не заявляется;
- новый `sessionStore.set(false)` fix пока только bounded patch/evidence, продуктовый `server.js` ещё не изменён.

## Следующее

1. Восстановить LATEST через нормативный v4.
2. Проверить свежий PR #6 head: если `server.js` не изменился по этому участку, byte-safe применить `server-checkpoint-set-false-guard.patch`.
3. Добавить настоящий regression на серверную границу: `sessionStore.set() -> false` внутри `onToolCallsAccepted` обязан fail-closed, не выпуская mutating tool-call клиенту.
4. Затем проверить `set=true -> tool_call visible -> restart -> short continue -> 409`, а после matching tool results continuation снова разрешается.
5. Если останется время, проверить аналогичные места, где boolean-return crash-safe store может игнорироваться на account/failover paths. Provider/live без доказанной необходимости не повторять.
