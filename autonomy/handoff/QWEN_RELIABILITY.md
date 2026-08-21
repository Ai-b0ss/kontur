# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого запуска: `73083123db9f3e18ea70fe06397b3bb4c84f83e2`.

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

## Этот запуск — canonical account boundaries усилены

Закрыты два связанных fail-open без provider/live.

### 1. Detached/stale preferred object обходил свежий cooldown

Если вызывающая часть держала старый object A, а канонический A уже получил cooldown, старый объект мог снова стать preferred.

Исправления:

- `f36a05f133afc8ab3f01360bb31712a99e2bafd4` — `candidates(preferredAccount)` разрешает preferred только через канонический id; `isAvailable()` смотрит на каноническое состояние;
- `db12853e8dc882aeb6eaaf8b1fced30b279afff9` — regression в штатном `scripts/account-selection-policy-test.js`;
- `8a1b251ce4d2e5dd52298861ad7f1f82f43dfc9e` — чувствительные границы account-store (`reset`, `markSuccess`, `markFailure`, CAPTCHA/restriction, cookie header) используют канонический объект, поэтому stale credentials/state не перезаписывают новое состояние;
- `59c3cf7f56951cee3693c43453c2ae2d6e2ef903` — regression на canonical cookie/state mutation.

Hosted Node: `CANONICAL_PREFERRED_ACCOUNT_FAILOVER_PASS`, `CANONICAL_PREFERRED_AND_STATE_BOUNDARY_PASS`.

### 2. Удалённый аккаунт мог воскреснуть через detached snapshot

После первого усиления `canonicalAccount()` всё ещё делал `get(id) || account`. Поэтому object удалённого A с оставшимся token теоретически мог снова пройти `isAvailable()` и старую ручную вставку preferred в qwen-client.

Исправления:

- `dd1287cdc096e5be0ebda881b59bdff60f2fbe08` — managed object с id теперь является только ссылкой в канонический pool; если id отсутствует после `remove()`, границы account-store fail closed вместо использования detached bytes;
- `73083123db9f3e18ea70fe06397b3bb4c84f83e2` — regression: `remove(A) -> staleA` не проходит `isAvailable`, не отдаёт cookie и не возвращается в candidates.

Hosted Node: `REMOVED_STALE_ACCOUNT_FAIL_CLOSED_PASS`.

## Следующий приоритет

`qwen-client.operationCandidates()` всё ещё содержит старую ручную вставку caller-owned `preferredAccount`. Усиленный account-store уже не позволяет ей обойти cooldown, использовать устаревшие credentials на границах или воскресить удалённый id, но код остаётся дублированным и хрупким.

Следующий безопасный кусок:

1. на свежем head проверить, не менялся ли `src/qwen-client.js` параллельно;
2. byte-safe заменить `operationCandidates()` на `accountStore.candidates(preferredAccount).slice(0, MAX_ACCOUNTS_PER_OPERATION)`;
3. regression должен доказать одновременно: healthy canonical preferred A остаётся первым для существующего треда; cooled/removed A не возвращается; новый независимый запрос остаётся LRU;
4. отдельно проверить `canReuseOriginalChatId` / `chatCreationCandidates`, чтобы thread affinity сохранялась только для канонически доступного владельца и новый sibling всегда получает новый thread id.

## Проверки и ограничения

- v4 LATEST на старте запуска: `20260821T045302Z-bfdec3c64a`, Git blob SHA `1f41272666f813674c994b730cc3f119912cf9be`;
- стартовая capsule прошла `capsule_runtime_v4.py verify` и `restore`, archive SHA `33e861113f659c9800281e366cfa0a2a58570854b6be030af989376caffefdcc`;
- промежуточный проверенный checkpoint этого запуска был опубликован как `20260821T055900Z-c9f08999a7` через CAS;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имеет DNS до GitHub; выполнены целевые hosted Node проверки и read-back продуктовых файлов.
