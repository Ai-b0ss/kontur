# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `1fa05ec1e7b8c78be844e8131ee1f58167625f5f`.
Перед новой записью перечитать fresh PR head и exact blobs: параллельно работает QWEN_CORE.

## Новый воспроизведённый дефект — cooldown может измениться между affinity-решением и provider dispatch
Fresh `src/qwen-client.js` на head до теста `5b6fb7f4a7df608548bf4f098832c6b4d7ce2fff` делает в `sendChatRequest()` два отдельных `canReuseOriginalChatId(...)`.

Опасная последовательность:
1. первый `canReuseOriginalChatId(A, oldChatId, A)` видит A доступным и решает переиспользовать старый Qwen thread;
2. параллельный уже летящий запрос получает CAPTCHA/rate-limit и переводит канонический A в cooldown;
3. второй `canReuseOriginalChatId(...)` уже возвращает false, поэтому `markProviderAttempt()` **не вызывается**;
4. несмотря на это код всё равно делает `axios.post(...)` на A с прежним `accountChatId`.

Итог: свежий cooldown может быть обойдён непосредственно перед completion dispatch, а provider request одновременно не попадает в request-wide attempted-account budget.

Hosted deterministic model выполнен без live Qwen:
`AFFINITY_COOLDOWN_RACE_REPRO first=true second=false attempted=[] provider_calls=1`.

Продуктовый регресс уже добавлен безопасным отдельным файлом:
- `scripts/pre-dispatch-account-availability-test.js`
- commit `1fa05ec1e7b8c78be844e8131ee1f58167625f5f`.

Тест пока намеренно **не включён** в штатный `npm test`, потому что продуктовый фикс ещё не применён и тест должен быть красным на старой реализации.

Точный минимальный patch сохранён в control repo:
`autonomy/v3/candidates/QWEN_RELIABILITY_PRE_DISPATCH_COOLDOWN_RACE_20260822.patch`
(commit `5948e09045bbaca99d51b6ced909af5395a6f4e8`).

Правильная граница:
- после локальной подготовки completion headers и непосредственно перед provider dispatch заново проверить `accountStore.isAvailable(account)` на каноническом состоянии;
- если аккаунт уже охлаждён/заблокирован — `continue` к bounded sibling failover без provider call;
- после успешной свежей проверки всегда вызвать `markProviderAttempt(attemptContext, account)` перед `axios.post`, независимо от того, был ли thread переиспользован или только что создан;
- вызовы идут синхронно до начала `axios.post`, поэтому между свежей проверкой и фактическим стартом provider call другой JS callback не успевает изменить cooldown.

Большой общий `qwen-client.js` целиком через Contents API в этом проходе не перезаписывался: hosted filesystem не имеет DNS до GitHub, а полная ручная реконструкция активно используемого файла ради нескольких строк создаёт риск затереть параллельную работу. Следующий byte-safe/git patch executor может применить готовый patch без новой разведки.

## CircleCI final gate — старый exact gate не повторять
Gate для product SHA `b49bec79def089680941ef4bd29cc2ded1198b69`, config commit `94f8ba55d75f076c58673bff3aabce7b8a756c54`, был запущен ранее.
Fresh GitHub combined-status check этого exact gate commit в текущем проходе снова вернул `statuses=[]`.
Это остаётся `RESULT_ACCESS_PENDING_OR_UNAVAILABLE`, не PASS и не FAIL. Повторно тот же SHA не триггерить.

Product branch уже ушёл вперёд, поэтому новый CircleCI gate допустим только после нового targeted PASS на выбранном финальном product SHA и координации с QWEN_CORE; обычную product-ветку для CircleCI не использовать.

## Предыдущий закрытый дефект — crash между двумя rename больше не теряет аккаунт
В `src/account-store.js::persist()` порядок замены был:
1. fsync нового temp;
2. `old canonical -> .txn-backup-<suffix>`;
3. `temp -> canonical`;
4. fsync каталога.

Если процесс умирал между шагами 2 и 3, после restart canonical `.json` отсутствовал, а `load()` видел только `*.json` и полностью игнорировал `.txn-backup-*`. В результате подтверждённый аккаунт/его cooldown мог исчезнуть из пула, хотя старые подтверждённые bytes оставались на диске.

Hosted repro до исправления:
`ACCOUNT_TXN_CRASH_GAP_REPRO_PASS canonical_missing=1 backup_present=1 loader_accounts=0`.

Продуктовый фикс: commit `ca03fb2edcfc5b74874182573c29cb776d2b1dd9`.
Добавлен `recoverInterruptedReplacements()` перед обычным `load()`:
- восстановление допускается только когда canonical отсутствует **и** существует ровно одна пара `backup + temp` с тем же transaction suffix;
- это доказывает конкретный незавершённый переход `old -> backup`, `temp -> canonical`;
- одинокий backup без matching temp автоматически не восстанавливается, потому что он может быть старым cleanup-residue после успешной записи и последующего сознательного удаления аккаунта;
- если canonical уже существует после restart, старые backup считаются только cleanup residue и не откатывают подтверждённое состояние.

Важно: вариант «восстанавливать любой lone backup» намеренно отвергнут — он мог бы воскресить удалённый аккаунт.

Регресс: `scripts/account-store-interrupted-replacement-recovery-test.js`, commit `1cf846e26461d53cf28867665d5262cc97614055`.
Он проверяет две стороны:
- `backup + matching temp + no canonical` -> восстанавливается последний подтверждённый старый account/cooldown, uncommitted temp отбрасывается;
- lone stale backup после удаления account -> account не воскресает.

Тест включён в штатный `npm test` commit `b49bec79def089680941ef4bd29cc2ded1198b69`.

Post-fix hosted behavioral model:
`ACCOUNT_INTERRUPTED_REPLACEMENT_RECOVERY_MODEL_PASS restore_confirmed=1 stale_backup_no_resurrection=1`.

Граница доказательства: product diff перечитан и узкий; behavioral model реально выполнен на Node. Полный exact-tree `npm test` на product branch не заявлен.

## Предыдущий закрытый дефект — preferred reuse не пробивает distinct-account budget
Request-wide distinct-account budget уже защищён: reuse-credit выдаётся только если preferred id уже attempted и сам preferred всё ещё присутствует в fresh canonical eligible. Исправление `5ee53c157f5beeee9560830f0b0dfcc3a2ec30de`, регресс включён commit `23891cbc845996726ba5e0477c8542ff8361cf4d`.
Targeted PASS: `QWEN_PREFERRED_REUSE_DISTINCT_BUDGET_PASS`.

## V4–V10 и финальные replay gates закрыты — без нового контрпримера не открывать
Уже закрыты и имеют отдельные регрессии:
- account-local/provider-wide separation;
- bounded failover/cooldown/provider circuit;
- stale preferred/removed-account resurrection;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- local preparation/local persistence classification;
- cleanup-after-commit durability;
- stream checkpoint-before-release;
- late stream CAPTCHA/transport/empty SSE;
- pending mutating tool replay guard;
- session stale-backup fail-closed;
- durable request governor V4–V10 и unknown-outcome inflight marker no-autoclear.

Два финальных offline replay-сценария уже в product:
- `scripts/restart-failover-replay-safety-test.js` — завершённый mutating side effect не повторяется после restart/failover;
- `scripts/restart-unresolved-tool-failover-block-test.js` — unresolved mutating tool call блокирует `continue` до provider dispatch.
Hosted behavior ранее подтверждён для обоих сценариев.

## Что делать дальше
1. Fresh-read PR #6, `qwen-client.js` и QWEN_CORE handoff.
2. Если pre-dispatch race ещё не закрыт параллельной работой — применить `QWEN_RELIABILITY_PRE_DISPATCH_COOLDOWN_RACE_20260822.patch` byte-safe способом.
3. Запустить `node scripts/pre-dispatch-account-availability-test.js`; после PASS добавить его в текущую цепочку `npm test`, fresh-reading `package.json` перед записью.
4. Затем искать следующий новый воспроизводимый reliability-дефект только в account pool/candidates/cooldown, provider-wide circuit, preferred/current, account/thread affinity, request-wide bounded retry, crash recovery account-state и replay safety.
5. Не переоткрывать V4–V10 и закрытые cleanup/replay-инварианты без нового контрпримера.
6. Live/provider/production/секреты без новой доказанной необходимости не трогать.
7. Circle gate `94f8ba55...` не повторять; новый exact gate только по policy после targeted PASS и координации с QWEN_CORE.

## Offline request-governor cluster
- `node scripts/request-governor-inflight-no-autoclear-test.js`
- `node scripts/request-governor-monotonic-recovery-test.js`
- `node scripts/request-governor-durable-state-test.js`
- `node scripts/request-governor-inflight-gate-test.js`
- `node scripts/request-governor-inflight-marker-failure-test.js`
- `node scripts/request-governor-artifact-order-test.js`
- `node scripts/request-governor-generation-order-test.js`
- `node scripts/quota-telemetry-governor-failure-test.js`
- `node --check src/request-governor.js`
- `node --check src/quota-telemetry.js`

## Постоянная память / старт этого прохода
Worker: `QWEN_RELIABILITY`.
Runtime protocol `CAPSULE_RUNTIME_PROTOCOL_V2.json` и implementation `autonomy/v3/tools/capsule_runtime_v4.py` прочитаны; force-write `LATEST` запрещён, публикация только после полноценного pack/verify/reread/CAS.

Последний ранее проверенный `LATEST` из входного handoff: capsule `20260822T055538Z-4086c0ad8f`, archive SHA-256 `51331c58b77cf3c6d4282c572170bf75d3eb4376516d21d1de0532ae76869346`, pointer blob SHA `939afdf804a98c87185aa44ca9dfa42d9e8fce2b`.
В этом проходе новая capsule не публиковалась: текущий полезный результат сохранён точными Git-коммитами в product/control handoff. Не подменять нормативный v4 pack ручной реконструкцией только ради обновления указателя.
