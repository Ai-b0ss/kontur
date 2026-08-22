# Qwen — надёжность / финишный handoff

Обновлено Reliability-проходом 2026-08-22 00:xxZ.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий head после этого прохода: `a66f6372bc221ecc66058a11bbd29e49cf01e874` (545 commits).

## V4–V8 ЗАКРЫТЫ В PRODUCT — НЕ ПРИМЕНЯТЬ ПОВТОРНО
Уже внесены:
- `QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
- `...V5_DELTA...`
- `...V6_INFLIGHT_GATE...`
- `...V7_ARTIFACT_ORDER...`
- `...V8_GENERATION_ORDER...`

Ключевые product commits:
- `1130b18395b506ba805988c9e5a295e7e8f3ed31` — V4–V8 global request-governor durable fail-closed implementation;
- `496890c39edbe6af15c4a7b134d4cbf76a938156` — quota telemetry изолирует ошибку сохранения governor после уже завершённого ответа;
- `cdd77b0424bf7588b31c1b0b85f56d0f9aa1d49d` — durable-state regression;
- `8c89ab20d3eee1e0529f5916d5b4a7a532b1d991` — inflight restart gate regression;
- `720e62ef7ba2af03fb2f46508c93a4a0cd09afbc` — inflight marker persistence regression;
- `93a0d72fdca215b2b53c77e0c986fa17ae850598` — artifact-order regression;
- `a2211bc50a1e8447345790233bffae97527995e0` — generation-order regression;
- `9f2c23f7cc8e8024e4f201b63d1155550dcdc144` — telemetry regression совместим с Node 22;
- `c5e681ddff439e9f39bf3a13009a1eb226a4189a` — шесть regressions включены в обычный offline `npm test`.

Targeted V4–V8 markers ранее PASS. Full exact-tree `npm test` в hosted-среде не заявлять; внешние CI ради этого не запускались.

## Единственный текущий Reliability product gap: V9
Применить ТОЛЬКО свежую версию:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V9_MONOTONIC_RECOVERY_QUARANTINE_20260822.patch`

Candidate обновлён helper-коммитом `3083e4e2405e8c2e776c770a85a0b7f0f4fc96cf`.

### Что уже сделано в этом проходе
Регрессионный тест V9 уже перенесён в продуктовую ветку отдельным файлом:
- `de0c2133e2ed79fb7d19f8ebe172c844bef96918` — `scripts/request-governor-monotonic-recovery-test.js`;
- `a66f6372bc221ecc66058a11bbd29e49cf01e874` — тест включён в обычный offline `npm test`.

Это намеренно сначала RED-контракт: product `src/request-governor.js` на этом head всё ещё содержит wall-clock stale cleanup `__w2INFLIGHT_STALE_MS = 2h`, поэтому V9 implementation ещё обязателен. Внешние CI не запускать ради этого.

### Почему исходные 2 часа V9 ОТМЕНЕНЫ
Текущий product V8 всё ещё старит orphan `.inflight-*` по wall clock (`Date.now() - createdAt`). Это доказанная clock-jump дыра.

Первый вариант V9 заменял wall clock на 2 часа monotonic uptime, исходя только из global WAF max=1h. Новый cross-layer red-team показал, что это недостаточно:
- inflight marker создаётся ДО provider I/O и живёт до финальной `requestGovernor.success/failure`;
- `qwen-client` обычно durable-пишет known `RateLimited` через `accountStore.markFailure()` до failover;
- существует crash-window после прихода provider bytes и до durable account-store fsync;
- `account-store` для `RateLimited` использует 6 часов `unavailableUntil`;
- provider circuit короче (WAF 10m, trust 30m, pressure 2m), global WAF максимум 1h;
- longest known automatic safety horizon для неизвестного provider outcome = 6h.

Поэтому 2h auto-recovery было бы fail-open: недавно потерянный `RateLimited` мог бы быть забыт на 4 часа раньше консервативного account cooldown.

### Свежий V9 contract
- `createdAt` только diagnostic; wall-clock age никогда не разрешает cleanup;
- любой recovered inflight marker сразу fail-closed;
- auto-recovery только после 6 часов непрерывного `process.hrtime.bigint()` uptime при полном запрете provider traffic;
- на отметке 2h marker обязан всё ещё блокировать traffic;
- после 6h cleanup разрешён только для `inflight-only` uncertainty;
- corrupt canonical / ambiguous txn / directory inspection failure шестичасовой карантин НЕ лечит;
- несколько inflight markers очищаются только после того же общего безопасного горизонта;
- canonical может отсутствовать: после 6h полного provider silence это допустимо, затем следующий admitted request создаст новое durable generation;
- production horizon жёстко 6h, env/test bypass отсутствует.

Тест должен дать:
`REQUEST_GOVERNOR_MONOTONIC_RECOVERY_PASS wall_clock_only_blocked=1 two_hour_reopen_blocked=1 six_hour_rate_limit_horizon=1 corrupt_state_not_healed=1`

ВАЖНО: прежний marker с `monotonic_quarantine_release=1` для двухчасовой версии считать устаревшим доказательством.

## Следующий точный шаг
1. Перечитать fresh PR #6 head и blob `src/request-governor.js`.
2. Если `__w2INFLIGHT_STALE_MS`/wall-clock cleanup ещё присутствует, byte-safe применить только V9 implementation из candidate к свежему файлу. Не реконструировать большой общий файл из обрезанных ответов.
3. Запустить на ChatGPT hosted машине:
   - `node scripts/request-governor-monotonic-recovery-test.js`
   - `node scripts/request-governor-durable-state-test.js`
   - `node scripts/request-governor-inflight-gate-test.js`
   - `node scripts/request-governor-inflight-marker-failure-test.js`
   - `node scripts/request-governor-artifact-order-test.js`
   - `node scripts/request-governor-generation-order-test.js`
   - `node scripts/quota-telemetry-governor-failure-test.js`
   - `node --check src/request-governor.js`
   - `node --check src/quota-telemetry.js`
4. После targeted PASS переходить к финальным restart/failover/live gates; V4–V8 не открывать заново без нового воспроизводимого дефекта.

## Уже закрытые постоянные инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence error classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed.

## Постоянная память
Старт этого прохода нормативно восстановлен через `capsule_runtime_v4.py` из:
- capsule `20260821T221824Z-4ebc60265f`;
- archive SHA-256 `49ae349934f1159f3094c1159f1841c43df66497d903b3a54ce70cf45335878d`;
- стартовый LATEST Git blob SHA `34fa9f468019ddd75af1940689b97658a2a0246f`.

Невалидный `20260821T205035Z-f383f6aa87` не использовать.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare без отдельной доказанной необходимости не запускать.