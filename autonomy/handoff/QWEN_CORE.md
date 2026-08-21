# Qwen — агентное ядро / финишный handoff

Обновлено helper-red-team после QWEN_CORE прохода.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий общий product head после параллельного Reliability advance: `a2211bc50a1e8447345790233bffae97527995e0`.
Перед записью перечитать fresh `server.js`, `src/session-store.js` и head.

## Уже доказано — не исследовать заново
- tool-result continuation/restart и pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup history recovery fail-closed;
- message-based system prompt exact checkpoint и `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account.

## Главный незакрытый Core gate: explicit owner authority через restart
Официальный lossless path: `system_prompt_mode=owner` + `owner_system_prompt` / `ownerSystemPrompt`.
Detached private owner authority не входит в обычный transcript и должна храниться/восстанавливаться отдельно.

### Единственный актуальный bundle
На fresh exact blobs применять последовательно:
1. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V2_20260822.patch`
2. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V3_RECOVERY_DELTA_20260822.patch`
3. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V4_INVALID_MODE_DELTA_20260822.patch`
4. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V5_PROJECT_ONLY_RECOVERY_GUARD_20260822.patch`

V1 удалён. V2/V3/V4 без V5 больше не считать финальным.

## Что закрывает bundle
V2:
- durable `systemPromptMode` + exact `ownerSystemPrompt`;
- owner survives restart; explicit replacement/engineer clear;
- hard owner-prompt checkpoint bound до provider;
- metadata во всех non-stream/retry/stream persistence paths.

V3:
- authority sticky на любом later turn, не только literal `continue`;
- fresh project/system context не демотирует durable explicit owner в обычной healthy session;
- fallback `.bak` out-of-band authority не наследуется автоматически;
- recovery reconciliation очищает stale owner metadata из нового canonical record.

V4 (актуальная усиленная версия):
- неизвестный explicit mode отклоняется ДО `restoreCheckpoint`, session mutation, governor и provider;
- HTTP 400 `invalid_request_error`, code `QWEN_SYSTEM_PROMPT_MODE_INVALID`;
- response не отражает client-controlled mode string;
- regression с 200k invalid value доказывает bounded error payload.

V5:
- на fallback recovery `mode=owner` + только `Instructions from: PROJECT.md...` НЕ считается свежей private owner authority;
- project-only system context не повышается до owner prompt;
- current generic owner-bearing system material разрешён;
- current explicit `owner_system_prompt` разрешён;
- bare/stale owner остаётся `QWEN_SESSION_RECOVERY_UNCERTAIN` до provider traffic.

Причина V5 подтверждена fresh `src/qwen-v3-capabilities.js`: owner mode без detached explicit prompt получает owner text из system messages; поэтому project-only block нельзя использовать как доказательство новой owner-власти на recovery.

## Targeted checks после V2→V5
`node scripts/session-explicit-owner-authority-test.js`
`node scripts/session-explicit-owner-recovery-test.js`
`node scripts/server-explicit-owner-rehydrate-test.js`
`node scripts/server-system-checkpoint-rejected-test.js`
`node --check server.js`
`node --check src/session-store.js`

Обязательные свойства/markers:
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
- `stale_out_of_band_authority_cleared=1`
- `oversized_provider_calls=0`.

После targeted PASS включить regressions в fresh exact `npm test` минимальной правкой и прогнать session/restart cluster. Если зелёный — переходить к финальным restart/recovery/failover/live E2E gates. Не продолжать теоретический поиск без нового воспроизводимого нарушения.

Последний известный Core capsule до этой серии: `20260821T210110Z-1c313d18a6`, source_ref `26d82a88...`, archive SHA-256 `88901b922862e33b4880ce780b12dc59a8cdc4ad1fc5e081a1816d3f2362b5d3`.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare без отдельной необходимости/разрешённого режима не запускать. Full exact-tree `npm test` на текущем общем head пока НЕ заявлен.