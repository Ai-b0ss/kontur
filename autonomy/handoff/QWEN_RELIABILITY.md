# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Текущий product head после нового offline final-gate test: `494f4f4fb1882b049989c4ebd3e02211c72025da`.
Перед новой записью перечитать fresh PR head: параллельно работает QWEN_CORE.

## V4–V10 закрыты — governor больше не микроаудировать
V4–V8 уже в product: durable global governor state, inflight-before-provider marker, fail-closed marker write, artifact ordering/generation, telemetry persistence isolation и регрессии.
V9 с автоматическим снятием unknown-outcome по 6 часам отменён: `RateLimited: wait ~Nh` допускает динамическое N без доказанной верхней границы, поэтому elapsed-time сам по себе не является доказательством безопасного повтора.
V10 внесён commit `f0b889804fbdd86c4ea1bf0cee5cc85d680194a2`: orphan `.inflight-*` после restart больше не auto-clear по wall-clock age; unknown provider outcome остаётся fail-closed до отдельного positive-evidence recovery.

## Новый final-gate test внесён
Добавлен `scripts/restart-failover-replay-safety-test.js`, commit `9444a8687f7efc9bc3f127412a3866389cea0c92`.
Тест моделирует именно финальную offline-цепочку Reliability:
- два легитимных аккаунта A/B;
- незавершённая цель с уже завершённым mutating `write_file` и matching tool result сохраняется в crash-safe session checkpoint;
- A получает account-local CAPTCHA cooldown 10 минут;
- имитируется новый процесс: account-store и session-store заново читаются с диска;
- cooldown A сохраняется, `candidates(preferred=A)` выбирает B;
- восстановленная история содержит mutating tool-call и matching result ровно по одному разу, `findPendingToolCalls()` пуст;
- короткое `continue` сохраняет эту историю;
- дополнительно фиксируется серверный инвариант: если сохранённый владелец A недоступен, старый A-owned upstream `chatId` не переиспользуется, B получает свежий тред с локально восстановленной историей.

Штатный `npm test` обновлён commit `494f4f4fb1882b049989c4ebd3e02211c72025da`; при обновлении сохранён параллельно добавленный QWEN_CORE test `subagent-owner-prompt-validation-test.js`.

### Что реально проверено в этом проходе
- новый test-файл локально прошёл `node --check` на hosted Node;
- GitHub read-back подтверждает точные bytes test-файла;
- read-back существующих `account-store`, `session-store`, `opencode-thread-affinity-test` подтверждает используемые тестом контракты;
- live/provider calls = 0;
- CircleCI/GitHub Actions/Cloudflare не запускались.

Полный exact-tree `npm test` и сам новый behavioral test на полном product tree пока НЕ заявлены: hosted-контейнер не может DNS-resolve `github.com`, а доступный GitHub connector не монтирует repository tree в filesystem. Не использовать внешний CI только ради этой обычной проверки.

## Что делать дальше
1. Когда exact-tree удаётся материализовать на hosted машине без внешнего CI, первым делом выполнить:
   - `node scripts/restart-failover-replay-safety-test.js`
   - request-governor reliability cluster из списка ниже.
2. Если новый final-gate test зелёный, offline часть цепочки `restart → A unavailable → B selected → completed side effect not replayed` считать доказанной.
3. После этого проверить более жёсткий вариант с unresolved mutating tool call: restart должен блокировать `continue` до matching tool result, а не failover/replay. Существующие `stream-session-restart-integration-test.js` и pending-tool regressions уже закрывают части этого инварианта; нужен только объединяющий final gate, если нынешних доказательств недостаточно.
4. Live/provider запускать максимум один раз только если для конечного доказательства действительно нужен реальный upstream и после проверки, что старый разрешённый live-run не дал результата.

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

## Уже закрытые инварианты — не исследовать заново
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; distinct-account retry budget; local persistence classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed; unknown-outcome inflight marker no-autoclear.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare и production без отдельной доказанной необходимости не использовать.
