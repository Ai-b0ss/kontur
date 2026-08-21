# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE после fresh-head сверки 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий общий product head после текущего Core-прохода: `36dcf2424923de926e3e04848ae2e5dfa6402645`.
Перед следующей записью перечитать fresh `server.js`, `src/session-store.js` и head.

## Уже доказано — не исследовать заново
- tool-result continuation/restart и pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup history recovery fail-closed;
- message-based system prompt exact checkpoint и `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account.

## Explicit owner authority — fresh состояние
Официальный lossless path: `system_prompt_mode=owner` + `owner_system_prompt` / `ownerSystemPrompt`.
Detached private owner authority не входит в обычный transcript и должна храниться/восстанавливаться отдельно.

Fresh exact `server.js` + `src/session-store.js` на pre-write head `9d47ba96ce295d29fb41798bff5d56ef8776c1bd` уже содержали семантику полного V2→V5 bundle:
- durable `systemPromptMode` + exact `ownerSystemPrompt`;
- owner authority sticky между обычными ходами и restart;
- fallback `.bak` не наследует stale detached owner authority;
- invalid explicit mode fail-closed до restore/provider;
- project-only `Instructions from:` не повышается до private owner authority при recovery;
- explicit/current owner authority разрешена;
- owner checkpoint bound проверяется до provider.

То есть повторно накладывать V2→V5 на продукт НЕ надо.

### Что реально было недоведено и исправлено в этом проходе
На fresh head отсутствовал `scripts/server-explicit-owner-rehydrate-test.js`, хотя серверная семантика V2→V5 уже была в коде. Также три explicit-owner regressions не входили в обычный `npm test`.

Сделано:
1. Добавлен итоговый серверный regression `scripts/server-explicit-owner-rehydrate-test.js`, покрывающий V2→V5: restart owner, ordinary-turn sticky authority, project context preservation, engineer clear, invalid mode HTTP 400 и bounded payload, stale recovery block, project-only recovery block, current owner allow, oversized owner prompt без provider traffic. Commit `99b9aa6cc1dca7e899621df6320f1a4a38a34fe6`.
2. `package.json` теперь включает:
   - `session-explicit-owner-authority-test.js`
   - `session-explicit-owner-recovery-test.js`
   - `server-explicit-owner-rehydrate-test.js`
   в обычный `npm test`. Commit/head `36dcf2424923de926e3e04848ae2e5dfa6402645`.

Важно: full exact-tree `npm test` на head `36dcf242...` в этом проходе НЕ запускался и зелёным не объявляется. Hosted container не имеет сетевого доступа к private GitHub, а внешние CI по правилам не использовались.

## Следующий обязательный Core gate
1. Fresh-read PR head; не перетирать параллельные Reliability изменения.
2. Материализовать exact session/restart cluster на hosted машине через доступные exact GitHub bytes либо другой безопасный read-only путь.
3. Выполнить targeted:
   - `node scripts/session-explicit-owner-authority-test.js`
   - `node scripts/session-explicit-owner-recovery-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/server-system-checkpoint-rejected-test.js`
   - `node --check server.js`
   - `node --check src/session-store.js`
4. После targeted PASS прогнать максимально полный local session/restart cluster; только затем считать explicit-owner gate закрытым.
5. После зелёного Core offline gate переходить к финальным restart/recovery/failover/live E2E, не повторяя уже доказанные provider-прогоны без необходимости.

Обязательные markers итогового серверного regression:
- `restart_continue=1`
- `ordinary_turn_sticky=1`
- `project_context_preserved=1`
- `owner_flag_inherits=1`
- `current_authority_wins=1`
- `invalid_mode_fail_closed=1`
- `invalid_mode_http400=1`
- `invalid_mode_bounded=1`
- `recovery_stale_owner_blocked=1`
- `recovery_project_only_blocked=1`
- `recovery_current_owner_allowed=1`
- `oversized_provider_calls=0`.

## Постоянная память / capsule
В начале этого запуска прочитан текущий `autonomy/v3/workspaces/QWEN_CORE/LATEST.json`: capsule `20260821T220228Z-52165ac56c`, archive SHA-256 `6b78f650eda0d20e184dc048a4818036b2879181bea8d1f30609de78fa07502e`, Git blob SHA указателя `ee6b002aa75c6d081cab14757552228d3aff1e98`.
Manifest имеет schema `free_fabric_worker_capsule_v4`, 2 parts, source_ref `a0ec9110da9fefb32700e8996d63df53ee818df8`; обе части были перечитаны через GitHub.

Нормативный `capsule_runtime_v4.py` прочитан из GitHub, canonical Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Но доступный hosted filesystem не получил его exact bytes: ручная материализация дала другой Git blob SHA, поэтому по протоколу она НЕ использовалась для restore/pack. В этом проходе новую capsule и `LATEST/PREVIOUS` не публиковать/не подменять. Следующий запуск должен сначала восстановить exact runtime bytes безопасным способом; если это снова невозможно, использовать exact GitHub source как recovery floor и продолжать продуктовую работу без псевдо-v4.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production без отдельной необходимости не запускать.