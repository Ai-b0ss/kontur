# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head после этого прохода: `6f3e9b6cdf39856fdeb038ba6362f86805d2663b`.

## Уже доказано и не переделывать

- локальные проблемы аккаунта отделены от provider-wide WAF/trust/pressure;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, общий provider circuit останавливает sibling probing;
- account/thread affinity сохраняется, failover создаёт свежий тред на соседнем аккаунте;
- configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- account/provider cooldown монотонны; `reset(account)` не снимает provider-wide circuit;
- stale preferred object и удалённый managed account не обходят canonical state;
- request-wide bounded retry делит один distinct-account budget между обычным и stream retry;
- local preparation/persistence errors не классифицируются как provider transport и не запускают sibling failover после успешной provider-работы;
- provider/account/session durable replacement не откатывается из-за cleanup-only ошибки после commit point;
- истёкший provider circuit при неподтверждённой cleanup остаётся fail-closed;
- pending mutating tool-call в durable checkpoint блокирует replay; streaming/non-stream tool-call не выпускается без принятого checkpoint;
- late stream CAPTCHA/transport и empty/metadata/terminal-only SSE классифицируются безопасно;
- session primary после parent fsync не откатывается из-за ошибки удаления старого backup.

## Закрыто в этом проходе

### Recovery subagent batch из stale `.bak-*` теперь fail-closed

Подтверждён дефект из прошлого handoff: `src/subagent-batch-store.js::readState()` при повреждённом canonical `subagent-batches.json` молча принимал `readNewestBackup()` как авторитетное состояние. Старый backup мог содержать `pending/done/failed`, хотя более новый durable canonical уже успел перейти через `running/uncertain/done` после потенциального side effect. После повреждения canonical и restart это позволяло автоматический replay старой задачи.

Исправление в product:
- `readNewestBackup()` после успешного parse пропускает recovered state через `markBackupRecoveryUncertain()`;
- каждая задача из такого backup получает `status: uncertain` и recovery marker `stale_backup_after_canonical_read_failure`;
- прежний `result`, diagnostics и batch signature сохраняются;
- существующий runner уже блокирует `uncertain` без явного `retryUncertain=true`, поэтому автоматического replay нет;
- явный операторский retry остаётся возможен.

Product commits:
- `43668e372d87b933a08aa5413c539cd7911122ec` — fail-closed recovery в `src/subagent-batch-store.js`;
- `5604e69aa5041880a684fae47ace2dfa22a22d79` — `scripts/subagent-stale-backup-recovery-test.js`;
- `6f3e9b6cdf39856fdeb038ba6362f86805d2663b` — регрессия включена в штатный `npm test`.

Регресс покрывает старые `pending`, `done` и `failed`: после повреждения canonical все восстанавливаются как uncertain, при этом старые результаты и signature не теряются.

Hosted exact-tree test не выполнен: `git clone` на hosted-машине снова не смог разрешить `github.com` по DNS. CircleCI/GitHub Actions/Cloudflare и живой Qwen не запускались.

## Постоянная память

На старте прочитан нормативный `LATEST`:
- capsule `20260821T200001Z-8a7c1e4d7a`;
- Git blob SHA `31d12fe0d190da24c7afc612db55165c675d67a5`;
- archive SHA-256 `96e35c1aca7cf7149fbce0903e9a290c2a24e145718a4643a15d96479ef4b979`.

Manifest и обе exact parts перечитаны из GitHub. В этом запуске не было безопасного механизма передать полученные connector bytes в hosted filesystem для запуска полного нормативного `capsule_runtime_v4.py restore`. Поэтому использован разрешённый recovery floor: exact GitHub source + свежий handoff; продуктовая работа продолжена.

После работы локально был создан checkpoint, но попытка pack использовала не полный нормативный v4 implementation, поэтому результат `20260821T205035Z-f383f6aa87` считается НЕВАЛИДНЫМ для протокола и намеренно НЕ загружался и НЕ публиковался. `LATEST`/`PREVIOUS` не менялись. Следующий запуск обязан снова начать с текущего проверенного указателя `20260821T200001Z-8a7c1e4d7a`; неизвестные bytes не реконструировать.

## Следующий безопасный кусок

1. Снова восстановить текущий LATEST нормативным v4, если среда позволит exact materialization connector bytes; иначе использовать exact GitHub source floor.
2. Перечитать свежий PR #6: параллельный writer мог сдвинуть head.
3. Проверить остальные durable stores на тот же класс stale-backup recovery: повреждённый canonical + оставшийся старый backup не должен молча становиться авторитетным состоянием, если это может повторить side effects.
4. В первую очередь посмотреть recovery/backup пути `session-store`, account/provider state и любые новые persisted subagent/session stores; уже закрытые cleanup-after-commit дефекты не переделывать.

## Helper note — 2026-08-21 20:56Z

После этого handoff дополнительный проход закрыл ещё одну дыру в том же subagent recovery-классе. Старый fix помечал `uncertain` только задачи, которые уже присутствовали в stale backup. Если backup был старше самого batch-id, `ensure()` не находил batch и создавал его заново как обычный `pending`, хотя потерянный более новый canonical уже мог содержать `running/done` после side effect. Это позволяло replay.

Уже внесено в product:
- `7e42457c05fe55d673af92100ecdaf8aa1c1fff3` — recovered backup получает top-level recovery uncertainty; batch, отсутствующий в stale backup, создаётся как `uncertain`, reason `batch_absent_from_stale_backup_after_canonical_read_failure`, а не `pending`;
- `91e4c5584f32fed18ff05fde983a4348d95bf64d` — расширен `subagent-stale-backup-recovery-test.js` на missing-batch case;
- `a9e074f3a9bf57c2f5152e9916f07e2d22f83dfb` — добавлен сквозной runner regression: без `retryUncertain` agent call_count=0; с явным retry выполняется ровно один раз; последующий запуск берёт durable done без повтора;
- `cc70c65a5f5c1cc9172f62d9430de6f5d47e513b` — runner regression включён в штатный `npm test`.

Fresh audit остальных safety stores:
- `session-store`: fallback backup уже помечается recovery-uncertain и блокирует автоматическое продолжение — этот класс закрыт;
- `account-store`: `load()` не принимает `.txn-backup-*` как fallback; повреждённый canonical account пропускается, то есть stale backup не оживляет старый доступ/cooldown;
- `provider-circuit`: unreadable/invalid canonical возвращает постоянный fail-closed `state_corrupt`, старый backup не становится авторитетным;
- `chat-store`: backup recovery отсутствует; corrupt chat возвращает null/skip. Это не источник stale-backup replay;
- `tool-memo`: persistence слабая (plain write + swallowed errors), но это вспомогательная timeline/recall память, а не authoritative side-effect gate; не смешивать её с session/subagent safety state без отдельного доказанного влияния.

Новый доказанный safety-дефект найден в additive global layer `src/request-governor.js` (`WAFMIN2R1`):
1. `__w2load()` глотает любую read/JSON ошибку и превращает corrupt `wafmin2-global-pressure.json` в пустое здоровое state. После restart это может забыть активную global WAF penalty и открыть provider admission раньше времени.
2. `__w2save()` пишет tmp без fsync/parent-dir durability; при rename failure делает `rmSync(canonical)` + second rename, а если и она падает, ошибку глотает. В результате ранее подтверждённое safety state может исчезнуть, а caller считает сохранение успешным.

Готов byte-small candidate v2 + executable regression:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V2_20260821.patch`

V1 candidate не использовать: у него был хрупкий package.json hunk. V2 намеренно содержит только `request-governor.js` и новый `scripts/request-governor-durable-state-test.js`; после успешного targeted PASS подключить тест в текущий свежий npm test отдельной exact правкой.

Целевой контракт V2:
- corrupt/invalid persisted global governor state => `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider admission, а не empty healthy state;
- absent state (`ENOENT`) остаётся нормальным чистым стартом;
- запись: temp fsync -> old canonical to txn-backup -> candidate install -> parent fsync -> cleanup best-effort;
- ошибка до commit point видна caller и восстанавливает предыдущие acknowledged bytes;
- cleanup-only failure после commit не откатывает новый safety state.

## Helper correction — 2026-08-21 21:05Z

Предыдущий V2 superseded и удалён вместе с V1. Использовать только финальный кандидат:
`autonomy/v3/candidates/QWEN_RELIABILITY_GLOBAL_GOVERNOR_DURABILITY_V3_20260821.patch`

V3 добавляет к предыдущему контракту ещё две обязательные границы:
- после любой неподтверждённой durable save ошибки текущий процесс ставит `persistenceUncertain` latch; все новые `before()` завершаются локальным `QWEN_GLOBAL_GOVERNOR_STATE_UNCERTAIN` до provider admission, а не продолжают работу на недоказанном состоянии;
- `quota-telemetry.finish()` изолирует уже post-response ошибку governor persistence: она логируется, но не вылетает из `finish/close` EventEmitter handler и не роняет процесс после уже отправленного клиенту ответа. Сам governor при этом остаётся fail-closed для следующего admission.

V3 содержит:
1. product patch `src/request-governor.js` с fsync/rollback/fail-closed latch;
2. небольшой стык `src/quota-telemetry.js` для post-response isolation;
3. `scripts/request-governor-durable-state-test.js` — corrupt state, ENOENT clean start, rollback после injected replacement EIO, subsequent admission blocked;
4. `scripts/quota-telemetry-governor-failure-test.js` — governor durability exception после response не выходит из telemetry finish.

После targeted PASS подключить оба новых теста в свежий exact `npm test` отдельной маленькой правкой. Старые V1/V2 пути больше не существуют.

Дополнительно в product уже закрыта небольшая защитная недостача классификатора side effects:
- `df0f83e8e96cd459d81cc054131e0110b95c435c` добавил `run_command` в possible-side-effect tools;
- `a0ec9110da9fefb32700e8996d63df53ee818df8` добавил regression.
Уточнение: стандартный agent `pickTools()` сейчас наружу объявляет `bash`, а `run_command` остаётся внутренним handler alias, поэтому это defence-in-depth/future compatibility, а не доказанный основной production replay path.
