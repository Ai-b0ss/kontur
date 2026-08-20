# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-20.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий продуктовый head: `d367bf0c4a5091d29bbed2b7546e352ddd2b1ff9`.

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

## Закрыто: два non-stream acknowledgement boundary

На входе этого запуска PR #6 был на `d14691184735f1b9c2840f31fc24bc227c14b759`. Свежий `server.js` подтвердил два места того же класса:

1. основной non-stream путь после `collectNonStream(...)` игнорировал `sessionStore.set(...) === false`;
2. non-stream retry после успешного `collectNonStream(...)` делал то же самое и сразу возвращал JSON.

Если ответ содержал mutating tool-call, а checkpoint был отвергнут защитой account/thread affinity, клиент мог получить действие без durable pending-tool record.

Исправлено коммитом `5cb63f419c2fb711e1832367f22d20d5e8c33d7f`:

- оба non-stream пути требуют `sessionStore.set(...) === true` до возврата JSON;
- отказ получает стабильный код `QWEN_TOOL_CHECKPOINT_REJECTED` и fail-closed;
- локальный отказ checkpoint не передаётся в `accountStore.markFailure`, поэтому Qwen-аккаунт не получает ложные failures/cooldown;
- верхний route catch возвращает тот же стабильный код ошибки.

Коммитом `a485c11e9f18470989b9e36086ef1aced1c68d39` усилен `scripts/server-nonstream-session-commit-test.js`: checked-save для основного и retry пути, порядок `collect -> save -> reject guard -> response`, отсутствие штрафа аккаунта и стабильный код ошибки. Тест уже входит в обычный `npm test`.

GitHub read-back на exact head подтверждает оба checked-save. На hosted Node выполнены `node --check` и узкая проверка инварианта; PASS. Полный exact-tree `npm test` не заявляется: hosted-машина не смогла материализовать репозиторий по сети, а внешние CI по правилам этой линии не запускались.

## Закрыто следом: account reset мог снять provider-wide circuit

После первого исправления проверена связка `account-store.reset()` -> `providerCircuit.clear(target.id)`.

В `provider-circuit.clear(expectedAccountId)` прежняя проверка была слишком слабой: если circuit имел `accountId=null` (например provider-wide `provider_pressure` / `ambiguous_timeout`), reset любого отдельного аккаунта проходил проверку и удалял общий safety circuit. Это позволяло вручную/локально снять provider-wide stop через операцию, которая по смыслу разблокирует только один аккаунт.

Коммит `a6f74660ca607b357b398e746a3eb68fdec208c8` меняет правило: account-scoped clear может удалить только circuit, который явно принадлежит тому же account id. Состояние с `accountId=null` теперь переживает `store.reset(account)` и требует явного глобального `clearProviderCircuit()`.

Коммит `d367bf0c4a5091d29bbed2b7546e352ddd2b1ff9` усиливает `scripts/provider-safety-test.js`:

- exact-account WAF recovery по-прежнему может снять свой circuit;
- `provider_pressure` с `accountId=null` переживает reset отдельного аккаунта;
- `candidates()` остаётся пустым, пока provider-wide circuit активен;
- явный `store.clearProviderCircuit()` сохраняется как единственный глобальный путь очистки.

GitHub read-back `src/provider-circuit.js` подтверждает строгую проверку `state.accountId !== expectedAccountId => false`.

## Что не менять без нового доказательства

Финальный streaming `sessionStore.set(...)` после уже принятого guarded-потока пока не считать тем же дефектом автоматически. Mutating tool-call к этому моменту уже обязан иметь отдельный durable acknowledgement до выдачи клиенту. Сначала нужно доказать реальное окно повторного side effect или другой acknowledgement/failover инвариант.

Следующий поиск вести только по boolean-return/crash-safe store на настоящих границах подтверждения: где клиенту или следующему аккаунту становится видимо действие/тред только после надёжной записи. Не расширять работу на Qwen Core.

## Capsule runtime

В начале запуска `LATEST.json` имел Git blob SHA `dce683580308f5ad727c6a0ae49afdde81208968` и указывал на `20260820T185733Z-1fc6dd7627`. Manifest и все 4 части были получены отдельно и восстановлены нормативным `capsule_runtime_v4.py`; archive SHA-256 `5fa1f6f0f603d08dc01930e5d427085171cff558b53635d1cb8090e9c6c96335`.

После первого продуктового исправления создана и полностью проверена capsule:

- id `20260820T200145Z-22a145762d`;
- source ref `Ai-b0ss/qwen-free-api@a485c11e9f18470989b9e36086ef1aced1c68d39`;
- archive SHA-256 `1fb1a101a1f1bc5de1dccbea32c2a1a3deeb3aa57998f2f2a3a3c4293680df90`;
- remote manifest/parts blob SHA совпали с локально рассчитанными;
- нормативные `verify` и `restore` PASS;
- старый LATEST сохранён в PREVIOUS;
- LATEST опубликован CAS через стартовый parent SHA;
- read-back LATEST blob `b7e0d3d38573fb1ef6e2f93a54904c3af2c5462c`.

После второго продуктового исправления workspace снова обновлён и выполнены новые нормативные `pack`/`verify`. Три последующие immutable upload-попытки НЕ опубликованы как LATEST из-за обязательной byte-verification:

- `20260820T200726Z-d8fdaa0bbf`: remote `part-0001` Git blob не совпал с локальным;
- `20260820T200937Z-723152a3f0`: remote `part-0003` Git blob не совпал с локальным;
- `20260820T201210Z-d32eb4bf64`: remote single-part blob не совпал с локальным.

Эти каталоги immutable и считаются orphan/evidence only; их нельзя исправлять на месте или назначать LATEST. Кроме того, LATEST уже изменился относительно SHA, запомненного в начале запуска, поэтому по протоколу второй CAS поверх него в этом запуске не делался. Текущий нормативный LATEST остаётся `20260820T200145Z-22a145762d`; сведения о втором исправлении надёжно сохранены в продуктовых коммитах и этом handoff. Следующий запуск должен восстановить LATEST, затем материализовать exact product head `d367bf0...` и создать свежую capsule новым id.

## Граница доказательства

- CircleCI, GitHub Actions, Cloudflare и provider/live не запускались;
- production, реальные аккаунты и секреты не тронуты;
- полный `npm test` не заявляется;
- продуктовые коммиты этого запуска: `5cb63f4...`, `a485c11...`, `a6f7466...`, `d367bf0...`;
- permanent memory через LATEST гарантированно содержит состояние после первого исправления; второе зафиксировано в exact Git product head + handoff, но новый LATEST намеренно не форсировался после неудачной byte-verification.

## Следующее

1. Восстановить LATEST `20260820T200145Z-22a145762d` нормативным v4.
2. Проверить свежий PR #6; при отсутствии более нового писателя материализовать exact `d367bf0...` и создать новую capsule с новым id, не переиспользуя три failed upload каталога.
3. Искать следующий реальный fail-open только на acknowledgement/failover boundary: игнорирование boolean-return crash-safe stores, публикация thread/account state до durable commit, либо путь повторного side effect после restart.
4. Не трогать финальный streaming checkpoint без отдельного воспроизведения риска.
5. При доступном exact-tree исполнителе прогнать обычный `npm test`; внешние CI и provider/live для этого не нужны.
