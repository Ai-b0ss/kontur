# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 13:37 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `d4417a49b1d063a28819030c418f7644f7503a6b`;
- Notion Agent PR #8: `71749c86125fcc60b67fc477245150c7f5587813`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — durable owner/session authority и exact restart cluster;
- Qwen Reliability — legacy migration publish-before-persist и account/cooldown/failover;
- Notion Agent — exact pair materialization + durable tombstone/recovery;
- Notion Core — Stage-B durable Responses replay + V41/V42 + native Windows gate.

## Finding L — Core V41 failover opt-out теряется через Agent DynamicReservationLeaseSession

Fresh Agent `payload/reservation_aware_lease.py` blob `c77b4d5214911def1729243516aec73e43f8d425`.
Core V41 exact candidate blob `61001c95d38303c6be114f5543b2dc825225ead0`.

Core V41 вводит `AccountLease.run(..., allow_failover=False)`, чтобы после строгой публикации provider-intent неоднозначная transport-ошибка не могла переключить A→B и не могла неявно повторить provider-step. Но Agent `ReservationAwareLease` protocol и `DynamicReservationLeaseSession.run/run_selected` вообще не принимают и не пересылают `allow_failover`; вызов уходит в `lease.run(...)` с default `True`.

Это означает, что после будущей синхронизации Core+Agent защищённый post-intent planner-step, пропущенный через DynamicReservationLeaseSession, не сможет выразить Core V41 invariant и снова получит скрытый A→B failover.

Offline verdict:
`NOTION_V41_AGENT_DYNAMIC_SESSION_FAILOVER_OPT_OUT_GAP_REPRODUCED_CANDIDATE_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_notion_v41_agent_dynamic_session_failover_probe.py`;
- `autonomy/evidence/integration/20260822T1337Z_notion_v41_agent_dynamic_session_failover_optout_gap.json`.

Required product contract:
1. Расширить Agent lease protocol/session forwarding surface параметром `allow_failover`, default `True`, чтобы существующая Agent-ротация не изменилась.
2. Все deliberate Core planner steps после strict provider-intent должны передавать `allow_failover=False` через DynamicReservationLeaseSession до exact `AccountLease.run`.
3. Regression: protected transport даёт provider calls `[A]`, switch `0`; default Agent semantics по-прежнему могут дать `[A,B]`.
4. Отдельно проверить correction-step и отсутствие outer recursive retry; V42 уже показывает, что при корректной V41-проводке дополнительный server flag не нужен.
5. Не ослаблять exact materializer preimage guards: это часть будущего Core→Agent rebase, а не независимый product rewrite helper-а.

## Finding K — partial SSE output + transparent recovery расходятся с локальной историей Qwen agent

`consumeQwenStream()` может уже отдать caller-у text/reasoning, после чего CAPTCHA/dead-thread приводит к прозрачному retry на другом аккаунте. Тогда caller видит склейку A+B, а локальная история сохраняет только B. Required contract: прозрачный retry допустим только до первого внешне видимого delta; после видимого output — fail closed либо нужен поддерживаемый всеми callers reset/replace protocol.

Artifacts:
- `autonomy/v3/tools/integration_qwen_agent_partial_stream_recovery_probe.py`;
- `autonomy/evidence/integration/20260822T1036Z_qwen_agent_partial_stream_recovery_divergence.json`.

## Finding J — required-argument preflight даёт ложный `uncertain`

Fresh Core отклоняет missing/null required mutating-tool fields до handler side effect, но direct agent отмечает mutating tool до executor preflight. Contract: side-effect boundary ставить только после успешного local preflight; post-start mutating errors оставлять conservative uncertain.

Artifacts:
- `autonomy/v3/tools/integration_qwen_required_arg_uncertainty_probe.js`;
- `autonomy/evidence/integration/20260822T0935Z_qwen_required_arg_uncertainty_false_positive.json`.

## Finding I — конфликтующие explicit session aliases

Разные explicit session aliases в Qwen могут молча выбирать первый; пробельный alias может стать пустым ключом при `hasExplicitSessionId=true`. Нужна строгая канонизация: все явно присутствующие aliases непустые и совпадают после trim, иначе 400.

Artifacts:
- `autonomy/v3/tools/integration_qwen_explicit_session_alias_probe.py`;
- `autonomy/evidence/integration/20260822T0838Z_qwen_explicit_session_alias_conflict.json`.

## Finding H — Core Stage-A и Agent materializer нельзя применять последовательно как сейчас

Оба exact materializer требуют один preimage `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` и оба его меняют. Нужен порядок: Core safe-floor/output → Agent transform, перебазированный на exact Core output → combined Core+Agent regressions. Preimage guards не ослаблять.

Artifacts:
- `autonomy/v3/tools/integration_notion_core_agent_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.

## Finding G — durable Agent tombstone создаёт rollback floor

После появления `subagent-uncertain-tasks.json` откат на Core, который не понимает этот формат, может сделать unresolved side-effect state невидимым. Нужен minimum safe rollback floor и включение tombstone schema в install/upgrade/rollback closure.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_rollback_floor_probe.py`;
- `autonomy/evidence/integration/20260822T0632Z_notion_tombstone_rollback_floor_gap.json`.

## Prior open integration findings — не повторять без product change

- Notion tombstone multiwriter lost-update: `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`.
- Missing established tombstone on restart fails open: `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.
- Agent dependency graph not closed by Core installer manifest: `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`.
- Successful mutating child clears no-replay marker before durable child progress: `autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.
- Qwen/Notion owner whitespace-only prompt parity: `autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.
- Qwen tool-policy/thread affinity: `autonomy/evidence/integration/20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`.
- Qwen cooldown forward-clock-jump + restart gap: `autonomy/evidence/integration/20260822T1132Z_qwen_cooldown_restart_clock_jump_gap.json`.

Также уже исследованы и не повторяются на неизменных байтах: governor/failover ownership и size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## CircleCI

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан fresh. Helper ничего не триггерил. Сейчас Qwen head содержит намеренно RED reliability regression, Agent не прошёл полный exact-local materializer cluster, Core Stage-B ещё не exact-local green. Final gates helper-ом не запускать; недоступный результат не считать PASS.

## Постоянная память

На старте этого прохода нормативно восстановлен `LATEST`:
- LATEST blob `217d03e2cbd8dd232784c700a44696168e925b43`;
- capsule `20260822T113723Z-3cc6a997c5`;
- archive SHA-256 `9c426c89f57b4d428a0fe9671b628831d5d090ebce0274dca20c293b9734bd8e`;
- manifest blob `b8e7ca69840657161067dc1f4de2e31d4f6e4d47`;
- part blob `87d8eec8a69f7b759af05c718aa23bd6acc94566`;
- exact part length/SHA, archive length/SHA и оба workspace-file SHA проверены; restore PASS.

Новый checkpoint нужно публиковать только через v4 pack → immutable upload → readback → fresh CAS. Force-write запрещён.

## Следующее

1. Notion Core + Agent при синхронизации V41 обязаны забрать Finding L до combined Stage-B materialization: иначе Agent wrapper молча вернёт failover там, где Core намеренно его запретил.
2. Qwen Core может забрать Finding K/J как соседние regressions после текущего owner/session cluster; Reliability не трогать.
3. Finding H/G остаются обязательными Notion Core↔Agent sync gates до реальной materialization/rollback.
4. На неизменных product bytes старые probes не гонять без нового контрпримера.
5. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
