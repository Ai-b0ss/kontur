# Qwen — надёжность / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:20+03.

## Текущая линия

Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий наблюдавшийся PR head перед этим handoff: `a0ec9110da9fefb32700e8996d63df53ee818df8`.

Перед любой записью перечитать свежий head/blob: параллельно работает QWEN_CORE.

## Уже доказано — не исследовать заново

- account-local ошибки отделены от provider-wide WAF/trust/pressure;
- CAPTCHA/rate-limit/expired auth имеют bounded failover; provider circuit останавливает sibling probing;
- account/thread affinity и fresh-thread failover закрыты;
- configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, no accounts => `401`;
- cooldown/provider cooldown монотонны;
- stale preferred object и removed account не оживают через detached state;
- request-wide retry имеет общий distinct-account budget;
- local preparation/persistence errors не маскируются как provider failure;
- account/provider/session durable replacement не откатывается из-за cleanup-only ошибки после commit point;
- expired provider circuit при неподтверждённой cleanup остаётся fail-closed;
- pending mutating tool call блокирует replay; tool calls не выпускаются без durable checkpoint;
- late stream CAPTCHA/transport и empty/metadata/terminal-only SSE классифицируются безопасно;
- session primary после parent fsync не откатывается из-за backup cleanup failure.

## Уже внесено helper-проходом

Stale subagent backup закрыт глубже первоначального fix:
- `7e42457c05fe55d673af92100ecdaf8aa1c1fff3` — если stale backup вообще не знает batch-id, новый batch создаётся `uncertain`, не `pending`;
- `91e4c5584f32fed18ff05fde983a4348d95bf64d` — missing-batch regression;
- `a9e074f3a9bf57c2f5152e9916f07e2d22f83dfb` — сквозной runner regression: 0 auto calls, 1 explicit retry, затем durable done без повтора;
- `cc70c65a5f5c1cc9172f62d9430de6f5d47e513b` — regression включён в штатный `npm test`.

Defence-in-depth:
- `df0f83e8e96cd459d81cc054131e0110b95c435c` — `run_command` классифицируется как possible side effect;
- `a0ec9110da9fefb32700e8996d63df53ee818df8` — regression.
Стандартный agent сейчас наружу объявляет `bash`, поэтому это future-compatibility, не основной production replay path.

Fresh audit stale-backup класса:
- `session-store`: fallback recovery уже uncertainty-gated;
- `account-store`: `.txn-backup-*` не принимается как authoritative fallback;
- `provider-circuit`: corrupt/invalid canonical => fail-closed;
- `chat-store`: stale-backup fallback отсутствует;
- `tool-memo`: weak persistence, но это вспомогательная recall timeline, не authoritative side-effect gate.

## Главный незакрытый Reliability gate: global WAF/request-governor durability

Доказанный дефект текущего `src/request-governor.js` additive `WAFMIN2R1`:
- read/JSON failure может превращать persisted global pressure state в пустое healthy state;
- старый save-path недостаточно crash-safe и способен потерять ранее подтверждённое safety state.

### Единственный актуальный bundle

Применять **оба** файла последовательно на свежие exact blobs:

1. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V4_20260821.patch`
2. `autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V5_DELTA_20260822.patch`

V4 один больше НЕ считать финальным.

После V4+V5 целевой контракт:
- corrupt JSON => `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider traffic;
- syntactically valid but semantically invalid state (`{}`, wrong/missing v3 fields, invalid usage/start entries) => fail-closed;
- missing canonical + owned `.tmp-*`/`.txn-backup-*` => fail-closed;
- missing canonical + невозможность проверить recovery directory => fail-closed;
- настоящий первый старт: ENOENT + каталог доступен + recovery artifacts отсутствуют => разрешён;
- save: temp + file fsync -> old canonical to txn backup -> install -> parent fsync -> cleanup best-effort;
- failure before commit point пытается вернуть acknowledged bytes и ставит process-local `persistenceUncertain` latch;
- после такой ошибки новые `before()` блокируются до provider traffic;
- cleanup-only failure после подтверждённого commit не откатывает новое состояние;
- `quota-telemetry.finish()` не роняет процесс после уже отправленного ответа, если governor persistence упал; сам governor остаётся fail-closed.

### Обязательные targeted checks

После применения V4+V5, до подключения в общий test chain:

`node scripts/request-governor-durable-state-test.js`
`node scripts/quota-telemetry-governor-failure-test.js`
`node --check src/request-governor.js`
`node --check src/quota-telemetry.js`

Первый regression обязан показать как минимум:
`corrupt=1 semantic_invalid=1 orphan_artifact=1 artifact_inspection_failure=1 clean_enoent=1 rollback=1 save_failure_latch=1`.

Только после targeted PASS добавить оба новых теста в свежий exact `npm test` отдельной минимальной правкой и прогнать ближайший reliability cluster / полный suite, если exact tree материализуем.

## Постоянная память

Последний проверенный нормативный Reliability LATEST до helper-прохода:
- capsule `20260821T200001Z-8a7c1e4d7a`;
- archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.

Поздняя попытка pack `20260821T205035Z-f383f6aa87` была признана НЕВАЛИДНОЙ и не публиковалась. Не восстанавливать её и не реконструировать неизвестные bytes.

Если нормативный v4 runtime удаётся materialize — verify/restore текущий LATEST. Если нет, разрешён exact GitHub source + этот handoff как recovery floor.

## После global-governor gate

1. Повторно просмотреть свежий PR diff на новые persisted safety stores, появившиеся параллельно.
2. Не переделывать уже закрытые cleanup-after-commit классы без нового воспроизводимого нарушения.
3. Если targeted/full regression green — перейти к финальным restart/failover/live gates, а не продолжать бесконечный поиск косметических дефектов.
4. Не запускать live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого текущего режима.