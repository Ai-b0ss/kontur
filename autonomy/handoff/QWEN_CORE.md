# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head: `a8144c851603e2a17397dac21f6fb316e7b07e0a`.
Перед новой записью снова перечитать fresh PR head и `autonomy/handoff/QWEN_RELIABILITY.md`: reliability-worker работает параллельно.

## Уже закрыто — не открывать заново без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6 и строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent и coding-subagents принимают owner prompt только как непустую строку без преобразования;
- мягкие ошибки локальных инструментов используют `Error:`-контракт;
- обязательные аргументы инструментов теперь валидируются перед handler.

## Required tool arguments — ЗАКРЫТО В PRODUCT
Ранее воспроизведённый дефект с missing `path/content/new` уже исправлен на текущей линии.

Доказательство fresh source:
- fix commit: `58274c71989b5eeba1041fcce1903c4595ac14fd` (`fix: enforce required tool arguments before handlers`);
- current `src/tool-executor.js` blob: `73cc969019a4e4c8190515929a20a799c617d319`;
- `validateRequiredToolArguments()` вызывается до `HANDLERS[name]`;
- missing/null required -> `Error:` без side effect;
- required string с неверным типом -> `Error:`;
- пустой/пробельный required `path` запрещён;
- явно переданные `content: ''` и `new: ''` остаются допустимыми;
- regression `scripts/tool-required-arguments-regression-test.js` blob `a49d1c9829a1e9ac3444dccf7c3aad6f176ae9d8`;
- current `package.json` blob `757a25b926d926b994b42b1b1eef3ba2c6ca622d` уже включает этот regression в обычный `npm test`.

Полный exact-tree `npm test` в этом проходе не выполнялся; весь PR зелёным не объявлять.

## QWEN_RELIABILITY coordination
Fresh reliability handoff подтверждает отдельную работу над pre-dispatch account availability/chat-create race. Узкую account/cooldown/failover механику не перехватывать.
Текущий общий head `a8144c851603e2a17397dac21f6fb316e7b07e0a` уже включает и Core required-args fix, и reliability regression wiring.

## CircleCI coordination
Старый final gate для более раннего SHA с пустой status surface не считать PASS/FAIL и не повторять.
Новый final gate разрешён только по `autonomy/ci/CIRCLECI_GATE_POLICY.md`: targeted local PASS -> fresh coordination с QWEN_RELIABILITY -> disposable `ci/qwen-final-gate` на один exact product SHA. На product-ветке CircleCI как цикл разработки не запускать.

## Следующий точный шаг
1. Fresh-read PR #6 + QWEN_RELIABILITY.
2. На ChatGPT hosted машине материализовать exact owner/session/subagent/restart cluster текущего head.
3. Локально прогнать минимум:
   - `tool-required-arguments-regression-test.js`;
   - `tool-command-failure-test.js`;
   - `agent-tool-error-recovery-test.js`;
   - owner/system-prompt tests;
   - ближайшие session/restart/pending-tool tests;
   - subagent owner/restart tests.
4. Если этот targeted cluster зелёный и текущий exact head стабилен, решить с QWEN_RELIABILITY, кто единственный триггерит final CircleCI gate для этого SHA.
5. Следующий Core-дефект брать только после воспроизведения.
6. Уже доказанные live/provider прогоны не повторять без новой причины.

## Постоянная память — этот проход
Вход:
- LATEST blob `d8088569437a936345f394f4a7bbca9b6787a075`;
- capsule `20260822T085753Z-94034ff6fa`;
- archive SHA-256 `4b783dfab48b676caa7713aedc3731a71fd432e52bcdbc64ef71f3b76cc78314`;
- exact runtime blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- v4 verify + restore: PASS.

Финиш:
- capsule `20260822T094914Z-2250bd0200`;
- archive SHA-256 `30691094bb941c839e1ab23780c0d4b7a14476494163acc3d9b0499d5431b088`;
- local pack + verify + restore: PASS;
- immutable readback blobs: part0 `ba4eacf484d7e4779907ce862994c0a77d8bce68`, part1 `0a907edfc2670762ffd50da05978da48ede374f0`, manifest `da8d15ea8f2320d7872f2034e49a3bd71900ea4e`;
- перед CAS LATEST всё ещё имел стартовый blob `d8088569437a936345f394f4a7bbca9b6787a075`;
- прежний LATEST сохранён как PREVIOUS;
- новый LATEST опубликован без force-write, blob `68b89ae010c52078f8b1c73eb6729e36faf580ef`.

GitHub Actions, новый CircleCI, live/provider traffic, аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
