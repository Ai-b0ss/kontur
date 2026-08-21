# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head, прочитанный в этом запуске: `a8a81c4b2dcbc97eedf24644a0b92dab97a1da29`. Между прежним `5c7df532...` и ним изменились только `src/session-store.js` и новый session-test; account-pool файлы не пересекались.

## Уже доказано и не переделывать

- локальные проблемы аккаунта отделены от provider-wide WAF/trust/pressure;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, общий provider circuit останавливает sibling probing;
- account/thread affinity сохраняется для существующего треда, допустимый failover создаёт свежий тред на соседнем аккаунте;
- configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- account cooldown и provider-wide cooldown монотонны по времени;
- поздняя CAPTCHA после принятого SSE классифицируется как CAPTCHA конкретного аккаунта;
- duplicate chat-id classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- pending mutating tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`;
- streaming и non-stream tool-calls не выпускаются клиенту при `sessionStore.set() === false`;
- поздний transport error учитывается ровно один раз;
- empty/metadata-only/terminal-only initial SSE не считается успешным model output;
- unconfirmed initial release, позднее доказанный пустым, охлаждает фактический аккаунт один раз и выбирает свежего sibling;
- `reset(account)` не снимает provider-wide circuit.

## Этот запуск — stale preferred object может обойти свежий cooldown

Найден независимый fail-open в выборе preferred account.

`account-store.candidates(preferredAccount)` при переданном объекте доверяет самому объекту, а не каноническому экземпляру из `accounts`. Затем `qwen-client.operationCandidates()` ещё раз вручную вставляет переданный `preferredAccount`, если `isAvailable(preferredAccount)` вернул true.

Если вызывающий код держит старый объект A, а каноническое состояние A в пуле уже получило новый cooldown, старый объект всё ещё может выглядеть доступным и снова попасть первым кандидатом. Это нарушает инвариант «последнее каноническое состояние пула определяет доступность аккаунта».

Hosted Node воспроизведение без provider/live:

- канонический A: cooldown активен;
- stale preferred A: cooldown=0;
- B: доступен;
- старая логика => `A, B`;
- исправленная логика => `B`;
- результат: `CANONICAL_PREFERRED_ACCOUNT_FAILOVER_PASS`.

Подготовлен точный patch-кандидат: `autonomy/v3/candidates/QWEN_RELIABILITY_CANONICAL_PREFERRED_ACCOUNT_20260821.patch`, commit control-repo `a6f3fbeb6ba331de64ebd3aaff0e1b2c45ea3be1`.

Патч делает две вещи:

1. `account-store.candidates()` извлекает только id из preferred и затем обязательно заново получает канонический объект через `get(id)` перед `isAvailable()`.
2. `qwen-client.operationCandidates()` больше не вставляет caller-owned object вручную, а делегирует preferred ordering в `accountStore.candidates(preferredAccount)`.

В product PR патч пока не применён: оба файла большие и общий write через Contents API требует полной замены; при активном соседнем writer безопаснее оставить exact patch, чем затереть свежие изменения. Нужен byte-safe git/patch исполнитель или повторный проход после проверки свежего head.

## Проверки и ограничения

- v4 LATEST на старте: `20260821T035831Z-5cb774203d`;
- стартовый Git blob SHA LATEST: `5d03f31813b6080bfd66a7bf327316ad1630b3c8`;
- `capsule_runtime_v4.py verify` = PASS;
- `capsule_runtime_v4.py restore` = PASS;
- archive SHA: `e6c958ce38ac2ee3ec224f433284ce924bcf63a0dd99c5a713a8348b979d1255`;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container по-прежнему не имеет DNS до GitHub.

## Следующий приоритет

1. Перед product write снова прочитать свежий PR #6 head и убедиться, что `src/account-store.js` / `src/qwen-client.js` не изменились параллельно.
2. Применить `QWEN_RELIABILITY_CANONICAL_PREFERRED_ACCOUNT_20260821.patch` byte-safe способом.
3. Добавить regression: detached preferred A со старым `unavailableUntil=0`, канонический A уже cooled, B healthy => кандидатом первым должен быть B; строковый preferred id A тоже не должен обходить cooldown.
4. Включить regression в обычный `npm test`; выполнить hosted проверку без provider/live.
5. После этого искать следующий независимый дефект только в pool/cooldown/provider circuit/preferred-current/failover/thread affinity/side-effect replay.
