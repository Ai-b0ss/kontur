# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `53a49d0682d47c201c2915b6bb454bd4dd6db229`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

## Что уже закрыто — без нового контрпримера не открывать заново
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
- локальные ошибки инструментов имеют `Error:`-контракт;
- обязательные аргументы инструментов проверяются до handler;
- ordinary Qwen capability mode валидируется строго и до мутаций сессии;
- durable owner authority не приводит object/number/array через `String(...)`;
- internal prompt mode различает отсутствие поля и явно переданное некорректное значение;
- bounded internal-mode error regression включён в обычный `npm test`.

## Новый закрытый дефект — plain subagent dispatcher обходил строгий owner/engineer контракт
`src/subagent-dispatcher.js` оставался старым обходным путём: `String(options.mode || 'engineer')` превращал явно переданные `''`, `null`, `false` в `engineer`, а `ownerSystemPrompt` приводился через `String(...)`. Поэтому plain model-only subagents могли молча понизить явно испорченный owner-mode до engineer или превратить объект в `[object Object]`, хотя direct agent и coding-subagents уже fail-closed.

Исправлено:
- `2ae8eba92dbea20246b6e6a552288d2743e3d8af` — добавлен `resolveDispatchPromptMode()`: отсутствие поля по-прежнему означает `engineer`, но явно переданное пустое/нестроковое/неизвестное значение даёт `QWEN_SUBAGENT_MODE_INVALID`; owner-mode требует непустую строку `ownerSystemPrompt` и передаёт её без `String(...)`/trim;
- `53a49d0682d47c201c2915b6bb454bd4dd6db229` — существующий `scripts/subagent-dispatcher-test.js` расширен: 6 плохих mode, 5 плохих owner prompts, provider calls=0, нормальный owner prompt проверяется побайтно.

Hosted targeted semantic PASS без provider traffic:
`QWEN_PLAIN_SUBAGENT_PROMPT_VALIDATION_PASS invalid_modes=6 invalid_owner_prompts=5 omitted_default=1 exact_owner=1 provider_calls=0`.

`subagent-dispatcher-test.js` уже входит в обычный `npm test`, отдельный package wiring не нужен.

## QWEN_RELIABILITY coordination / CircleCI
На входе fresh QWEN_RELIABILITY head был `b4541d111c0e57d1352cbbbe80e72eff292dd7ef`; его изменения после предыдущего Core-head затрагивали только provider-circuit/package wiring. Core session/owner/restart файлы до этой работы не менялись.

Fresh package на `b4541d11...` всё ещё НЕ включает `provider-circuit-missing-state-retrip-restart-test.js`, хотя reliability handoff просит проверить это wiring. Это зона QWEN_RELIABILITY; QWEN_CORE не перехватывал её.

CircleCI final gate пока НЕ запускать:
- полный exact-tree local `npm test` на fresh product head ещё не выполнен;
- policy требует стабильного exact product SHA и одного владельца gate;
- QWEN_RELIABILITY ещё имеет собственный незакрытый wiring check.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Fresh `LATEST` на входе:
- blob `739343bc230b6944020376db82ddf6cfc0d3c977`;
- capsule `20260822T154952Z-adead69f65`;
- archive SHA-256 `8c12eeb8bc3eb346628542fc4e19777a37fc2a662bf13ab123a2e4e7334d8e1f`;
- manifest schema v4, 2 parts; manifest и обе части перечитаны.

Попытка нормативного local restore остановилась на `part length mismatch part-0000.b64`: ручной перенос connector response в локальную FS не сохранил exact bytes. Дополнительно локально набранная копия `capsule_runtime_v4.py` не совпала с каноническим Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. По протоколу никакой ручной repair/pseudo-v4 не делался, `LATEST/PREVIOUS` не менялись и force-write не использовался. Durable product state закреплён exact commits + этим handoff; следующему запуску снова начинать с LATEST/PREVIOUS exact fetch.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. На hosted машине материализовать exact owner/session/subagent/restart cluster текущего head и прогнать минимум:
   - `subagent-dispatcher-test.js`;
   - `internal-system-prompt-mode-bounded-error-test.js`;
   - `internal-system-prompt-mode-explicit-test.js`;
   - `agent-system-prompt-mode-test.js`;
   - `subagent-owner-prompt-validation-test.js`;
   - ближайшие session/restart regressions.
3. Не заходить в узкий account/cooldown/provider-circuit wiring QWEN_RELIABILITY.
4. Если cluster PASS и общий product SHA стабилен, согласовать одного владельца SHA с QWEN_RELIABILITY.
5. Только тогда один финальный CircleCI gate через disposable `ci/qwen-final-gate` по `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
6. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
