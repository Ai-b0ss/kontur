# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после Core-записи: `aab492abc9ce0dd71bdd58392ed2d653c3d0e490`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9 и QWEN_CORE `LATEST.json`.

## Уже закрыто — без нового контрпримера не открывать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация внешнего system-prompt mode/owner aliases;
- direct agent/coding-subagents принимают owner prompt только как непустую строку без преобразования;
- internal prompt mode различает отсутствие поля и явно плохое значение, bounded-error regression включён в `npm test`;
- local tool errors используют `Error:`-контракт;
- required tool arguments валидируются до handler;
- ordinary Qwen capability mode валидируется строго до мутаций сессии;
- durable owner authority не приводит object/number/array через `String(...)`;
- plain subagent dispatcher строго валидирует mode, owner prompt, task prompt/id и explicit sessionPrefix.

## Fresh Core RED — `requireToolCall` может завершиться пустым успехом на `data: true`
Fresh exact source до записи: product head `5e5cdf4a9253a087bfaad6d19edd0e71448070e9`, `src/chat-adapter.js` blob `63405b5d71057340ab2ae681c3e088271091e2e9`.

В `parseQwenSSE()` terminal frame обрабатывается раньше end-path:
- `if (obj === true || obj.data === true) return close();`
- проверка `requireToolCall && !toolCallDetected` и перевод ответа в `Qwen upstream closed without a usable response` выполняются только позже в `stream.on('end')`.

Следствие: continuation/OpenCode turn с `requireToolCall=true`, где Qwen прислал plain preamble или незавершённый `<tool_call>`, а затем явный `data: true`, может вызвать `onDone(null)` до того, как end-path сможет отвергнуть ответ. Для required-tool режима это пустой/неполный успешный completion вместо bounded retry/fail-closed.

Это отдельная граница от уже существующего `tool-stream-truncation-test.js`: тот доказывает orderly stream end без tool call, но не explicit terminal frame.

Authority-bound mutation record в issue #9: comment `5382573520`.

Добавлен только намеренно RED regression:
- commit `aab492abc9ce0dd71bdd58392ed2d653c3d0e490`;
- `scripts/tool-required-terminal-frame-test.js`;
- пока НЕ подключён в `npm test` и product code не менялся.

Regression требует:
1. plain text + `data: true` при `requireToolCall=true` -> error `closed without a usable response`, output не выпускается;
2. unterminated mutating tool block + `data: true` -> тот же fail-closed;
3. complete accepted `read_file` tool call + `data: true` -> success разрешён.

Hosted source-level reproduction текущей terminal decision подтверждает плохой порядок: `closed=True`, `error=None`, `requireToolCall=True`, `toolCallDetected=False`.

### Следующий Core fix
Нужна минимальная правка exact `src/chat-adapter.js` на свежем head: explicit terminal marker не имеет права вызывать success, если `requireToolCall=true` и полный tool call ещё не принят. Нельзя выпускать buffered preamble/partial XML. После фикса:
- выполнить новый regression;
- выполнить `tool-stream-truncation-test.js`;
- выполнить ближайший stream/session lifecycle cluster;
- только после green подключить новый regression в `npm test`.

Большой `chat-adapter.js` не заменять реконструированными байтами: запись только после fresh exact read и безопасного способа изменить точный файл.

## Core targeted status
Session/restart/owner cluster ранее выполнен на неизменённых Core blobs: owner authority, owner checkpoint, stale-backup/restart, tool-result-before-next-Qwen, multi-pending-tool restart — PASS. Fresh reliability commits не меняли `session-store.js`/agent/session Core.

Plain subagent dispatcher на свежих байтах после prompt/id/sessionPrefix fixes ранее имел targeted PASS.

Новый RED выше означает, что `QWEN_CORE_DONE` пока объявлять нельзя.

## Координация с QWEN_RELIABILITY
За этот запуск QWEN_RELIABILITY продвинула product head:
- `e21baa6...` — reject noncanonical durable account filenames;
- `af1bc26a...` — align mutation atomicity test with cooldown safety;
- `5e5cdf4a...` — fresh `account-store-noncanonical-filename-test.js` подключён в обычный `npm test`.

Core не трогал `src/account-store.js`/cooldown/provider-circuit. После `5e5cdf4a...` Core добавил только новый RED test и получил head `aab492ab...`.

Перед следующим product fix снова fresh-read Reliability handoff/head: Reliability может продолжить свою exact cluster работу.

## CircleCI final gate
Старый disposable gate на `ee1c596...` суперседирован и не является финальным доказательством.

Новый final gate НЕ запускать, пока:
1. новый Core RED не закрыт и не прогнан;
2. QWEN_RELIABILITY targeted cluster не подтверждён на общем stable SHA;
3. full exact-tree Linux `npm test` не прошёл на том же SHA.

После Linux PASS — один native Windows Server 2022 CircleCI final gate на том же exact product SHA по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, без provider/secrets/live traffic.

## Постоянная память / v4 CAS
Последний проверенный LATEST до этого запуска:
- LATEST blob `dfdc3261480360e5735398cef6bedddb16a917b6`;
- capsule `20260822T195727Z-4e872f4673`;
- archive SHA-256 `7bf98f451656d9db54a160f278d25b2eba3e9555a035b8f33c9da26d03ab3c5e`;
- manifest blob `f41520e631a2d733d18d833583a42d0960f77bd3`;
- part blobs `bfdca067dbaae54a25b084855c85b5c9bbd21a8d`, `b4ee3c0c9239839cd97158a94eedb424b189b546`.

В этом запуске LATEST был fresh-read и не перезаписывался. Причина: обязательный exact v4 materialization/upload/readback/CAS цикл не был безопасно завершён в текущей hosted filesystem; ручную реконструкцию частей/нормативного runtime не использовать. Поэтому force-write/pseudo-capsule не делались. Следующий запуск должен начать с этого проверенного LATEST и сделать нормативный v4 pack/readback/CAS после существенного product fix.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. Закрыть `tool-required-terminal-frame-test.js` минимальным exact `chat-adapter.js` fix.
3. Targeted: новый regression + truncation + stream/session lifecycle/restart cluster.
4. Если green — включить regression в `npm test`.
5. Сверить Reliability targeted status на том же свежем SHA.
6. Когда оба targeted cluster green и SHA стабилен — full exact-tree Linux `npm test`.
7. После Linux PASS — ровно один native Windows final gate на том же SHA.
8. Уже доказанные live/provider прогоны без новой причины не повторять.

В этом запуске live/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI не использовались.
