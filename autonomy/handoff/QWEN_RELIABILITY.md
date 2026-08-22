# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Текущий product head после исправления и включения регрессии в `npm test`: `23891cbc845996726ba5e0477c8542ff8361cf4d`.
Перед новой записью перечитать fresh PR head: параллельно может работать QWEN_CORE.

## Freshest дефект закрыт — preferred reuse больше не пробивает distinct-account budget
Был воспроизведён крайний случай request-wide bounded failover:
- общий distinct-account budget = 4;
- уже реально использованы `A,B,C,D`;
- server делает thread rebase и включает `allowPreferredReuse=true` для D;
- D успевает стать unavailable;
- fresh eligible уже только `E,F,G`;
- старая формула всё равно давала `reuseCredit=1` по одному id D и могла пропустить E как пятый distinct account.

До исправления hosted repro:
`PREFERRED_REUSE_BUDGET_LEAK_REPRO_PASS distinct_budget=4 fifth_account=E`.

Регресс `scripts/preferred-reuse-distinct-budget-test.js` уже был добавлен commit `8c5a08f13668d28888f150b994f5d9e76f51f4cc`.

Продуктовый фикс внесён commit `5ee53c157f5beeee9560830f0b0dfcc3a2ec30de`:
- `operationCandidates()` сначала получает fresh canonical `eligible = accountStore.candidates(preferredAccount)`;
- reuse-credit выдаётся только если preferred id уже attempted **и сам preferred всё ещё присутствует в fresh eligible**;
- разрешение повторного preferred id в filter управляется тем же `preferredReusable`;
- новый sibling account не получает reuse-credit.

Read-back diff подтверждает узкое изменение только `src/qwen-client.js::operationCandidates()`.

Hosted targeted execution после фикса:
`QWEN_PREFERRED_REUSE_DISTINCT_BUDGET_PASS`.

После PASS тест включён в штатный `npm test`, commit `23891cbc845996726ba5e0477c8542ff8361cf4d`.

Граница доказательства: это реальное целевое выполнение исправленной функции на hosted Node и read-back точного product diff. Полный exact-tree `npm test` не заявлен: внешний CI для обычной разработки не запускался.

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
`scripts/restart-unresolved-tool-failover-block-test.js`:
- первоначальный commit `c85e62bbddba1be6e3cde4a74d6fcb748f5cdc90`;
- включение в штатный `npm test`: `0abf1b70d943f1a902f5f8cdfe247400db43cd61`;
- усиление порядка provider-dispatch: `6eab3a8232bc40b631e5804fe7fbb33e57754e1a`.

Gate моделирует принятый `write_file` без matching tool result, durable checkpoint, CAPTCHA/cooldown владельца A, restart и доступного B. Короткое `continue` обязано остановиться на `QWEN_PENDING_TOOL_RESULT` до первого нового provider dispatch.

## Hosted-проверка restart/failover/replay-safety
На commit-pinned реализации store/circuit контрактов реально выполнены обе сценарные проверки:
- `QWEN_RESTART_FAILOVER_REPLAY_SAFETY_PASS restart_history=1 captcha_persisted=1 sibling_selected=1 old_thread_not_reused=1 completed_side_effect_not_replayed=1`
- `QWEN_RESTART_UNRESOLVED_TOOL_FAILOVER_BLOCK_PASS pending_restart=1 owner_a_unavailable=1 sibling_b_eligible=1 continue_blocked_before_provider=1`

Граница доказательства: это реальное behavioral execution на hosted машине, но не полный exact-tree checkout.

## Что делать дальше
1. Freshest preferred-reuse defect закрыт; не открывать его снова без нового воспроизводимого контрпримера.
2. Следующий поиск ограничивать зоной reliability: account pool/candidates/cooldown, provider-wide circuit, preferred/current, thread affinity, request-wide bounded retry и replay safety. Не дублировать QWEN_CORE и не микроаудировать уже закрытые V4–V10.
3. Если exact-tree удаётся материализовать на hosted машине без внешнего CI, первым делом выполнить штатно:
   - `node scripts/preferred-reuse-distinct-budget-test.js`
   - `node scripts/restart-failover-replay-safety-test.js`
   - `node scripts/restart-unresolved-tool-failover-block-test.js`
   - request-governor reliability cluster ниже.
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
Account-local/provider-wide separation; bounded failover/cooldown/provider circuit; account/thread affinity; stale preferred/removed-account resurrection; request-wide distinct-account retry budget, включая preferred-reuse edge; local persistence classification; cleanup-after-commit durability; pending mutating tool replay guard; stream checkpoint-before-release; late stream CAPTCHA/transport/empty SSE; session stale-backup fail-closed; unknown-outcome inflight marker no-autoclear.

Live Qwen/provider, GitHub Actions/CircleCI/Cloudflare и production без отдельной доказанной необходимости не использовать.
