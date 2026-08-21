# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head на момент этого запуска: `a95e3fa365d62b4bce959f0508a82d99ec531679`.

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
- `reset(account)` не снимает provider-wide circuit;
- stale preferred object не обходит canonical cooldown/state;
- удалённый managed account не воскресает через detached snapshot.

## Свежая проверка этого запуска

PR #6 продвинулся с `73083123...` до `a95e3fa...` на три коммита. `compare_commits` показал изменения только в `src/stream-session-guard.js` и `scripts/stream-session-lifecycle-race-test.js`; `src/qwen-client.js` и `src/account-store.js` параллельно не менялись.

Незавершённый кусок из прошлого handoff остаётся актуальным: `qwen-client.operationCandidates()` вручную вставляет caller-owned `preferredAccount`, хотя `accountStore.candidates(preferredAccount)` уже полностью канонизирует preferred id и применяет LRU/cooldown/remove правила.

Точный byte-safe patch сохранён в каноническом control repo:
`autonomy/v3/candidates/QWEN_RELIABILITY_OPERATION_CANDIDATES_20260821.patch` (commit `9ec6ceee9600d19db7591a74ed255af4f8c1dac0`).

Патч сводит функцию к:
`return accountStore.candidates(preferredAccount).slice(0, MAX_ACCOUNTS_PER_OPERATION);`

Почему пока не применён в product branch: hosted container не имеет DNS до GitHub, а доступный GitHub Contents API заменяет большой общий `src/qwen-client.js` целиком. Ради удаления пяти строк риск полной ручной реконструкции файла выше пользы. Нужен byte-safe git/patch исполнитель или безопасный partial-edit инструмент.

## Проверка thread affinity

На свежем коде прочитаны `operationCandidates`, `canReuseOriginalChatId`, `chatCreationCandidates` и `sendChatRequest`.

После упрощения ожидаемый инвариант сохраняется:
- healthy canonical preferred A остаётся первым через `accountStore.candidates(preferredAccount)`;
- cooled/removed A не возвращается;
- independent request без preferred остаётся LRU;
- original chat id переиспользуется только когда выбранный account.id совпадает с preferredAccount.id и canonical preferred доступен;
- sibling B получает новый chat id через `generateChatID(..., B)`, а `chatCreationCandidates(B)` запрещает скрытый переход на C.

Следующий запуск должен сначала применить сохранённый маленький patch byte-safe способом, затем добавить/прогнать regression на эти четыре инварианта. После этого искать следующий независимый дефект в bounded retry / account-thread affinity.

## Постоянная память и ограничения

- LATEST на старте: `20260821T060242Z-70f4eb934f`;
- стартовый Git blob SHA LATEST: `d7d197fb4bfe0551530323739fb7097edab03d60`;
- manifest schema v4, archive SHA `aeab1d8abf8300f6f7375ece04f2e344de7e18a36c41929f207c14004adeb53a`;
- part length/SHA и archive length/SHA проверены на hosted машине; workspace восстановлен, CHECKPOINT/RESULTS прочитаны;
- CircleCI/GitHub Actions/Cloudflare не запускались;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имеет DNS до GitHub.
