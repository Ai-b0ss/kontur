# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого запуска: `59c3cf7f56951cee3693c43453c2ae2d6e2ef903`.

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

## Этот запуск — stale preferred/account object закрыт на границе account-store

Исходный fail-open из прошлого handoff воспроизведён и исправлен без provider/live.

Проблема: вызывающая часть могла держать detached/stale object A, пока канонический A в пуле уже получил свежий cooldown. `candidates(preferredAccount)` и `qwen-client.operationCandidates()` могли снова предпочесть старый объект.

Исправления в продуктовой ветке:

- `f36a05f133afc8ab3f01360bb31712a99e2bafd4` — `candidates(preferredAccount)` теперь разрешает preferred только по id через канонический объект; `isAvailable()` для известного id смотрит на каноническое состояние, поэтому stale object не обходит cooldown даже при старой ручной вставке в `qwen-client`;
- `db12853e8dc882aeb6eaaf8b1fced30b279afff9` — regression в уже штатном `scripts/account-selection-policy-test.js`: stale object и строковый preferred id не могут вернуть охлаждённый A;
- `8a1b251ce4d2e5dd52298861ad7f1f82f43dfc9e` — все чувствительные границы account-store (`reset`, `markSuccess`, `markFailure`, CAPTCHA/restriction и cookie header) заново разрешают известный object по каноническому id. Это не даёт detached snapshot протащить старые credentials или перезаписать новое состояние пула;
- `59c3cf7f56951cee3693c43453c2ae2d6e2ef903` — regression дополнен проверкой canonical cookie/state mutation.

Hosted Node без сети/provider прошёл:

- `CANONICAL_PREFERRED_ACCOUNT_FAILOVER_PASS`;
- `CANONICAL_PREFERRED_AND_STATE_BOUNDARY_PASS`.

Важно: `qwen-client.operationCandidates()` пока всё ещё содержит старую ручную вставку `preferredAccount`. Текущий account-store уже не даёт ей обойти cooldown и использует канонические credentials/state на своих границах, но сам `qwen-client` желательно позже упростить до `accountStore.candidates(preferredAccount)` нормальным byte-safe patch способом.

## Следующий найденный крайний случай

После усиления канонизации обнаружен следующий риск, который надо проверить первым в следующем проходе: `canonicalAccount()` пока делает `get(id) || account`. Значит detached object аккаунта, который уже удалён из канонического пула, теоретически остаётся пригодным как fallback-объект. Если такой stale object ещё держит `token`, старый `qwen-client` может попытаться воскресить удалённый аккаунт.

Следующая проверка должна быть полностью офлайн:

1. создать A и B;
2. сохранить detached snapshot A;
3. удалить канонический A через `remove()`;
4. проверить `isAvailable(staleA)`, `candidates(staleA)` и эмуляцию старого `operationCandidates`;
5. если A оживает — fail closed для managed-id, отсутствующего в `accounts`, не ломая обычный `save/load/current` и thread affinity канонических аккаунтов.

## Проверки и ограничения

- v4 LATEST на старте: `20260821T045302Z-bfdec3c64a`;
- стартовый Git blob SHA LATEST: `1f41272666f813674c994b730cc3f119912cf9be`;
- `capsule_runtime_v4.py verify` = PASS;
- `capsule_runtime_v4.py restore` = PASS;
- archive SHA старта: `33e861113f659c9800281e366cfa0a2a58570854b6be030af989376caffefdcc`;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имеет DNS до GitHub; выполнены целевые hosted Node проверки и read-back продуктовых файлов.
