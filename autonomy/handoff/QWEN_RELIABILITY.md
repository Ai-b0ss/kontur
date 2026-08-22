# Qwen — надёжность / финишный handoff

Обновлено QWEN_RELIABILITY 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `e21baa6c29edfc2b592db01106fcd9c32f752a21`.
Перед любой новой записью снова fresh-read PR #6 и `autonomy/handoff/QWEN_CORE.md`: QWEN_CORE работает параллельно.

## Свежий обязательный контрпример — noncanonical durable filename
Helper commit: `8d7a54dd0a5f4eb95e178d91101ac347c9acea80`.
Regression: `scripts/account-store-noncanonical-filename-test.js`.

До исправления `load()` делал `safeId(path.basename(file, '.json'))`, поэтому `alpha.beta.json` становился логическим id `alpha-beta`. Если внутри такого файла лежал `id: alpha-beta`, прежняя проверка filename-vs-embedded-id проходила. Это создавало второй durable pathname для одной identity и оставляло путь для stale/rogue alias/resurrection после restart/remove.

Минимальный обязательный инвариант теперь такой: каждый принимаемый managed account file уже обязан называться ровно `${safeId(stem)}.json`; имя файла нельзя нормализовать в другую identity.

### Исправление
Product commit: `e21baa6c29edfc2b592db01106fcd9c32f752a21` (`fix(account): reject noncanonical durable filenames`).
Compare с непосредственным родителем `ee1c596534dc926edcdef97886801bfd36fe4ae3` подтвердил только `src/account-store.js`, `+5/-1`.

Новый порядок в `load()`:
1. `stem = path.basename(file, '.json')`;
2. `fileId = safeId(stem)`;
3. если `${fileId}.json !== file` — файл reject/fail-closed;
4. только затем JSON parse и существующая проверка embedded id.

Таким образом `alpha.beta.json` не может стать `alpha-beta`, а канонический `alpha-beta.json` остаётся допустимым.

### Проверка и честная граница доказательства
Старое/новое поведение воспроизведено на hosted Node моделью того же filename-инварианта:
- old: `ACCOUNT_STORE_NONCANONICAL_FILENAME_OLD_FAIL reproduced_alias=1`;
- fixed: `ACCOUNT_STORE_NONCANONICAL_FILENAME_PASS rogue_rejected=1 canonical_loaded=1`.

Но exact закрытый repo по-прежнему нельзя клонировать в hosted container из-за DNS, поэтому полный требуемый cluster на exact-tree в этой смене НЕ объявляется зелёным. Не считать semantic model заменой exact test execution.

Поэтому новый regression пока намеренно НЕ подключён к обычному `npm test`: владелец потребовал сначала получить green для:
- `account-store-noncanonical-filename-test.js`;
- `account-store-filename-identity-test.js`;
- `account-store-persistence-test.js`;
- `account-store-interrupted-replacement-recovery-test.js`;
- `account-store-mutation-atomicity-test.js`;
- `account-store-cooldown-test.js`;
и ближайших account-store/cooldown проверок.

После exact/исполняемого green подключить regression к обычному `npm test`, не ослабляя его.

## Координация с QWEN_CORE
На входе fresh QWEN_CORE handoff указывал head `0c8b0c8c1557449b7b3ead5526368f88bb3687a5`; к моменту product write PR уже дошёл до `ee1c5965...` изменением только subagent regression. Перед записью `src/account-store.js` его свежий blob был перечитан. Compare после записи подтвердил отсутствие посторонних изменений.

Reliability не заходил в Core-зону session/subagent/system prompt.

## Уже закрытые дефекты — без нового контрпримера не открывать заново
- account-local/provider-wide separation;
- stale preferred / removed-account resurrection через caller-owned object;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- completion/chat-create pre-dispatch cooldown races;
- wall-clock jump для account cooldown и provider-wide circuit;
- late success не стирает более свежий cooldown и не возвращает active pointer на охлаждённый аккаунт;
- durable account/session/provider cleanup-after-commit;
- interrupted replacement recovery и legacy migration rollback;
- embedded-id filename alias (`alpha.json{id=beta}`);
- stream checkpoint-before-release / late stream errors;
- pending mutating tool replay guard;
- stale session/subagent backup fail-closed;
- durable request governor V4–V10;
- restart/failover replay-safety для completed и unresolved mutating calls.

Свежий noncanonical-pathname дефект (`alpha.beta.json -> alpha-beta`) закрыт кодом на `e21baa6c...`, но его exact cluster proof ещё pending как описано выше.

## Следующий обязательный порядок
1. Fresh-read PR #6 + QWEN_CORE; убедиться, что `src/account-store.js` после `e21baa6c...` не затёрт.
2. Получить исполняемый exact-tree/эквивалентный byte-exact запуск свежего filename cluster: новый noncanonical regression + filename identity + persistence + interrupted replacement + mutation atomicity + cooldown.
3. Только после green добавить `account-store-noncanonical-filename-test.js` в обычный `npm test`.
4. На том же свежем product SHA прогнать targeted provider cluster: monotonic, wall-clock jump, trip wall-clock jump, missing-state fail-closed, missing-state retrip/restart, persistence, clear-durability, provider-safety.
5. Затем актуальный account-store/failover/replay cluster и разумный red-team по незакрытым серьёзным границам, особенно Windows/path/rename/file-locking/process/env.
6. Когда Core + Reliability targeted clusters зелёные на одном стабильном SHA — полный exact-tree Linux `npm test`.
7. После Linux PASS — один native Windows Server CircleCI final gate на том же exact product SHA по `autonomy/ci/CIRCLECI_GATE_POLICY.md`. Windows FAIL = blocker; недоступный результат != PASS.
8. Live provider без новой причины не повторять.

## CircleCI final gate
Новый gate в этом проходе НЕ запускался. До него ещё не выполнен exact targeted cluster, поэтому тратить редкий final gate преждевременно.

Gate разрешён только через disposable `ci/qwen-final-gate`, одним владельцем exact SHA, с locked install, полным offline Linux suite и native Windows suite, без provider/secrets/production.

## Постоянная память / v4 CAS
Worker: `QWEN_RELIABILITY`.
На старте перечитаны `CAPSULE_RUNTIME_PROTOCOL_V2.json`, exact `capsule_runtime_v4.py`, `LATEST.json`, manifest и обе части текущей capsule. Проверенный pointer остаётся:
- LATEST capsule `20260822T115554Z-8763a42805`;
- LATEST blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`;
- archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`.

Локально был создан и `verify + restore` прошёл новый кандидат `20260822T195626Z-f82f5a9bf8` для source ref `e21baa6c...`. Однако обязательный read-back после загрузки поймал несовпадение part-0000 с SHA, записанным в manifest. По протоколу такой кандидат НЕ публикуется и НЕ может стать LATEST. Он оставлен только как непроверенный orphan; `LATEST/PREVIOUS` не менялись, force-write не использовался.

Это намеренный fail-closed результат CAS-протокола: следующий запуск должен восстановиться из прежнего проверенного LATEST/точного GitHub source и заново сделать `pack -> upload -> readback byte verify -> CAS`, а не пытаться чинить байты orphan по памяти.

Live Qwen/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе не использовались.
