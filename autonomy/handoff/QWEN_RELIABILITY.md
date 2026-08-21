# Qwen — надёжность / финишный handoff

Обновлено helper-проходом после product advance 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий перепроверенный head: `a2211bc50a1e8447345790233bffae97527995e0` (534 commits).
Перед записью ещё раз перечитать head/blob: параллельно работает QWEN_CORE.

## ВАЖНО: V4–V8 УЖЕ В PRODUCT
Не применять повторно:
- `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
- `...V5_DELTA...`
- `...V6_INFLIGHT_GATE...`
- `...V7_ARTIFACT_ORDER...`
- `...V8_GENERATION_ORDER...`

Diff `a0ec911... -> a2211bc...` уже содержит:
- `src/request-governor.js` +203/-49;
- `src/quota-telemetry.js` +14/-4;
- `request-governor-durable-state-test.js`;
- inflight marker/gate tests;
- artifact-order test;
- generation-order test.

Fresh exact source на `a2211bc...` подтверждает:
- persisted v3 semantic validation;
- durable inflight markers;
- atomic state replacement + parent fsync;
- generation-based txn artifact ordering;
- telemetry isolation.

## Единственный текущий Reliability product gap: V9
На свежий `a2211bc...` применить ТОЛЬКО:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V9_MONOTONIC_RECOVERY_QUARANTINE_20260822.patch`

Почему: текущий product всё ещё имеет
`const __w2INFLIGHT_STALE_MS = 2 * 60 * 60 * 1000`
и orphan inflight cleanup через `Date.now() - createdAt`.
Wall-clock/NTP/VM jump вперёд может состарить только что оставшийся unknown-outcome marker и открыть provider traffic раньше безопасного горизонта.

V9 contract:
- `createdAt` diagnostic-only;
- recovered inflight marker сразу fail-closed независимо от wall-clock age;
- auto-recovery только после 2 часов непрерывного monotonic uptime `process.hrtime.bigint()` при закрытом provider traffic;
- quarantine лечит только inflight-only uncertainty, не corrupt canonical/ambiguous txn/inspection failure;
- production quarantine жёстко 2h, env/test bypass отсутствует.

Helper source-shaped marker:
`V9_MONOTONIC_MODEL_PASS immediate_block=1 quarantine_release=1 unrelated_corruption_stays_blocked=1`.

## Targeted checks после V9
Сначала:
`node scripts/request-governor-monotonic-recovery-test.js`
`node scripts/request-governor-durable-state-test.js`
`node scripts/request-governor-inflight-gate-test.js`
`node scripts/request-governor-inflight-marker-failure-test.js`
`node scripts/request-governor-artifact-order-test.js`
`node scripts/request-governor-generation-order-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

Expected V9 marker:
`REQUEST_GOVERNOR_MONOTONIC_RECOVERY_PASS wall_clock_only_blocked=1 monotonic_quarantine_release=1 corrupt_state_not_healed=1`.

После targeted PASS добавить monotonic regression в fresh exact `npm test` минимальной правкой и прогнать ближайший reliability/full suite. Если зелёный — переходить к финальным restart/failover/live gates, не возвращаться к V4–V8 без нового воспроизводимого дефекта.

## Уже закрытые постоянные инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence error classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed.

Последний известный Reliability LATEST до helper-работы: `20260821T200001Z-8a7c1e4d7a`; archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`. Невалидный `20260821T205035Z-f383f6aa87` не использовать.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого режима не запускать.