# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после Core-прохода: `31155ebd920afde8ea0dce2e3ede7c1a9200f740`.
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
- обязательные аргументы инструментов валидируются перед handler.

## Новый воспроизведённый Core-gap — обычный Qwen capability mode остаётся неоднозначным
`src/qwen-v3-mode.js` всё ещё использует мягкую цепочку `body.qwen_mode || body.qwenMode || options...` и `normalizeMode()` возвращает `null` для неизвестного значения.

Из-за этого:
- явно переданный неизвестный `qwen_mode` молча превращается в Auto/runtime/reasoning fallback;
- пустой snake-case alias может быть замаскирован camel-case alias;
- конфликт `qwen_mode=fast` + `qwenMode=thinking` молча выбирает первый;
- аналогичная неоднозначность есть у options aliases и reasoning-effort aliases.

Hosted-воспроизведение:
`QWEN_CAPABILITY_MODE_AMBIGUITY_REPRODUCED invalid_explicit_masked=1 empty_alias_masked=1 conflicting_alias_silently_preferred=1`.

Добавлен отдельный RED regression, пока намеренно НЕ включён в `npm test`:
- `scripts/qwen-mode-alias-validation-test.js`;
- commit `9668ec2e8b2c97a4db2a78cc863d5f73bfdd0df7`;
- blob `1248702c217624f83c67a47fdaa1782e2fda8abc`.

Был подготовлен строгий `qwen-v3-mode.js` и exact targeted test дал:
`QWEN_MODE_ALIAS_VALIDATION_PASS empty_fail_closed=2 conflict_fail_closed=2 malformed_fail_closed=2 explicit_precedence=1 equivalent_aliases=1 bounded_error=1`.
Но продуктовый кандидат был полностью откатан commit `31155ebd920afde8ea0dce2e3ede7c1a9200f740`, потому что дополнительный self-review показал важный порядок: сервер сейчас вызывает capability `resolveMode()` только внутри `preparePublicPayloadGoverned()`, уже после возможных `sessionStore.clear/toolMemo.clear`. Если просто сделать `resolveMode()` строгим, плохой запрос начнёт падать слишком поздно и наружу уйдёт generic 500.

То есть финальный ремонт должен быть атомарным:
1. строгая presence-aware alias validation в `qwen-v3-mode.js`;
2. ранний preflight этого режима в `server.js` рядом с уже существующими `explicitPromptMode()` / `explicitOwnerSystemPrompt()` — до session mutation/recovery/provider;
3. внешний HTTP 400 `invalid_request_error` со стабильным ограниченным кодом `QWEN_MODE_INVALID`;
4. server regression: invalid/blank/conflicting aliases -> 400, session clears=0, memo clears=0, provider calls=0;
5. только после targeted PASS включить оба теста в `npm test`.

Не считать RED regression продуктовым ухудшением: он не подключён к обычному набору, а `src/qwen-v3-mode.js` после отката снова exact blob `8c4722120a0472e4e0343d679690c6b56c012dee`.

## Targeted checks этого прохода
- входная QWEN_CORE capsule `20260822T094914Z-2250bd0200` восстановлена из GitHub parts; archive SHA-256 `30691094bb941c839e1ab23780c0d4b7a14476494163acc3d9b0499d5431b088` совпал;
- exact owner helper/test blobs `b1e99adb...` / `d8b115dc...` материализованы и прошли `OWNER_SYSTEM_PROMPT_VALIDATION_PASS ...`;
- строгий Qwen-mode кандидат + RED regression локально прошли targeted check до отката кандидата.

Полный exact-tree `npm test` не выполнялся; весь PR зелёным не объявлять.

## QWEN_RELIABILITY coordination
Fresh reliability handoff прочитан. Reliability сейчас владеет отдельным воспроизведённым `account-local cooldown vs wall-clock jump` gap и уже добавил свой RED regression на product head `454e25eb...`. Узкую account/cooldown/failover механику не перехватывать.

Из-за двух открытых RED-gap (Core mode preflight + Reliability monotonic cooldown) final CircleCI gate сейчас преждевременен. QWEN_CORE его в этом проходе не триггерил.

## Следующий точный шаг
1. Fresh-read PR #6 + QWEN_RELIABILITY.
2. Закрыть Qwen capability mode атомарно: strict `qwen-v3-mode` + server preflight + HTTP 400 + no-mutation/provider regression.
3. Hosted targeted PASS; затем включить regression в `npm test`.
4. После этого вернуться к exact owner/session/subagent/restart cluster и прогнать минимум tool-required/tool-command/agent-tool-error + owner/system + session/restart/pending-tool + subagent owner/restart.
5. Только когда Core и Reliability targeted-гейты зелёные и exact product SHA стабилен, согласовать единственного владельца disposable `ci/qwen-final-gate`.
6. Live/provider прогоны не повторять без новой причины.

## Постоянная память
Стартовый GitHub pointer этого прохода:
- LATEST blob `68b89ae010c52078f8b1c73eb6729e36faf580ef`;
- capsule `20260822T094914Z-2250bd0200`;
- archive SHA-256 `30691094bb941c839e1ab23780c0d4b7a14476494163acc3d9b0499d5431b088`;
- manifest blob `da8d15ea8f2320d7872f2034e49a3bd71900ea4e`;
- part blobs `ba4eacf484d7e4779907ce862994c0a77d8bce68` / `0a907edfc2670762ffd50da05978da48ede374f0`;
- v4 archive/workspace restore: PASS.

Новый LATEST в этом проходе намеренно не публиковался: нормативный runtime был прочитан из GitHub, но локальная ручная материализация runtime не совпала с каноническим blob `6557f906...`. Не подменять обязательный exact v4 pack/verify/CAS псевдо-checkpoint. Полезное состояние сохранено product RED-test commit + этим handoff; следующему проходу сначала снова восстановить текущий LATEST и материализовать exact runtime побайтно.

GitHub Actions, CircleCI, live/provider traffic, аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
