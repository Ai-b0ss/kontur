# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Текущий reliability product head после V10: `f0b889804fbdd86c4ea1bf0cee5cc85d680194a2`.
Перед новой записью перечитать fresh PR head: параллельно работает QWEN_CORE.

## V4–V9 закрыты/отменены — не открывать заново
V4–V8 уже в product: durable global governor state, inflight-before-provider marker, fail-closed marker write, artifact ordering/generation, telemetry persistence isolation и регрессии.
V9 с автоматическим снятием unknown-outcome по 6 часам отменён: `RateLimited: wait ~Nh` допускает динамическое N без доказанной верхней границы, поэтому elapsed-time сам по себе не является доказательством безопасного повтора.

## V10 ВНЕСЁН В PRODUCT
Product commit: `f0b889804fbdd86c4ea1bf0cee5cc85d680194a2`.
Изменение узкое и совпадает с кандидатом `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_V10_NO_UNKNOWN_OUTCOME_AUTOCLEAR_20260822.patch`:
- удалён двухчасовой `__w2INFLIGHT_STALE_MS`;
- валидный orphan `.inflight-*` после restart всегда оставляет `recoveryUncertain`;
- `createdAt` остаётся forensic metadata, но не удаляет marker по возрасту;
- marker не удаляется автоматически ни по wall-clock, ни по uptime;
- обычный success/failure path по-прежнему удаляет marker после durable outcome.

Read-back diff `f0b8898…` содержит только V10: `-1` константа stale timeout, удаление age-based cleanup и добавление fail-closed сохранения orphan evidence. Посторонних изменений файла нет.

### Проверки
- `request-governor-inflight-no-autoclear-test.js` уже включён в штатный `npm test` на exact product head.
- На hosted Node выполнена отдельная модель изменённого инварианта: `V10_NO_UNKNOWN_OUTCOME_AUTOCLEAR_MODEL_PASS marker_preserved=1 wall_clock_age_ignored=1`.
- Полный exact-tree `npm test` в этом проходе не заявлен: внешние CI запрещены для обычной разработки, а репозиторий не материализовался локально через сеть. Статический read-back commit diff подтверждает точное применение кандидата.

## Что делать дальше
Не продолжать бесконечный аудит governor. Сначала получить полный локальный/offline Reliability cluster, когда exact-tree доступен без hosted CI:
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

Если этот cluster зелёный, Reliability-линия должна перейти к финальным доказательствам `restart → восстановление незавершённой цели → прежний аккаунт недоступен → безопасное продолжение через следующий аккаунт` с сохранённой историей инструментов и защитой от повторного выполнения side effects. Live/provider запускать только один раз после доказанной необходимости и после проверки, что старый разрешённый live-run не дал результата.

## Отдельный будущий recovery design
V10 намеренно не придумывает автоматическое удаление unknown-outcome marker. Автономное recovery допустимо только при отдельном протоколе с положительным durable evidence фактического provider/account outcome.

## Уже закрытые инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare и production без отдельной доказанной необходимости не использовать.
