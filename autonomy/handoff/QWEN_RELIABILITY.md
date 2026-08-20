# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head: `a485c11e9f18470989b9e36086ef1aced1c68d39`.

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
- streaming `sessionStore.set() === false` fail-open закрыт через `QWEN_TOOL_CHECKPOINT_REJECTED`;
- регрессия охватывает два tool-call в одном потоке и позднюю CAPTCHA.

## Закрыто в этом запуске: два non-stream acknowledgement boundary

На входе PR #6 уже ушёл вперёд до `d14691184735f1b9c2840f31fc24bc227c14b759`. Свежий `server.js` подтвердил два оставшихся места того же класса:

1. основной non-stream путь после `collectNonStream(...)` игнорировал `sessionStore.set(...) === false`;
2. non-stream retry после успешного `collectNonStream(...)` делал то же самое и сразу возвращал JSON.

Если ответ содержал mutating tool-call, а checkpoint был отвергнут защитой account/thread affinity, клиент мог получить действие без durable pending-tool record.

Исправлено коммитом `5cb63f419c2fb711e1832367f22d20d5e8c33d7f`:

- оба non-stream пути требуют `sessionStore.set(...) === true` до возврата JSON;
- отказ получает стабильный код `QWEN_TOOL_CHECKPOINT_REJECTED` и fail-closed;
- локальный отказ checkpoint не передаётся в `accountStore.markFailure`, поэтому Qwen-аккаунт не получает ложные failures/cooldown;
- верхний route catch возвращает тот же стабильный код ошибки.

Коммитом `a485c11e9f18470989b9e36086ef1aced1c68d39` усилен уже существующий `scripts/server-nonstream-session-commit-test.js`: он теперь требует checked-save для основного и retry пути, проверяет порядок `collect -> save -> reject guard -> response`, отсутствие штрафа аккаунта и стабильный код ошибки. Этот тест уже входит в обычный `npm test`.

GitHub read-back на exact head подтверждает оба checked-save и отдельный route error code. На hosted Node выполнены `node --check` и узкая проверка инварианта; PASS. Полный exact-tree `npm test` не заявляется: hosted-машина не смогла материализовать репозиторий по сети, а внешние CI по правилам этой линии не запускались.

## Что не менять без нового доказательства

Финальный streaming `sessionStore.set(...)` после уже принятого guarded-потока пока не считать тем же дефектом автоматически. Mutating tool-call к этому моменту уже обязан иметь отдельный durable acknowledgement до выдачи клиенту. Сначала нужно доказать реальное окно повторного side effect или другой acknowledgement/failover инвариант.

Следующий поиск вести только по boolean-return/crash-safe store на настоящих границах подтверждения: где клиенту или следующему аккаунту становится видимо действие/тред только после надёжной записи. Не расширять работу на Qwen Core.

## Capsule runtime

В начале запуска `LATEST.json` имел Git blob SHA `dce683580308f5ad727c6a0ae49afdde81208968` и указывал на `20260820T185733Z-1fc6dd7627`. Manifest и все 4 части были получены отдельно и восстановлены нормативным `capsule_runtime_v4.py`; archive SHA-256 `5fa1f6f0f603d08dc01930e5d427085171cff558b53635d1cb8090e9c6c96335`.

После продуктовой работы checkpoint записан в восстановленное workspace и выполнен нормативный `pack` v4. Новая immutable capsule:

- id `20260820T200145Z-22a145762d`;
- source ref `Ai-b0ss/qwen-free-api@a485c11e9f18470989b9e36086ef1aced1c68d39`;
- archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`;
- archive size 4169 bytes;
- 3 parts: 2048 / 2048 / 1464 chars;
- remote manifest Git blob SHA `eafb87df100f93cb445bf7eb28db0cd8e448e79b`;
- remote part blob SHA: `369cace69ec6b7c9cfbc9d9caf0d92199e738e1f`, `6402061c731919a7898265e4344529c41902d97b`, `e7bcdb016b3ef75aafb3a047e89ddf6c74d9731f`;
- все remote blob SHA совпали с локально рассчитанными;
- нормативные local `verify` и `restore` после upload-readback PASS с тем же archive SHA;
- непосредственно перед публикацией LATEST перечитан: Git blob SHA остался стартовым `dce683580308f5ad727c6a0ae49afdde81208968`;
- старый LATEST сохранён в PREVIOUS;
- новый LATEST опубликован CAS через exact parent SHA;
- read-back нового LATEST: Git blob SHA `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c`.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный `npm test` не заявляется;
- продуктовые коммиты этого запуска: `5cb63f4...`, `a485c11...`;
- permanent memory опубликована по нормативному v2/v4 протоколу с CAS.

## Следующее

1. Восстановить LATEST `20260820T200145Z-22a145762d` через нормативный v4.
2. Проверить, не ушёл ли PR #6 вперёд от `a485c11...`; если ушёл — перечитать свежие затронутые границы.
3. Искать следующий реальный fail-open только на acknowledgement/failover boundary: игнорирование boolean-return crash-safe stores, публикация thread/account state до durable commit, либо путь повторного side effect после restart.
4. Не трогать финальный streaming checkpoint без отдельного воспроизведения риска; текущий mutating tool-call уже защищён более ранним durable guard.
5. При доступном exact-tree исполнителе прогнать обычный `npm test` на текущем head; внешние CI и provider/live для этого не нужны.
