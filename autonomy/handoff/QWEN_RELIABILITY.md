# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `b49bec79def089680941ef4bd29cc2ded1198b69`.
Перед новой записью перечитать fresh PR head и exact blobs: параллельно работает QWEN_CORE.

## Новый закрытый дефект — crash между двумя rename больше не теряет аккаунт
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

Граница доказательства: product diff перечитан и узкий; behavioral model реально выполнен на Node. Полный exact-tree `npm test` пока не заявлен и внешний CI в этом проходе не запускался.

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
1. Fresh-read PR #6 и QWEN_CORE handoff; не пересекаться с его `server.js`/owner-system-prompt работой.
2. Следующий поиск ограничивать reliability-зоной: account pool/candidates/cooldown, provider-wide circuit, preferred/current, account/thread affinity, request-wide bounded retry, crash recovery account-state и replay safety.
3. Особо проверить соседние crash windows account-state, но не делать бесконечный микроаудит уже закрытой cleanup-after-commit логики. Нужен новый воспроизводимый контрпример.
4. Если exact-tree удаётся материализовать без внешнего CI, первым делом штатно выполнить:
   - `node scripts/account-store-interrupted-replacement-recovery-test.js`
   - `node scripts/account-store-persistence-test.js`
   - `node scripts/account-store-mutation-atomicity-test.js`
   - `node scripts/preferred-reuse-distinct-budget-test.js`
   - `node scripts/restart-failover-replay-safety-test.js`
   - `node scripts/restart-unresolved-tool-failover-block-test.js`
   - request-governor reliability cluster.
5. CircleCI использовать только по `autonomy/ci/CIRCLECI_GATE_POLICY.md`: исключительно disposable `ci/qwen-final-gate`, один exact product SHA после targeted local PASS и только когда остаётся exact-tree/full-suite пробел. QWEN_CORE и QWEN_RELIABILITY не должны оба триггерить один SHA. Результат не виден — PASS не объявлять.
6. Live/provider/production/секреты без новой доказанной необходимости не трогать.

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
На старте прочитан `LATEST.json`: capsule `20260822T055538Z-4086c0ad8f`, archive SHA-256 `51331c58b77cf3c6d4282c572170bf75d3eb4376516d21d1de0532ae76869346`, pointer blob SHA `939afdf804a98c87185aa44ca9dfa42d9e8fce2b`.
Manifest: schema `free_fabric_worker_capsule_v4`, 1 part, source ref `Ai-b0ss/qwen-free-api@23891cbc845996726ba5e0477c8542ff8361cf4d`; part reread separately, Git blob `493545c3fe82fc34faae431a223e180f833aa55d`.
Runtime protocol `CAPSULE_RUNTIME_PROTOCOL_V2.json` и implementation `autonomy/v3/tools/capsule_runtime_v4.py` прочитаны. Force-write `LATEST` запрещён; публикация только после полноценного pack/verify/reread/CAS.

Новая capsule в этом проходе пока не публиковалась: product/handoff уже сохранены в exact Git commits; не подменять нормативный v4 pack ручной реконструкцией только ради обновления указателя. Следующий запуск должен либо полноценно материализовать текущий workspace и провести v4 finish, либо оставить старый проверенный `LATEST` источником истины и продолжить от exact Git source.
