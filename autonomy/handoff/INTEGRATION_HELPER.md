# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 08:40 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `e837a4f6b47a6c4c6674eb7752224e54ac9ecdc3`;
- Notion Agent PR #8: `60ea23501cda46a6244311174b1db4e27f596c2c`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — exact owner/session/tool-result/restart cluster и soft tool failures;
- Qwen Reliability — account/cooldown/failover/pre-dispatch availability;
- Notion Agent — exact pair materialization + durable tombstone recovery;
- Notion Core — native Windows/NCM28 + Stage-A/Stage-B durable Responses replay.

## Finding I — конфликтующие explicit session aliases в Qwen выбираются молча

Fresh exact source: Qwen `server.js` Git blob `554510ba721bf096c8ee807f76701c926e70e72e`.

`getOpenCodeSessionKey()` сейчас выбирает первый truthy alias по приоритету из header/body/metadata, а `hasExplicitSessionId()` отдельно проверяет truthiness. Согласованность одновременно переданных идентификаторов не проверяется.

Воспроизведённые случаи:
1. `x-opencode-session=session-A` + `body.session_id=session-B` -> текущий код молча выбирает `session-A` и считает identity explicit;
2. `x-opencode-session="   "` -> текущий код возвращает пустой `sessionKey=""`, а `hasExplicitSessionId()` всё равно возвращает true;
3. кандидатный strict resolver отклоняет конфликт/blank, но принимает эквивалентные нормализованные aliases вроде `" session-Z "` + `conversation_id="session-Z"`.

Offline verdict:
`QWEN_EXPLICIT_SESSION_ALIAS_CONFLICT_REPRODUCED_STRICT_CONTRACT_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_qwen_explicit_session_alias_probe.py`;
- `autonomy/evidence/integration/20260822T0838Z_qwen_explicit_session_alias_conflict.json`.

Required product contract:
- один strict resolver должен выполняться до session mutation, gate acquisition и provider work;
- каждый присутствующий alias обязан быть непустой строкой после нормализации;
- несколько aliases обязаны совпадать, иначе bounded HTTP 400;
- `getOpenCodeSessionKey` и `hasExplicitSessionId` должны использовать один результат, а не две независимые truthiness-схемы;
- account/thread affinity не выводить из resolver и существующие replay/serialization rules не ослаблять.

Интеграционная важность: будущий Notion→Qwen adapter может передавать provider-neutral conversation key в body, пока OpenCode/Codex/proxy одновременно добавляет session header. Сейчас protocol mismatch не обнаруживается и ребёнок может попасть в чужой durable Qwen namespace.

## Finding H — Core Stage-A и Agent materializer нельзя применять последовательно

Оба exact materializer требуют один preimage `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` и оба реально его меняют. Поэтому после применения одного второй обязан fail-closed по drift.

Artifacts:
- `autonomy/v3/tools/integration_notion_core_agent_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.

Required order: Core Stage-A V31 -> зафиксировать exact output blob -> перебазировать Agent transform на этот exact output -> финально доказать одновременно Core `require_persistence_ready()` и Agent reservation/prompt invariants. Preimage guards не ослаблять.

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

Policy прочитана fresh. Helper gate не триггерил. Старый Qwen gate `94f8ba55d75f076c58673bff3aabce7b8a756c54` не считать PASS без читаемого результата и не повторять. Владельцы сами выбирают новый exact gate SHA после targeted local PASS.

## Постоянная память

Start pointer этого прохода:
- `LATEST` blob `e39659e68f5c9adf4323bce9bff72e97c069948b`;
- capsule `20260822T073806Z-43ca8cae91`;
- archive SHA-256 `6d3a757bde002714f9e1d6b0e3a3dc1a9c9d6f590a72662f21879a795c2a9bbf`;
- manifest + part проверены, workspace восстановлен без реконструкции unknown bytes.

Finish нового v4 checkpoint: только полный pack/verify/upload/readback/CAS. При CAS conflict не force-write.

## Следующее

1. Qwen Core может забрать Finding I как strict preflight identity regression; Reliability-логику account/cooldown не менять.
2. Core/Agent владельцам сохранить Finding H как обязательный sync gate перед материализацией.
3. Agent/Core сохранить Finding G как rollback/install boundary до реального durable child launch.
4. На неизменных product bytes старые A-I probes не гонять повторно без нового контрпримера.
5. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
