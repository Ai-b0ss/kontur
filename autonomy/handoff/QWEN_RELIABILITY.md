# Qwen — надёжность / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:58+03.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний перепроверенный head: `a0ec9110da9fefb32700e8996d63df53ee818df8` (527 commits).
Перед записью перечитать fresh head/blob: параллельно работает QWEN_CORE.

## Уже закрыто — не исследовать заново
- account-local/provider-wide failures, bounded failover/cooldown/provider circuit/account-thread affinity;
- stale preferred/removed account resurrection;
- request-wide distinct-account budget;
- local persistence errors не маскируются как provider failures;
- post-commit cleanup не откатывает account/provider/session safety state;
- pending mutating tool call блокирует replay; stream tool-call не выпускается до durable checkpoint;
- late stream CAPTCHA/transport/empty SSE;
- session stale-backup recovery fail-closed.

Helper уже внёс в product:
- `7e42457c...` stale backup без batch-id -> новый batch `uncertain`;
- `91e4c558...` missing-batch regression;
- `a9e074f3...` runner: 0 auto calls, 1 explicit retry, затем durable done;
- `cc70c65...` regression в `npm test`;
- `df0f83e8...` `run_command` тоже possible side effect;
- `a0ec9110...` regression.

## Главный незакрытый gate: global WAF/request-governor durability
Исходный `WAFMIN2R1` мог fail-open при corrupt state и имел слабую запись. Последовательный red-team показал дополнительные restart/ordering/clock gaps.

### Единственный актуальный bundle
На fresh exact blobs применять СТРОГО последовательно:
1. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
2. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V5_DELTA_20260822.patch`
3. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V6_INFLIGHT_GATE_20260822.patch`
4. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V7_ARTIFACT_ORDER_20260822.patch`
5. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V8_GENERATION_ORDER_20260822.patch`
6. `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V9_MONOTONIC_RECOVERY_QUARANTINE_20260822.patch`
Все лежат в `autonomy/v3/candidates/`.

V4..V8 без V9 больше не считать финальными.

## Почему V9 обязателен
V6 очищал orphan `.inflight-*` по `Date.now() - createdAt >= 2h`. После V8 мы уже доказали, что wall-clock может прыгать и не годится как доказательство порядка. При NTP/VM jump вперёд недавно оставшийся unknown-outcome marker мог быть немедленно принят за двухчасовой и удалён.

V9:
- `createdAt` остаётся только диагностикой;
- после restart любой recovered inflight marker сразу fail-closed независимо от wall-clock age;
- автоматическое восстановление разрешается только после **2 часов непрерывного monotonic process uptime** (`process.hrtime.bigint()`), всё это время provider traffic закрыт;
- quarantine не лечит corrupt canonical/ambiguous txn/inspection failure — только recovery, где единственная неопределённость была inflight marker;
- production quarantine жёстко 2h; тестовых runtime/env-обходов нет.

Helper source-shaped proof:
`V9_MONOTONIC_MODEL_PASS immediate_block=1 quarantine_release=1 unrelated_corruption_stays_blocked=1`.

## Целевой контракт V4..V9
- corrupt/semantic-invalid/range-invalid persisted v3 => `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider traffic;
- clean first start только при доказанном ENOENT без recovery/inflight artifacts;
- recovery directory inspection failure => fail-closed;
- atomic state: temp fsync -> old canonical to txn backup -> install -> parent fsync -> cleanup best-effort;
- failed outcome save/crash оставляет durable `.inflight-*`; restart остаётся закрытым даже при старом valid canonical;
- marker write failure блокирует `before()` до provider;
- outcome state durably сохраняется раньше удаления marker;
- stale legacy artifacts clean только когда доказано, что они не новее canonical;
- ordering новых states — по монотонному `generation`, не timestamp;
- одинаковый generation + различный safety payload => ambiguous => fail-closed;
- recovered inflight marker не очищается только из-за wall-clock age; нужен monotonic quarantine;
- telemetry persistence failure после уже отправленного ответа не роняет процесс.

## Targeted checks до DONE
После полного V4..V9 bundle:
`node scripts/request-governor-durable-state-test.js`
`node scripts/request-governor-inflight-gate-test.js`
`node scripts/request-governor-inflight-marker-failure-test.js`
`node scripts/request-governor-artifact-order-test.js`
`node scripts/request-governor-generation-order-test.js`
`node scripts/request-governor-monotonic-recovery-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

Обязательные markers:
- `REQUEST_GOVERNOR_GENERATION_ORDER_PASS equal_generation_divergence_blocked=1 clock_rollback_blocked=1 old_generation_cleanup=1`
- `REQUEST_GOVERNOR_MONOTONIC_RECOVERY_PASS wall_clock_only_blocked=1 monotonic_quarantine_release=1 corrupt_state_not_healed=1`

После targeted PASS включить новые regressions в fresh exact `npm test` минимальной правкой и прогнать reliability/full suite. После зелёного цельного набора переходить к финальным restart/failover/live gates, а не продолжать бесконечный косметический аудит.

## Постоянная память
Последний проверенный Reliability LATEST до helper-работы: `20260821T200001Z-8a7c1e4d7a`, archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.
`20260821T205035Z-f383f6aa87` — НЕВАЛИДНЫЙ pack, не использовать.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого режима не запускать.