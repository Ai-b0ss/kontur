# Qwen — агентное ядро / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:20+03.

## Текущая линия

Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний наблюдавшийся общий PR head: `a0ec9110da9fefb32700e8996d63df53ee818df8`.

Перед любой записью перечитать fresh blobs/head: параллельно пишет QWEN_RELIABILITY.

## Уже доказано — не исследовать заново

Durable session/tool progress:
- tool result переживает restart;
- pending tool call блокирует continuation;
- streaming tool call durably записывается до выпуска клиенту;
- assistant text и system/project instructions переживают restart/recovery;
- duplicate tool_call.id не схлопывает несколько pending calls;
- одна OpenCode session сериализуется;
- stale-backup recovery fail-closed.

Message-based system prompt:
- `role=system` больше не режется обычным 12k лимитом;
- несколько system blocks сохраняются точно и по порядку;
- невозможность exact checkpoint => `QWEN_SYSTEM_CHECKPOINT_REJECTED`.
Ключевые коммиты: `616eb0e...`, `62f7c86...`, `db0ef415...`.

Non-stream system-checkpoint contract:
- стабильный `error.code=QWEN_SYSTEM_CHECKPOINT_REJECTED`, HTTP 500;
- локальная checkpoint ошибка не штрафует здоровый Qwen account.
Ключевые коммиты: `5fc6092...`, `48b6c0e...`, `4116149...`, `151bdcb...`, `26d82a8...`.

## Главный незакрытый Core gate: explicit owner authority

Официальный lossless path поддерживает:
`system_prompt_mode=owner` + `owner_system_prompt` / `ownerSystemPrompt`.

Detached private owner text не входит в обычные `messages`, поэтому текущая session durability его отдельно не защищает.

Red-team V2 выявил ещё два класса:
1. authority должна быть sticky на **любом следующем ходе сессии**, не только literal `continue`;
2. fallback `.bak` может содержать stale out-of-band owner metadata, которую transcript-reconciliation сама подтвердить не способна.

## Единственный актуальный bundle

На свежие exact blobs применить последовательно:

1. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V2_20260822.patch`
2. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V3_RECOVERY_DELTA_20260822.patch`

Канонический pointer:
`autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABLE_SESSION_SPEC_20260821.md`

V1 удалён. V2 без V3 больше НЕ считать финальным.
`QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` отдельно не накладывать после V2: V2 уже содержит pre-provider message checkpoint gate.

### Целевой контракт V2+V3

- durable record хранит `systemPromptMode` + exact `ownerSystemPrompt`;
- owner authority наследуется на любом later turn той же session, а не только на magic continuation word;
- свежие project/system blocks (`Instructions from:` и т.п.) остаются свежим контекстом и не демотируют durable explicit owner;
- explicit `owner` без повторной передачи detached текста наследует durable exact owner;
- новый explicit owner field побеждает старый;
- explicit `engineer` — deliberate transition: старый owner не воскресает и очищается при durable commit;
- oversized explicit owner => `QWEN_SYSTEM_CHECKPOINT_REJECTED` до request governor/Qwen I/O;
- prompt metadata одинаково идёт через primary/retry non-stream и все streaming persistence paths;
- fallback-backup record с prompt metadata требует current explicit authority **до** очистки recovery marker;
- bare stale `mode=owner` без нового owner/system материала не resurrect-ит backup prompt;
- transcript reconciliation удаляет stale `systemPromptMode`/`ownerSystemPrompt` из нового canonical record; current authority записывается только из текущего запроса после accepted response.

## Targeted checks после V2+V3

`node scripts/session-explicit-owner-authority-test.js`
`node scripts/session-explicit-owner-recovery-test.js`
`node scripts/server-explicit-owner-rehydrate-test.js`
`node scripts/server-system-checkpoint-rejected-test.js`
`node --check server.js`
`node --check src/session-store.js`

Ожидаемые свойства:
- `restart_continue=1`
- `ordinary_turn_sticky=1`
- `project_context_preserved=1`
- `owner_flag_inherits=1`
- `current_authority_wins=1`
- `recovery_stale_owner_blocked=1`
- `stale_out_of_band_authority_cleared=1`
- `oversized_provider_calls=0`.

После targeted PASS подключить новые tests в fresh exact `npm test` минимальной правкой и прогнать session/restart cluster: existing owner/system/recovery/session/tool-result tests + три explicit-owner regressions.

## Постоянная память

Последняя нормативная Core capsule до helper-прохода:
- `20260821T210110Z-1c313d18a6`;
- source_ref `26d82a88ecaa18733d590c50b2a130480273be97`;
- archive SHA-256 `88901b922862e33b4880ce780b12dc59a8cdc4ad1fc5e081a1816d3f2362b5d3`.
Она была verify/restore PASS; это recovery checkpoint, не текущий product head.

## После explicit-owner gate

1. Прогнать exact session/restart cluster и полный `npm test`, если private tree материализуем.
2. Не тратить циклы на comment-only косметику.
3. Если suite green — перейти к финальным restart/recovery/failover/live E2E gates.
4. Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare не запускать без отдельной необходимости/разрешённого режима.

Full exact-tree `npm test` на текущем общем head пока НЕ заявлен; hosted/source-shaped semantics не равны финальному E2E.