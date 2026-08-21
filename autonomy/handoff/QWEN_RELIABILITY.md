# Qwen — надёжность / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:54+03.

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
- `cc70c65...` regression включён в `npm test`;
- `df0f83e8...` `run_command` тоже possible side effect;
- `a0ec9110...` regression.

## Главный незакрытый gate: global WAF/request-governor durability
Исходный `WAFMIN2R1` fail-open при corrupt state и имел слабую запись. Последовательный red-team показал, что ранние V4/V5/V6/V7 по отдельности недостаточны.

### Единственный актуальный bundle
На fresh exact blobs применить СТРОГО последовательно:
1. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
2. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V5_DELTA_20260822.patch`
3. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V6_INFLIGHT_GATE_20260822.patch`
4. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V7_ARTIFACT_ORDER_20260822.patch`
5. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V8_GENERATION_ORDER_20260822.patch`

V8 ОБЯЗАТЕЛЕН. V7 использовал `updatedAt` для порядка txn-artifacts; helper воспроизвёл race, где два разных safety-state получили одинаковую миллисекунду и более строгий state был ошибочно признан stale. V8 вводит монотонный `generation` и при одинаковом generation разрешает cleanup только при точном совпадении safety payload.

Source-shaped proof helper:
- `V5_RESTART_GAP_REPRODUCED provider_admission_after_restart=1` — почему V5 не финален;
- `V6_INFLIGHT_GATE_PASS normal_cleanup=1 failed_outcome_restart_blocked=1`;
- `V6_MARKER_CREATE_FAIL_CLOSED_PASS provider_gate_rejected=1`;
- `V7_ARTIFACT_ORDER_PASS stale_cleanup=1 newer_candidate_blocked=1`;
- V8 model: same-generation different safety state blocked; higher generation wins even when wall clock moves backward; lower generation cleans safely.

## Целевой контракт V4..V8
- corrupt/semantic-invalid/range-invalid persisted v3 => `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider traffic;
- clean first start разрешён только при доказанном ENOENT без recovery/inflight artifacts;
- невозможность проверить recovery directory => fail-closed;
- atomic state: temp fsync -> old canonical to txn backup -> install -> parent fsync -> cleanup best-effort;
- failed outcome save/crash оставляет durable `.inflight-*` marker; restart остаётся закрытым даже при старом valid canonical;
- marker write failure блокирует `before()` до provider;
- outcome state сохраняется durably раньше удаления marker;
- stale legacy artifacts clean только когда доказано, что они не новее canonical;
- ordering новых states основан на `generation`, а не wall-clock timestamp;
- одинаковый generation + различный safety payload => ambiguous => fail-closed;
- telemetry persistence failure после уже отправленного ответа не должна ронять процесс.

## Targeted checks до любого DONE
После полного V4..V8 bundle:
`node scripts/request-governor-durable-state-test.js`
`node scripts/request-governor-inflight-gate-test.js`
`node scripts/request-governor-inflight-marker-failure-test.js`
`node scripts/request-governor-artifact-order-test.js`
`node scripts/request-governor-generation-order-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

Generation marker обязан дать:
`REQUEST_GOVERNOR_GENERATION_ORDER_PASS equal_generation_divergence_blocked=1 clock_rollback_blocked=1 old_generation_cleanup=1`.

После targeted PASS включить новые regressions в fresh exact `npm test` отдельной минимальной правкой и прогнать reliability/full suite. Не продолжать бесконечный косметический аудит после зелёного цельного набора — переходить к финальным restart/failover/live gates.

## Постоянная память
Последний проверенный Reliability LATEST до helper-работы: `20260821T200001Z-8a7c1e4d7a`, archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.
`20260821T205035Z-f383f6aa87` — НЕВАЛИДНЫЙ pack, не использовать.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого режима не запускать.