# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после текущего Core-исправления: `b0baa506e94cad0c89ca26c6e2af1c2e5371a019`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` всё ещё действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Новый закрытый Core-дефект: plain subagent false-success на пустом 200

На exact прежнем `src/subagent-dispatcher.js` blob `ad3cc72c7a317c5d2ed8aed2ea13f9f2d4f6d721` plain-subagent считал HTTP 200 успешной задачей даже когда OpenAI-совместимый ответ не содержал пригодного assistant text.

Exact hosted reproduction без provider/CI:
`QWEN_SUBAGENT_EMPTY_SUCCESS_REPRODUCED cases=4 false_success=4`.

Воспроизводились как ложный `ok=true`:
- `{}`;
- `choices=[]`;
- `message.content=''`;
- `message.content=[]`.

Это серьёзный агентный дефект: подзадача могла быть помечена завершённой без результата, а родитель продолжал бы работу на ложном основании.

### Исправление и постоянный regression
- root fix commit `6357f84dbc254b810cec99fa168d68c2e5fbe668`;
- новый `src/subagent-dispatcher.js` blob `145cedcf21018c08d16d5758757da06ab6bcca9f`;
- regression `scripts/subagent-empty-response-test.js`: commit `9d7151e28cf7d984f27949a2c655207e94e53d35`;
- regression сразу подключён в штатный `npm test`: commit/head `b0baa506e94cad0c89ca26c6e2af1c2e5371a019`, `package.json` blob `2e195e184c645eca8c8216a24169c2547bc46cdd`.

Новая семантика: HTTP 200 без непустого assistant text -> `ok=false`, `code=QWEN_SUBAGENT_EMPTY_RESPONSE`; валидный structured text остаётся успехом.

Targeted hosted checks на точных исходных байтах до/после исправления:
- `QWEN_SUBAGENT_EMPTY_RESPONSE_PASS rejected=5 structured_text=1`;
- canonical `scripts/subagent-dispatcher-test.js` exact blob `fa146bc9bb6fa61dbba89f4f88684388e45e43a0` -> `subagent dispatcher: PASS`.

Новый invariant test не оставлен standalone: он уже входит в обычный `npm test`.

## Сохраняющий силу Core restart/session proof
До этого на exact `src/session-store.js` blob `accd62da1814060069642832326fd3cf280c8156` были зелёными:
- nested durable session schema fail-closed;
- owner authority type checks;
- большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed.

Fresh compare предыдущего Core-head `04b9f75f...` -> `70bb0175...` до текущей работы менял только `package.json`; session-store/core restart bytes не двигались. Текущая работа затронула только plain subagent dispatcher + новый regression + `package.json`, поэтому restart/session proof не затёрт.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- `provider-safety-test.js` теперь присутствует в штатном `npm test`, но Reliability всё ещё требует его exact execution на настоящем locked dependency tree с `axios` и не принимает shim/reconstructed dependency proof.

Core не меняет `account-store`, cooldown или provider-circuit.

## Что осталось до финиша
1. Fresh exact Core cluster на стабильном общем SHA: owner/session/restart/stale-backup/pending-tool + plain/coding subagent + stream/tool-result tests.
2. Reliability exact `provider-safety-test.js` на том же product SHA.
3. Full exact-tree Linux `npm test` на стабильном общем SHA.
4. Пока Circle freeze действует — максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.
5. После явной разморозки — один native Windows Server 2022 final gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
6. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness с `QWEN_WINDOWS_READY` либо первым точным blocker; проверить harness в native Windows Circle.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

В этом проходе новый v4 pointer не публиковался: через доступную GitHub-поверхность не удалось надёжно разрешить фактический путь текущих LATEST/PREVIOUS/runtime файлов, а force-write/самодельная pseudo-v4 процедура запрещены. Состояние не подменялось. Следующий проход обязан fresh-read фактические pointer/runtime paths и выполнить только нормативный `restore -> checkpoint -> pack -> verify -> restore -> CAS`.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
