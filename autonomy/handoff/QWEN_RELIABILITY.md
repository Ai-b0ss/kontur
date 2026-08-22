# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head на EXIT GATE: `0da402a54bab90a63948e7b4dd4fa12a0f910028`.
Перед любой новой записью снова fresh-read PR head: параллельно работает QWEN_CORE.

## Последний закрытый блок — legacy migration
Закрыты два дефекта в `src/account-store.js`:
1. legacy account больше не публикуется в память до подтверждённого `persist()` (`a9e7d34a19e7093daf9ce99d95801d082d288b93`);
2. повторно появившийся старый `account.json` больше не может перезаписать более новый canonical `accounts/<id>.json` (`be931bca18b99e609dd79f502d6ca4aaffa9fd07`).

Штатные регрессии:
- `scripts/account-legacy-migration-persistence-test.js`;
- `scripts/account-legacy-stale-source-rollback-test.js`.
Обе включены в обычный `npm test` на product head `d2540be894fa8e1a3dc4527e188010c6dd9e62e5`.
Hosted model checks ранее дали `LEGACY_MIGRATION_PERSISTENCE_POSTFIX_MODEL_PASS` и `LEGACY_STALE_SOURCE_ROLLBACK_MODEL_PASS`.

## Новый воспроизводимый дефект — late success очищает более новый cooldown
Fresh-read `src/account-store.js` на `d2540be8...`/`dd8481e9...` подтвердил: `markSuccess()` безусловно делает `failures=0`, `unavailableUntil=0`, `lastError=''` и очищает монотонный cooldown.

Это даёт реальную гонку двух уже летящих запросов одного аккаунта:
1. старый request A ещё выполняется;
2. более новый request B получает CAPTCHA/rate-limit и ставит аккаунту cooldown;
3. старый request A позже успешно завершается;
4. текущий `markSuccess()` стирает более новую защитную паузу и снова делает аккаунт доступным.

Офлайн-модель текущего поведения воспроизведена:
`ACCOUNT_SUCCESS_COOLDOWN_RACE_REPRO_PASS premature_clear=1`.

В product PR добавлен намеренно RED regression, но пока НЕ включён в `npm test`:
- `scripts/account-success-cooldown-race-test.js`;
- commit `0da402a54bab90a63948e7b4dd4fa12a0f910028`.

Тест требует: поздний успех старого in-flight запроса не должен очищать уже активный cooldown, failure count и lastError, установленные более новым запросом.

Минимальный кандидат исправления сохранён в control repo:
- `autonomy/v3/candidates/QWEN_RELIABILITY_SUCCESS_COOLDOWN_RACE_20260822.patch`;
- control commit `17cd1caafdd8633ff36454cd49b429313ee5c450`.

Смысл кандидата: `markSuccess()` сначала определяет, активен ли уже wall-clock или monotonic cooldown. Если активен — обновляет только `lastUsedAt`, но не снимает cooldown/ошибку. Если активной паузы нет — сохраняет прежнюю семантику обычного успеха. Hosted model candidate PASS:
`ACCOUNT_SUCCESS_COOLDOWN_RACE_CANDIDATE_PASS preserved_newer_cooldown=1`.

Продуктовый `account-store.js` в этом проходе не переписывался целиком: доступный Contents API требует полной замены общего файла, а это неоправданный риск при параллельном QWEN_CORE. Следующий worker должен сначала fresh-read PR #6 и, если account-store bytes не изменились, применить этот маленький patch byte-safe способом, затем запустить новый regression и account-store cluster.

## Проверки / граница доказательства
- Fresh PR перед reliability write был `dd8481e9a966f4c2a7b03294527b4b0aecf403fb`; compare с `d2540be8...` показал единственный чужой файл `scripts/internal-system-prompt-mode-explicit-test.js`, то есть account-store не менялся.
- После добавления RED regression current PR head `0da402a54bab90a63948e7b4dd4fa12a0f910028`.
- Полный exact-tree `npm test` в этом проходе НЕ запускался и PASS не приписывается.
- CircleCI не запускался: пока существует новый RED regression, финальный gate тратить рано.

## QWEN_CORE coordination
Fresh `autonomy/handoff/QWEN_CORE.md` прочитан. Core занимается session/owner/system authority и на входе этого прохода не трогал account-store. Перед любым следующим product write снова прочитать QWEN_CORE и compare relevant bytes.

## CircleCI final gate
Политика `autonomy/ci/CIRCLECI_GATE_POLICY.md` обязательна.
- только disposable `ci/qwen-final-gate`;
- один exact product SHA — один gate owner;
- обычную product-ветку не использовать как CI-loop;
- новый gate только после targeted local/exact PASS и стабильного product SHA;
- недоступный результат = `RESULT_ACCESS_UNAVAILABLE`, не PASS.

## Уже закрыто — не переоткрывать без нового контрпримера
- account-local/provider-wide separation;
- stale preferred/removed-account resurrection;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- completion/chat-create fresh pre-dispatch availability races;
- local request preparation / local persistence classification;
- cleanup-after-commit durability для account/provider/session state;
- account interrupted replacement recovery;
- legacy migration publish-before-persist;
- stale legacy source rollback of newer canonical account;
- stream checkpoint-before-release;
- late stream CAPTCHA/transport/empty SSE;
- pending mutating tool replay guard;
- stale session/subagent backup fail-closed;
- durable request governor V4–V10 и unknown-outcome inflight no-autoclear;
- completed mutating side effect не повторяется после restart/failover;
- unresolved mutating tool call блокирует `continue` до provider dispatch;
- forward wall-clock jump внутри живого процесса не сокращает account cooldown;
- forward wall-clock jump внутри живого процесса не сокращает provider-wide circuit.

## Что делать дальше
1. Fresh-read PR #6 + QWEN_CORE.
2. Если `src/account-store.js` не изменился, byte-safe применить `QWEN_RELIABILITY_SUCCESS_COOLDOWN_RACE_20260822.patch`.
3. Запустить `account-success-cooldown-race-test.js` и cluster: `account-legacy-migration-persistence-test.js`, `account-legacy-stale-source-rollback-test.js`, `account-store-persistence-test.js`, `account-store-interrupted-replacement-recovery-test.js`, `account-store-mutation-atomicity-test.js`, `account-store-cooldown-test.js`, `account-cooldown-wall-clock-jump-test.js`.
4. Только после targeted PASS включить новый regression в обычный `npm test`.
5. При стабильном exact product SHA согласовать с QWEN_CORE единственного владельца следующего `ci/qwen-final-gate`.
6. Затем искать следующий новый воспроизводимый дефект только в pool/candidates/cooldown/provider-circuit/affinity/bounded-retry/replay safety.

## Постоянная память
Worker: `QWEN_RELIABILITY`.
`autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` и exact `autonomy/v3/tools/capsule_runtime_v4.py` перечитаны. Обязательны immutable capsule, upload readback и CAS по стартовому Git blob SHA `LATEST`; force-write запрещён.

Новый `LATEST` в этом проходе не публиковался: текущая tool-связка не даёт безопасно передать exact capsule bytes из GitHub connector в runtime workspace для нормативного `restore -> checkpoint -> pack -> verify -> upload readback -> CAS`. Ручная реконструкция/force-write не использовались. Exact product state закреплён Git commits, candidate patch и этим handoff.

Live Qwen, реальные аккаунты, секреты, Cloudflare и production не трогались.
