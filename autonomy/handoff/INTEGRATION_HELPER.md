# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 09:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `a8144c851603e2a17397dac21f6fb316e7b07e0a`;
- Notion Agent PR #8: `8c46616f6c4d038fc3b578a0e516aa7fb832a0a1`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — required tool arguments + owner/session/restart cluster;
- Qwen Reliability — account/cooldown/failover/pre-dispatch availability;
- Notion Agent — exact pair materialization + durable tombstone recovery;
- Notion Core — native Windows/NCM28 + Stage-A/Stage-B durable Responses replay.

## Finding J — required-argument preflight даёт ложный `uncertain` в coding-subagent

Fresh Qwen Core уже внёс `validateRequiredToolArguments()` в `src/tool-executor.js`: missing/null required-поля для mutating tools теперь отклоняются до handler side effect. Это правильный Core-фикс.

Но свежий `src/agent.js` всё ещё делает `emit({type:'tool', name, args})` **до** `executeTool()`. Для синтаксически валидного JSON с отсутствующим required-полем событие не помечается `invalidArguments`, потому что JSON корректен. `src/subagent-side-effect-state.js` считает любой enabled mutating tool-event границей возможного side effect и ставит `mayHaveSideEffects=true`.

Точный пример:
- модель выдаёт `write_file {"path":"demo.txt"}` без `content`;
- executor preflight возвращает `Error: missing required argument: content` до `fs.writeFileSync`;
- фактического изменения файла нет;
- execution-state уже `mayHaveSideEffects=true`;
- если затем задача остановится по round limit/provider error, coding-subagent может сохранить её как `uncertain` и заблокировать безопасный автоматический повтор.

Offline verdict:
`QWEN_REQUIRED_ARG_FALSE_UNCERTAINTY_REPRODUCED_CANDIDATE_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_qwen_required_arg_uncertainty_probe.js`;
- `autonomy/evidence/integration/20260822T0935Z_qwen_required_arg_uncertainty_false_positive.json`.

Required product contract:
1. required-argument preflight должен происходить до фиксации side-effect boundary, либо executor должен возвращать/эмитить явный `preflightRejected`;
2. `mayHaveSideEffects=true` только после того, как mutating handler действительно допущен к старту;
3. после фактического старта `bash/write/edit/append` консервативную uncertainty не ослаблять;
4. regression должен отдельно доказать missing required mutating arg -> 0 side effect -> later round-limit remains retryable, и valid mutating call -> later ambiguous failure remains uncertain.

Это стык свежего QWEN_CORE required-argument fix с coding-subagent replay safety; account/cooldown/failover механику QWEN_RELIABILITY не менять.

## Finding I — конфликтующие explicit session aliases в Qwen выбираются молча

Fresh exact source на момент finding: Qwen `server.js` Git blob `554510ba721bf096c8ee807f76701c926e70e72e`.

`getOpenCodeSessionKey()` выбирал первый truthy alias по приоритету из header/body/metadata, а `hasExplicitSessionId()` отдельно проверял truthiness. Согласованность одновременно переданных идентификаторов не проверялась.

Воспроизведённые случаи:
1. `x-opencode-session=session-A` + `body.session_id=session-B` -> молча выбирается `session-A`;
2. `x-opencode-session="   "` -> пустой `sessionKey`, но identity считается explicit;
3. strict resolver отклоняет conflict/blank и принимает эквивалентные нормализованные aliases.

Artifacts:
- `autonomy/v3/tools/integration_qwen_explicit_session_alias_probe.py`;
- `autonomy/evidence/integration/20260822T0838Z_qwen_explicit_session_alias_conflict.json`.

## Finding H — Core Stage-A и Agent materializer нельзя применять последовательно

Оба exact materializer требуют один preimage `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` и оба реально его меняют. После применения одного второй обязан fail-closed по drift.

Artifacts:
- `autonomy/v3/tools/integration_notion_core_agent_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.

Required order: Core Stage-A V31 -> exact output blob -> Agent transform, перебазированный на этот exact output -> финальная совместная проверка Core `require_persistence_ready()` + Agent reservation/prompt invariants. Preimage guards не ослаблять.

## Finding G — durable Agent tombstone создаёт rollback floor

Rollback с tombstone-aware Agent на старый Core может оставить unresolved `subagent-uncertain-tasks.json` на диске, но сделать его невидимым работающему bridge. Нужен minimum safe Agent rollback floor и включение tombstone schema в install/upgrade/rollback closure.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_rollback_floor_probe.py`;
- `autonomy/evidence/integration/20260822T0632Z_notion_tombstone_rollback_floor_gap.json`.

## Prior open integration findings — не повторять без product change

A. Notion tombstone multiwriter lost-update:
`autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`.

B. Missing established tombstone on restart fails open:
`autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

C. Agent dependency graph is not closed by Core installer payload manifest:
`autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`.

D. Successful mutating child clears no-replay marker before durable child progress exists:
`autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.

E. Qwen/Notion owner whitespace-only prompt parity:
`autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.

F. Qwen tool-policy/thread affinity gap:
`autonomy/evidence/integration/20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`.

Также уже исследованы и не повторяются на неизменных байтах: Qwen governor/failover ownership; governor size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## CircleCI review

Policy прочитана fresh. Helper gate не триггерил. Старый Qwen gate без читаемого результата не считать PASS и не повторять. Владельцы сами выбирают новый exact gate SHA после targeted local PASS.

## Постоянная память

Start pointer этого прохода:
- `LATEST` blob `4eff1f4c9d8314c3b775a6b82520823d9e0afa4b`;
- capsule `20260822T084232Z-4922589ba1`;
- archive SHA-256 `ad633cb09e205e84686b2470b4136b43871936f99d531ecc99ca23bd1c5f76bb`;
- manifest + part проверены; workspace восстановлен без реконструкции unknown bytes: `RESTORE_PASS`.

Finish нового v4 checkpoint: только полный pack/verify/upload/readback/CAS. При CAS conflict не force-write.

## Следующее

1. Qwen Core после своего required-argument fix должен забрать Finding J как cross-regression: preflight-rejected mutating call не должен отравлять retry safety.
2. Qwen Core может забрать Finding I как strict preflight identity regression, если fresh product bytes всё ещё воспроизводят его.
3. Core/Agent владельцам сохранить Finding H как обязательный sync gate перед материализацией.
4. Agent/Core сохранить Finding G как rollback/install boundary до реального durable child launch.
5. На неизменных product bytes старые probes не гонять повторно без нового контрпримера.
6. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
