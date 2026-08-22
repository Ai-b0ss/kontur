# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Текущий product head после нового unresolved-side-effect final gate: `6eab3a8232bc40b631e5804fe7fbb33e57754e1a`.
Перед новой записью перечитать fresh PR head: параллельно работает QWEN_CORE.

## V4–V10 закрыты — governor больше не микроаудировать
V4–V8 уже в product: durable global governor state, inflight-before-provider marker, fail-closed marker write, artifact ordering/generation, telemetry persistence isolation и регрессии.
V9 с автоматическим снятием unknown-outcome по 6 часам отменён: `RateLimited: wait ~Nh` допускает динамическое N без доказанной верхней границы, поэтому elapsed-time сам по себе не является доказательством безопасного повтора.
V10 внесён commit `f0b889804fbdd86c4ea1bf0cee5cc85d680194a2`: orphan `.inflight-*` после restart больше не auto-clear по wall-clock age; unknown provider outcome остаётся fail-closed до отдельного positive-evidence recovery.

## Два финальных offline gate теперь в product
### 1. Завершённый side effect не повторяется после restart/failover
`scripts/restart-failover-replay-safety-test.js`, commit `9444a8687f7efc9bc3f127412a3866389cea0c92`.
Проверяет A/B, завершённый mutating `write_file` + matching tool result, CAPTCHA A на 10 минут, restart, выбор B, отсутствие pending/replay и запрет переиспользовать A-owned upstream chat id.
Включён в штатный `npm test` commit `494f4f4fb1882b049989c4ebd3e02211c72025da`.

### 2. Незавершённый mutating tool call блокирует failover/replay
Добавлен `scripts/restart-unresolved-tool-failover-block-test.js`:
- первоначальный commit `c85e62bbddba1be6e3cde4a74d6fcb748f5cdc90`;
- включение в штатный `npm test`: `0abf1b70d943f1a902f5f8cdfe247400db43cd61`;
- усиление проверки порядка provider-dispatch: `6eab3a8232bc40b631e5804fe7fbb33e57754e1a`.

Новый gate моделирует:
- A/B в легитимном пуле;
- принятый `write_file`, у которого ещё нет matching tool result;
- durable checkpoint этого pending tool call;
- CAPTCHA/cooldown владельца A;
- новый процесс заново читает account-store и session-store;
- A остаётся недоступным, B становится первым допустимым кандидатом;
- короткое `continue` сохраняет unresolved `write_file` как pending;
- несмотря на доступный B, серверный `QWEN_PENDING_TOOL_RESULT` должен сработать до первого `qwenClient.sendChatRequest` в `/v1/chat/completions`, то есть sibling failover не может повторить неопределённый side effect.

Самопроверка после первого варианта gate поймала слабое место теста: поиск provider dispatch начинался уже после guard и не исключал более ранний вызов. Исправлено в `6eab3a82...`: теперь сравнивается первый provider dispatch от начала самого chat-completions route.

### Что реально проверено в этом проходе
- нормативный стартовый `LATEST` `20260822T015654Z-f0431f636b` восстановлен через `capsule_runtime_v4.py verify + restore`; archive SHA `c689723f99d070fa19e8c2988a9087b118757f4931b77290ebb1414d3588e16c`;
- новый test-файл локально прошёл `node --check` на hosted Node;
- GitHub read-back подтверждает новый test и его включение в `package.json`;
- свежий `server.js` прочитан: pending-tool guard реально расположен до provider dispatch;
- свежие `account-store`, `session-store`, `provider-circuit` перечитаны и подтверждают используемые контракты;
- live/provider calls = 0;
- CircleCI/GitHub Actions/Cloudflare не запускались.

Полный exact-tree `npm test` и behavioral execution двух финальных gate на полном product tree пока НЕ заявлены: hosted-контейнер по-прежнему не DNS-resolve `github.com`, а GitHub connector не монтирует repository tree в filesystem. Не использовать внешний CI только ради этой обычной проверки.

## Что делать дальше
1. Когда exact-tree удаётся материализовать на hosted машине без внешнего CI, первым делом выполнить:
   - `node scripts/restart-failover-replay-safety-test.js`
   - `node scripts/restart-unresolved-tool-failover-block-test.js`
   - request-governor reliability cluster ниже.
2. Если оба final gate зелёные, offline-цепочку `restart → account A unavailable → sibling B eligible → completed side effect не повторяется; unresolved side effect блокирует продолжение до matching tool result` считать закрытой.
3. После этого не микроаудировать уже закрытый replay/failover-контур. Следующий полезный Reliability-кусок искать только при новом воспроизводимом дефекте в account pool / cooldown / provider circuit / affinity / bounded retry или durable side-effect guard.
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
