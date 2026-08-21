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
