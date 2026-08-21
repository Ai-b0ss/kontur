# Qwen — надёжность / финишный handoff

Обновлено Reliability-проходом 2026-08-21 22:20Z.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий перепроверенный head: `c5e681ddff439e9f39bf3a13009a1eb226a4189a` (537 commits).
Перед записью ещё раз перечитать head/blob: параллельно может работать QWEN_CORE.

## V4–V8 ЗАКРЫТЫ В PRODUCT — НЕ ПРИМЕНЯТЬ ПОВТОРНО
Уже внесены:
- `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
- `...V5_DELTA...`
- `...V6_INFLIGHT_GATE...`
- `...V7_ARTIFACT_ORDER...`
- `...V8_GENERATION_ORDER...`

Product commits этого прохода:
- `1130b18395b506ba805988c9e5a295e7e8f3ed31` — V4–V8 global request-governor durable fail-closed implementation;
- `496890c39edbe6af15c4a7b134d4cbf76a938156` — quota telemetry изолирует ошибку сохранения governor после уже завершённого ответа;
- `cdd77b0424bf7588b31c1b0b85f56d0f9aa1d49d` — durable-state regression;
- `8c89ab20d3eee1e0529f5916d5b4a7a532b1d991` — inflight restart gate regression;
- `720e62ef7ba2af03fb2f46508c93a4a0cd09afbc` — inflight marker persistence regression;
- `93a0d72fdca215b2b53c77e0c986fa17ae850598` — artifact-order regression;
- `a2211bc50a1e8447345790233bffae97527995e0` — generation-order regression;
- `9f2c23f7cc8e8024e4f201b63d1155550dcdc144` — исправлен сам telemetry regression для Node 22: он больше не подменяет весь `fs.readFileSync` и не ломает загрузчик CommonJS;
- `c5e681ddff439e9f39bf3a13009a1eb226a4189a` — все шесть регрессий добавлены в обычный offline `npm test`.

Hosted targeted PASS на V4–V8:
- `REQUEST_GOVERNOR_DURABLE_STATE_PASS ...`
- `REQUEST_GOVERNOR_INFLIGHT_GATE_PASS normal_cleanup=1 failed_outcome_restart_blocked=1`
- `REQUEST_GOVERNOR_INFLIGHT_MARKER_FAIL_CLOSED_PASS provider_gate_rejected=1`
- `REQUEST_GOVERNOR_ARTIFACT_ORDER_PASS stale_cleanup=1 newer_candidate_blocked=1`
- `REQUEST_GOVERNOR_GENERATION_ORDER_PASS equal_generation_divergence_blocked=1 clock_rollback_blocked=1 old_generation_cleanup=1`
- `QUOTA_TELEMETRY_GOVERNOR_FAILURE_ISOLATION_PASS finish_does_not_throw=1`
- `node --check src/request-governor.js`
- `node --check src/quota-telemetry.js`

Полный exact-tree `npm test` в этой среде не заявлять: hosted-контейнер не может получить весь репозиторий через сеть. Внешние CI ради этого не запускались.

## Единственный текущий Reliability product gap: V9
Применить ТОЛЬКО:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V9_MONOTONIC_RECOVERY_QUARANTINE_20260822.patch`

Почему: текущий product всё ещё имеет двухчасовое старение orphan inflight по wall clock (`Date.now() - createdAt`). Прыжок NTP/VM вперёд может состарить только что восстановленный unknown-outcome marker и открыть provider traffic раньше безопасного горизонта.

V9 contract:
- `createdAt` diagnostic-only;
- recovered inflight marker сразу fail-closed независимо от wall-clock age;
- auto-recovery только после 2 часов непрерывного monotonic uptime `process.hrtime.bigint()` при закрытом provider traffic;
- quarantine лечит только inflight-only uncertainty, не corrupt canonical/ambiguous txn/inspection failure;
- production quarantine жёстко 2h, env/test bypass отсутствует.

V9 уже наложен на hosted-копию свежего V8 product и реально прошёл:
`REQUEST_GOVERNOR_MONOTONIC_RECOVERY_PASS wall_clock_only_blocked=1 monotonic_quarantine_release=1 corrupt_state_not_healed=1`
После V9 также повторно прошли V4–V8 targeted проверки.

V9 пока НЕ записан в product: доступный GitHub Contents путь требует полной замены большого общего `src/request-governor.js`; после появления параллельного helper-изменения безопаснее оставить точный проверенный patch для byte-safe применения, чем реконструировать общий файл. Новой разведки не нужно.

## Targeted checks после применения V9
`node scripts/request-governor-monotonic-recovery-test.js`
`node scripts/request-governor-durable-state-test.js`
`node scripts/request-governor-inflight-gate-test.js`
`node scripts/request-governor-inflight-marker-failure-test.js`
`node scripts/request-governor-artifact-order-test.js`
`node scripts/request-governor-generation-order-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

После targeted PASS добавить `request-governor-monotonic-recovery-test.js` в fresh exact `npm test` минимальной правкой. После этого переходить к финальным restart/failover/live gates; V4–V8 не открывать заново без нового воспроизводимого дефекта.

## Уже закрытые постоянные инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence error classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed.

## Постоянная память
В начале этого прохода нормативно восстановлен `LATEST` `20260821T200001Z-8a7c1e4d7a` через `capsule_runtime_v4.py verify + restore`; исходный CAS blob SHA был `31d12fe0d190da24c7afc612db55165c675d67a5`.

После работы нормативно опубликован новый `LATEST`:
- capsule `20260821T221824Z-4ebc60265f`;
- archive SHA-256 `49ae349934f1159f3094c1159f1841c43df66497d903b3a54ce70cf45335878d`;
- текущий LATEST blob SHA `34fa9f468019ddd75af1940689b97658a2a0246f`;
- старый LATEST сохранён как PREVIOUS.
Manifest и обе части перечитаны после загрузки; их Git blob SHA точно совпали с локально вычисленными; `verify + restore` новой capsule = PASS.

Невалидный `20260821T205035Z-f383f6aa87` не использовать.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной доказанной необходимости не запускать.