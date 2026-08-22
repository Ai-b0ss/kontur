# Qwen — надёжность / финишный handoff

Обновлено helper/red-team проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний helper product head после regression update: `acb947ea78d0cc0a8ce819dd8c0a69d3b6be93f3`.
Перед записью перечитать fresh PR head и exact `src/request-governor.js`: параллельно работает QWEN_CORE.

## V4–V8 ЗАКРЫТЫ — НЕ ПРИМЕНЯТЬ ПОВТОРНО
Уже product: durable global governor state, inflight-before-provider marker, marker write fail-closed, artifact ordering/generation, telemetry persistence isolation, regressions в offline `npm test`.
Ключевой общий head до новых RED-contracts: `a66f6372bc221ecc66058a11bbd29e49cf01e874`.

## V9 ОТМЕНЁН — НЕ ПРИМЕНЯТЬ
`QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V9_MONOTONIC_RECOVERY_QUARANTINE_20260822.patch` больше НЕ является безопасным кандидатом.

Причина доказана на свежем product source:
`src/request-governor.js::failure()` для `ratelimited` парсит `wait ~Nh` и делает
`hours = max(1, N)`, без верхней границы N. Шесть часов — только fallback, когда число отсутствует.
Следовательно ни 2h, ни 6h, ни другой произвольный таймер не доказывает, что неизвестный provider outcome безопасно забыт после crash-gap.

Fresh evidence:
- `src/account-store.js` действительно использует фиксированные 6h для своей обычной строки `RateLimited`, но это НЕ верхняя граница всей системы;
- `src/request-governor.js` допускает динамический `~Nh` без proven maximum.

## Единственный актуальный Reliability product gap: V10
Candidate:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_V10_NO_UNKNOWN_OUTCOME_AUTOCLEAR_20260822.patch`
Создан helper-коммитом `a05e5d6834f8bc099ab47616f1cace2d91a2289a`.

Контракт V10 минимальный:
- валидный orphan `.inflight-*` после restart всегда означает `recoveryUncertain`;
- `createdAt` остаётся только forensic/diagnostic metadata;
- wall-clock age не удаляет marker;
- monotonic process uptime тоже сам по себе не удаляет marker;
- evidence сохраняется до отдельного recovery-прохода с положительным доказательством безопасности;
- corrupt canonical / ambiguous transaction / directory inspection failure остаются fail-closed как раньше;
- обычный success/failure path по-прежнему снимает marker после durable outcome, поэтому V10 касается только редкого crash-gap.

### RED contracts уже в product
- `3bc544c08d6846f9d4d5db1da3076cd81504a6e1` — `scripts/request-governor-inflight-no-autoclear-test.js`: даже `createdAt=0` обязан блокировать и marker сохраняется;
- `acb947ea78d0cc0a8ce819dd8c0a69d3b6be93f3` — уже включённый `request-governor-monotonic-recovery-test.js` переведён с устаревшего "release after 6h" на контракт:
  `wall_clock_age_not_evidence=1 monotonic_age_not_evidence=1 explicit_recovery_required=1 corrupt_state_not_healed=1`.

Текущий V4–V8 product должен падать на этих RED-contracts, потому что всё ещё очищает старый inflight по `Date.now() - createdAt >= 2h`. Это ожидаемо до V10 implementation.

## Следующий точный шаг
1. Fresh-read `src/request-governor.js`.
2. Если wall-clock stale cleanup ещё есть — byte-safe применить ТОЛЬКО V10 candidate. V9 не накладывать ни до, ни после.
3. Targeted offline checks:
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
4. Включить `request-governor-inflight-no-autoclear-test.js` в fresh exact `npm test`, если ещё не включён.
5. После зелёного Reliability cluster не продолжать бесконечный governor-аудит: перейти к финальным restart/failover/live gates.

## Отдельный будущий recovery design
V10 намеренно не придумывает автоматическое удаление unknown-outcome marker. Если нужен автономный recovery, сначала должен появиться отдельный протокол с **положительным durable evidence**, способный доказать фактический provider/account outcome; один elapsed timer доказательством не является.

## Уже закрытые инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare и production без отдельной доказанной необходимости не использовать.
