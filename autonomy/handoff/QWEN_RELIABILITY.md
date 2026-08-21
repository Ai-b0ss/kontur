# Qwen — надёжность, пул аккаунтов и защита от повторных side effects

Обновлено: 2026-08-21.

Основная продуктовая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Свежий product head этого запуска: `5c7df532f747cdb103d02fdd0de26feb957b4ae8`.

## Уже доказано и не переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера;
- CAPTCHA/rate limit/expired auth допускают ограниченный failover, provider-wide WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет account/thread affinity, а допустимый failover переносит локальную историю в свежий тред другого аккаунта;
- stale `current()`/`preferredAccount` fail-open закрыт: configured-but-none-eligible => `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов => `401`;
- account cooldown монотонный; поздняя CAPTCHA в принятом SSE идёт через `markCaptchaChallenge`;
- duplicate `Failed to generate chat_id` classification закрыт;
- критичные account/session/provider-circuit состояния сохраняются crash-safe;
- automatic retry поздней SSE-ошибки отсутствует;
- pending tool-call в durable checkpoint блокирует короткий `continue` через `409 QWEN_PENDING_TOOL_RESULT`;
- потоковые mutating tool-calls удерживаются до durable acceptance; поздняя SSE-ошибка не выпускает их клиенту;
- streaming и оба non-stream `sessionStore.set() === false` fail-open закрыты через `QWEN_TOOL_CHECKPOINT_REJECTED`;
- transport error после принятого SSE проходит в account/provider classification ровно один раз;
- удаление аккаунта после durable rename не расходится между диском и памятью при сбое cleanup tombstone;
- ended empty/metadata-only initial SSE получает account-local classification и bounded sibling failover, чужой upstream `chatId` соседнему аккаунту не переиспользуется;
- terminal-only initial SSE (`[DONE]`, `true`, `{data:true}`) не считается пригодным model output;
- unconfirmed initial-gate release, который позже доказанно закончился без usable output, классифицирует фактический аккаунт один раз и выбирает свежего eligible sibling перед retry;
- provider-wide circuit не снимается через `reset()` конкретного аккаунта; `accountId` в circuit — атрибуция, а не право на локальную разблокировку;
- provider-wide circuit теперь тоже монотонный по времени: более поздний короткий WAF/pressure сигнал не может сократить уже действующий более длинный trust/WAF блок.

## Этот запуск — provider circuit cooldown downgrade

Найден отдельный fail-open по времени. `providerCircuit.trip()` безусловно перезаписывал активное provider-wide состояние. Поэтому, например, уже действующий `trust_restriction` на 30 минут мог быть заменён пришедшим чуть позже `waf` на 10 минут или `provider_pressure` на 2 минуты. При нескольких уже летящих запросах это могло открыть весь пул раньше, чем требовал более сильный предыдущий сигнал.

Исправлено:

- `617151237caf8f6553ea30085077e57d23af24ae` — `src/provider-circuit.js`: перед записью читается активный circuit; если его `until` позже или равен новому, сохраняется существующий. Новый сигнал может только продлить общий блок, но не сократить его.
- `8a3d799eefa9bdbc33516c985b5a0028b9eda88f` — новый `scripts/provider-circuit-monotonic-test.js`: trust 30m -> WAF 10m -> pressure 2m не сокращают блок; более длинный последующий сигнал может его продлить.
- `5c7df532f747cdb103d02fdd0de26feb957b4ae8` — регресс включён в штатный `npm test`.

Во время запуска параллельный Qwen worker добавил изменения в `session-store.js` и session-тест. Наши файлы с ним не пересекались. Compare от предыдущего head показывает совместное продвижение ветки; собственная зона этого worker ограничена `src/provider-circuit.js`, новым monotonic-тестом и `package.json`.

## Проверки и ограничения запуска

- CircleCI не запускался;
- GitHub Actions не запускались;
- Cloudflare не использовался;
- provider/live запросов к Qwen: 0;
- реальные аккаунты, секреты и production не тронуты;
- полный `npm test` exact-tree не заявлять: hosted container не имеет DNS до GitHub. Выполнены read-back ветки, проверка diff/головы и отдельная регрессия добавлена в штатный набор.

## Capsule runtime

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`.

Старт запуска:

- LATEST: `20260821T030413Z-4f34d77e1e`;
- стартовый Git blob SHA LATEST: `8b0fbc3de020c5bf5b120cef7d936d326b6d6664`;
- archive SHA: `96c7b605db9910157c9caf2f222bfb72aab89a402eb60c1a61766a6cbffa71f2`;
- v4 `verify` + `restore` = PASS.

Финиш:

- первая попытка capsule `20260821T035602Z-eadd338f84` была отбракована: повторное чтение part показало несовпадение байтов; LATEST на неё не переводился;
- повторный v4 pack: `20260821T035831Z-5cb774203d`;
- source ref: `Ai-b0ss/qwen-free-api@5c7df532f747cdb103d02fdd0de26feb957b4ae8`;
- archive SHA-256: `e6c958ce38ac2ee3ec224f433284ce924bcf63a0dd99c5a713a8348b979d1255`;
- part: 1844 chars, SHA-256 `be1f0cd72720ae9a062efe6bd259d8ff9be9ca6b842395d441216fbc7fb12f67`, remote Git blob SHA `985f69f381c2cb583e727db6cb3da1482158b712` совпал с локально вычисленным;
- manifest remote Git blob SHA `e2e993b465035d94006f32a6597068f81915050d` совпал с локально вычисленным;
- непосредственно перед CAS LATEST всё ещё имел стартовый blob SHA `8b0fbc3d...`;
- старый LATEST сохранён как PREVIOUS;
- новый LATEST опубликован exact CAS и перечитан; новый blob SHA `5d03f31813b6080bfd66a7bf327316ad1630b3c8`.

## Следующий приоритет

1. На следующем запуске восстановить свежий LATEST/PREVIOUS через v4 и проверить свежий head PR #6.
2. Если exact-tree станет доступен hosted локально — прогнать штатный `npm test`; иначе не изображать полный PASS.
3. Дальше искать только независимый дефект в зоне pool/cooldown/provider circuit/preferred-current/failover/thread affinity/side-effect replay. Не трогать Qwen Core и не повторять provider/live без доказанной необходимости.
