# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний проверенный общий PR head после Core-работы: `6d5105925db5d08ba179570d63aad27be17efa56`.
Перед новой записью снова перечитать fresh PR head и `autonomy/handoff/QWEN_RELIABILITY.md`: параллельно работает reliability-worker.

## Уже закрыто — не исследовать заново без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, exact owner checkpoint, malformed/conflicting detached owner aliases rejected before session/provider I/O;
- direct agent и coding-subagents принимают owner prompt только как непустую строку без преобразования объекта/массива/числа;
- общий detached-owner helper отклоняет пустой/пробельный private prompt;
- канонический `qwen-v3-capabilities.resolveSystemPromptMode()` строго проверяет body/header aliases, конфликт, пустые/нестроковые значения и bounded error;
- server preflight теперь использует тот же strict resolver **до** любой session/memo mutation и provider work.

## Новый закрытый дефект — prompt-mode validation больше не происходит после mutation
На старом exact `server.js` blob `12369bc5aca9206ba7daabd8521e7cf642b03c88` локальный `explicitPromptMode()` был мягче канонического resolver: пустой explicit mode мог считаться отсутствующим, а конфликт body aliases разрешался молча. При этом этот preflight стоял перед `sessionStore.clear()` / `toolMemo.clear()`, поэтому malformed request мог успеть изменить локальное состояние и лишь позже быть отвергнут strict resolver.

Исправление:
- `feeff6cf61ff577b8808f88668536dcb0aff8fa6` — `server.js` делегирует явный mode каноническому `qwenV3Capabilities.resolveSystemPromptMode()`. Если mode не задан вообще, остаётся `null`, чтобы не ломать наследование durable owner/engineer authority. Diff проверен: изменён только `explicitPromptMode()`.
- Перед fast-forward PR уже был продвинут QWEN_RELIABILITY до `b49bec79def089680941ef4bd29cc2ded1198b69`; его account-store изменения сохранены, Core commit перебазирован на exact fresh tree и записан non-force.

Постоянная серверная регрессия:
- `333019e5fea6c6c2d5a03402af4443f345a5f567` — `scripts/server-system-prompt-preflight-test.js`;
- она проверяет blank/malformed/conflicting body/header mode, отсутствие mode, body precedence и порядок preflight перед `sessionStore.clear`, `toolMemo.clear` и первым provider call;
- `6d5105925db5d08ba179570d63aad27be17efa56` — тест включён в обычный `npm test`.

Targeted hosted evidence без provider/внешнего CI:
- предыдущий exact candidate: `QWEN_SYSTEM_PROMPT_MODE_ALIAS_VALIDATION_PASS ... server_preflight_no_mutation=4`;
- этот проход: `QWEN_SYSTEM_PROMPT_MODE_ALIAS_TARGET_PASS empty_fail_closed=2 conflict_fail_closed=2 malformed_fail_closed=1 body_precedence=1 equivalent_aliases=1 bounded_error=1`.

Полный exact-tree `npm test` **не выполнялся**; весь PR зелёным по targeted PASS не объявлять. CircleCI/GitHub Actions/provider traffic не использовались.

## Следующий точный шаг
1. Fresh-read PR #6 head и reliability handoff.
2. На ChatGPT hosted машине материализовать максимально полный exact owner/session/subagent cluster и выполнить минимум:
   - `node scripts/owner-system-prompt-test.js`
   - `node scripts/system-prompt-mode-alias-validation-test.js`
   - `node scripts/server-system-prompt-preflight-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/agent-system-prompt-mode-test.js`
   - `node scripts/subagent-owner-prompt-validation-test.js`
   - ближайшие restart/session tests.
3. Если кластер зелёный — искать следующий воспроизводимый Core-дефект в restart/tool-result/OpenCode/subagents/skills/errors. Узкую механику account/cooldown/failover не забирать у QWEN_RELIABILITY.
4. CircleCI final gate — только по `autonomy/ci/CIRCLECI_GATE_POLICY.md`, на disposable `ci/qwen-final-gate`, только для exact выбранного product SHA после targeted local PASS и после проверки, что QWEN_RELIABILITY не триггерит тот же SHA.
5. Уже доказанные live/provider прогоны не повторять без новой причины.

## Постоянная память
Вход этого прохода:
- LATEST blob `b14aa05cc5cf51c6f0d19ed1a7e4fd1288014415`;
- capsule `20260822T045700Z-997fae7907`;
- archive SHA-256 `e3ecfa89d47ff888fd13a3fb2ec116391598f2cfaff507aebde89826fd644231`;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- uploaded start manifest/parts reread; local Git blob совпал: manifest `9e9e255d...`, parts `52faca66...` / `a3c55b1d...`;
- normative v4 verify + restore: PASS.

Финиш:
- новая v4 capsule `20260822T070200Z-97f3d23c68`;
- archive SHA-256 `ea0527b883bef9155002a3a36d83861f34cf36e6c5ea8e0738876af4a2a2d177`;
- local pack + v4 verify: PASS;
- immutable upload/readback blobs совпали с локальными: part0 `8d74e8b9a33ab0739ffd58c8e8482afc156c418e`, part1 `834cd5209096b2fba214ddecfa3bcfc692c1fca6`, manifest `a4f5d5999991df6d77a5cc8454033ed9004281b8`;
- перед публикацией LATEST всё ещё имел исходный blob `b14aa05c...`, поэтому CAS разрешён;
- прежний LATEST сохранён как PREVIOUS;
- новый LATEST опубликован без force-write, blob `d92728084ff6591f5c273930819bcf68c6a8a18b`.
