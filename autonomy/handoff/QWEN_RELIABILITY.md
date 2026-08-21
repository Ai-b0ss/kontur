# Qwen — надёжность / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:20+03.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний наблюдавшийся head: `a0ec9110da9fefb32700e8996d63df53ee818df8`.
Перед записью перечитать fresh head/blob: параллельно пишет QWEN_CORE.

## Уже доказано — не исследовать заново
- account-local vs provider-wide failure разделены;
- bounded failover/cooldown/provider circuit/account-thread affinity закрыты;
- no eligible => 503, no accounts => 401;
- stale preferred/removed account не оживают;
- request-wide retry имеет общий distinct-account budget;
- local persistence errors не маскируются как provider errors;
- account/provider/session post-commit cleanup не откатывает новый durable safety state;
- pending mutating tool call блокирует replay;
- stream tool calls не выпускаются до durable checkpoint;
- late stream CAPTCHA/transport/empty SSE закрыты;
- session stale-backup recovery fail-closed.

## Helper уже внёс в product
- `7e42457c...` — stale subagent backup, не знающий batch-id, создаёт `uncertain`, не `pending`;
- `91e4c558...` — missing-batch regression;
- `a9e074f3...` — runner: 0 auto calls, 1 explicit retry, затем durable done;
- `cc70c65...` — regression в `npm test`;
- `df0f83e8...` — `run_command` тоже possible side effect;
- `a0ec9110...` — regression.

Fresh audit: `session-store`, `account-store`, `provider-circuit`, `chat-store` не имеют незакрытого stale-backup replay этого класса. `tool-memo` — вспомогательная recall timeline, не authoritative gate.

## Главный незакрытый gate: global WAF/request-governor durability
Исходный `WAFMIN2R1` мог fail-open при corrupt state и имел слабую запись.

Red-team последовательных кандидатов:
- V4: atomic durable state + telemetry boundary;
- V5: semantic validation + recovery-dir failure;
- V5 всё ещё оказался недостаточен: failed outcome save ставил только process-local latch, а restart после успешного rollback снова доверял старому pre-WAF canonical.
  Repro: `V5_RESTART_GAP_REPRODUCED provider_admission_after_restart=1`.
- V6 добавляет durable pre-provider `.inflight-*` effect gate; source-shaped proof:
  - `V6_INFLIGHT_GATE_PASS normal_cleanup=1 failed_outcome_restart_blocked=1`
  - `V6_MARKER_CREATE_FAIL_CLOSED_PASS provider_gate_rejected=1`
- V7 закрывает миграционный txn-artifact угол: valid older cleanup backup не блокирует, но newer/unreadable tmp/backup относительно canonical считается ambiguous safety state.
  Source-shaped proof: `V7_ARTIFACT_ORDER_PASS stale_cleanup=1 newer_candidate_blocked=1`.

## Единственный актуальный bundle
На fresh exact blobs применить строго последовательно:
1. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
2. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V5_DELTA_20260822.patch`
3. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V6_INFLIGHT_GATE_20260822.patch`
4. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V7_ARTIFACT_ORDER_20260822.patch`

V4/V5/V6 по отдельности НЕ считать финальными.

## Финальный целевой контракт V4+V5+V6+V7
Persisted state:
- corrupt/semantic-invalid/range-invalid v3 => `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider traffic;
- negative counters/tokens/timestamps не нормализуются в healthy;
- настоящий first start разрешён только при доказанном clean ENOENT;
- recovery directory inspection failure => fail-closed.

Atomic state:
- temp fsync -> old canonical to txn backup -> install -> parent fsync -> cleanup best-effort;
- pre-commit failure => process-local `persistenceUncertain`;
- post-commit cleanup не откатывает canonical;
- telemetry не роняет процесс после уже отправленного ответа.

Durable provider-effect gate:
- до успешного возврата provider-facing `before()` durably создаётся `.inflight-*` marker;
- marker write failure => provider admission reject;
- локальная ошибка до provider удаляет именно свой marker;
- outcome сначала durably записывается, только затем marker удаляется;
- failed outcome save/crash оставляет marker, restart fail-closed даже при valid canonical;
- recent/invalid/unreadable marker => fail-closed;
- orphan marker старше 2h может auto-clean только с durable cleanup: longest global WAF penalty 1h, strike reset 45m;
- same-account concurrency сохраняет число unresolved outcomes через marker queue.

Txn artifacts V7:
- artifact с valid state и `updatedAt <= canonical.updatedAt` доказанно cleanup-only: не блокирует, cleanup best-effort;
- newer/unreadable/invalid artifact или artifact при missing canonical => ambiguous, fail-closed;
- это позволяет безопасно пережить legacy `.tmp/.txn-backup` без вечной остановки и без игнорирования более нового safety state.

## Обязательные targeted checks
После полного bundle:
`node scripts/request-governor-durable-state-test.js`
`node scripts/request-governor-inflight-gate-test.js`
`node scripts/request-governor-inflight-marker-failure-test.js`
`node scripts/request-governor-artifact-order-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

Expected markers минимум:
- durable: `corrupt=1 semantic_invalid=1 range_invalid=1 ... rollback=1 save_failure_latch=1`;
- inflight: `normal_cleanup=1 failed_outcome_restart_blocked=1`;
- marker-create: `provider_gate_rejected=1`;
- artifact-order: `stale_cleanup=1 newer_candidate_blocked=1`.

Только после targeted PASS включить новые tests в fresh exact `npm test` минимальной правкой и прогнать reliability/full suite, если exact tree материализуем.

## Постоянная память
Последний проверенный Reliability LATEST: `20260821T200001Z-8a7c1e4d7a`, archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.
`20260821T205035Z-f383f6aa87` — НЕВАЛИДНЫЙ pack, не использовать.

## После gate
Если targeted/full regression green — переходить к финальным restart/failover/live gates, а не продолжать косметический аудит. Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого режима не запускать.