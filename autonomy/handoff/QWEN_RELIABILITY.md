# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head после этого запуска: `521cf13b04076deee57dc2544f7b29b4dd8a841f`.

## Уже доказано и не переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, provider-wide WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет account/thread affinity, а допустимый failover переносит локальную историю в свежий тред другого аккаунта;
- stale `current()`/`preferredAccount` fail-open закрыт: configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- cooldown монотонный; поздняя CAPTCHA в принятом SSE идёт через `markCaptchaChallenge`;
- duplicate `Failed to generate chat_id` classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- automatic retry поздней SSE-ошибки отсутствует;
- pending tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`;
- `src/stream-session-guard.js` удерживает потоковые mutating tool-calls до durable acceptance; поздняя SSE-ошибка не выпускает их клиенту;
- регрессия охватывает два tool-call в одном потоке и позднюю CAPTCHA.

## Закрыто в этом запуске: `sessionStore.set() === false` на streaming acknowledgement boundary

На входе был head `0834b5c6b3c710342db8f4454eb75140f95d18d5`. В `server.js` callback `checkpointStreamingToolCalls(calls)` вызывал `sessionStore.set(...)`, игнорировал boolean-результат и затем безусловно обновлял `streamAcceptedHistory`.

Это было fail-open: `sessionStore.set()` законно возвращает `false`, когда нет ключа/`chatId` или когда тот же upstream `chatId` пытаются переобозначить на другой `accountId` (защита account/thread affinity). При таком отказе guard мог счесть mutating tool-call надёжно сохранённым и выпустить его клиенту.

Исправлено коммитом `ccae1e23042eb136448eeb596926375e188359f4`:

```js
const saved = sessionStore.set(...);
if (!saved) {
  const error = new Error('Accepted streaming tool call checkpoint was rejected');
  error.code = 'QWEN_TOOL_CHECKPOINT_REJECTED';
  throw error;
}
streamAcceptedHistory = nextHistory;
```

Read-back commit diff подтверждает: изменение ограничено этой границей подтверждения. Затем коммитом `521cf13b04076deee57dc2544f7b29b4dd8a841f` усилен существующий `scripts/server-stream-session-guard-wiring-test.js`: он теперь требует проверку результата `sessionStore.set`, код `QWEN_TOOL_CHECKPOINT_REJECTED` и порядок `save -> reject guard -> history commit -> guarded pipe -> final checkpoint`.

На hosted Node 22 фактически выполнен bounded invariant test из восстановленной capsule: `sessionStore.set(false)` блокирует выпуск streaming tool-call; `true` разрешает продолжение. Нормативный v4 verify/restore новой capsule также PASS. Полный exact-tree `npm test` в этом запуске не заявляется.

## Freshest defect: два non-stream пути игнорируют тот же boolean-return

После закрытия streaming-границы проверен текущий `server.js`. Остались два аналогичных места:

1. Основной non-stream путь после `collectNonStream(...)` вызывает `sessionStore.set(...)`, игнорирует `false`, затем возвращает `res.json(json)`.
2. Non-stream retry-путь после успешного `collectNonStream(...)` также игнорирует `false` и немедленно возвращает JSON.

Если ответ содержит mutating tool-call, а checkpoint отвергнут из-за account/thread affinity, клиент может получить и выполнить действие без durable pending-tool record. Это тот же класс риска повторного side effect после restart.

Важная тонкость для исправления: нельзя просто бросить `QWEN_TOOL_CHECKPOINT_REJECTED` внутри нынешнего `try` и оставить catch без изменений, потому что общий catch сейчас вызывает `accountStore.markFailure(response.account, err.message)`. Локальный отказ session checkpoint не является ошибкой Qwen-аккаунта и не должен портить его failures/cooldown. Следующий fix должен одновременно:

- требовать `sessionStore.set(...) === true` до возврата non-stream tool-call JSON;
- на `false` выдавать стабильный `QWEN_TOOL_CHECKPOINT_REJECTED` и fail-closed;
- не вызывать `accountStore.markFailure` для этого локального кода ошибки;
- покрыть основной и retry non-stream путь;
- доказать: rejected checkpoint => mutating tool-call JSON не возвращён; accepted checkpoint => после restart короткий `continue` видит pending tool-call и блокируется до matching tool result.

Финальный streaming `sessionStore.set(...)` после уже принятого guarded-потока отдельно не менять без анализа: mutating tool-call к этому моменту уже обязан иметь durable acknowledgement.

## Capsule runtime

В начале запуска `LATEST.json` имел Git blob SHA `281fa187c07c12b0959f0e45bcb5af4539759e9a` и указывал на `20260820T175839Z-e9ef25c0bf`. Manifest и все 3 части были получены отдельно; после устранения локально добавленных переводов строки exact bytes прошли нормативные `capsule_runtime_v4.py verify` и `restore`, archive SHA-256 `ba56ae4ed6dc52c4bc5e5761334d5204ba2e9b293f1c38daf1cc32f460d91f8c`.

Первая новая immutable попытка `20260820T185550Z-799159dd0e` НЕ опубликована: manifest был загружен с семантически тем же JSON, но не с byte-identical форматированием, поэтому remote Git blob SHA не совпал с локально рассчитанным. Этот каталог считать orphan/evidence of failed verification, никогда не назначать LATEST.

После повторного нормативного `pack` создана чистая capsule:

- id `20260820T185733Z-1fc6dd7627`;
- source ref `Ai-b0ss/qwen-free-api@521cf13b04076deee57dc2544f7b29b4dd8a841f`;
- archive SHA-256 `5fa1f6f0f603d08dc01930e5d427085171cff558b53635d1cb8090e9c6c96335`;
- archive size 4687 bytes;
- 4 parts: 2048 / 2048 / 2048 / 108 chars;
- remote manifest Git blob SHA `6eb88ebb262bb1cd0128a4d84683b032372d0701` совпал с локально рассчитанным;
- remote part blob SHA совпали с локальными: `539155e9...`, `4885332e...`, `a89eb7c4...`, `3e720e96...`;
- локальный `capsule_runtime_v4.py verify` PASS;
- локальный `capsule_runtime_v4.py restore` PASS с тем же archive SHA;
- перед публикацией LATEST перечитан повторно и его parent blob остался исходным `281fa187...`;
- старый LATEST сохранён в PREVIOUS;
- LATEST опубликован CAS с exact parent SHA;
- новый LATEST content blob после read-back: `dce683580308f5ad727c6a0ae49afdde81208968`.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный `npm test` не заявляется;
- сделаны два продуктовых коммита: `ccae1e...` и `521cf13...`;
- permanent memory опубликована по нормативному v2/v4 протоколу с CAS.

## Следующее

1. Восстановить LATEST `20260820T185733Z-1fc6dd7627` через нормативный v4.
2. Проверить, не ушёл ли PR #6 вперёд от `521cf13...`; при изменении перечитать свежий `server.js`.
3. Закрыть два non-stream `sessionStore.set(false)` acknowledgement boundary без штрафа Qwen-аккаунту за локальный отказ checkpoint.
4. Добавить regression на основной и retry-путь: rejected checkpoint не выпускает mutating tool-call JSON; accepted checkpoint после restart даёт `QWEN_PENDING_TOOL_RESULT` до matching tool result.
5. Затем проверить другие boolean-return crash-safe stores только на реальных acknowledgement/failover boundary, не расширяя область на Qwen Core.
