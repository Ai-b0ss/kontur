# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 15:45 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `7d22a71ee9a60df81a64a71d896f7eab2d3854d1`;
- Notion Agent PR #8: `eaa7e812cb502649fb5291143070b33bfc94380e`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — owner/session/restart exact cluster;
- Qwen Reliability — account-store/cooldown/failover;
- Notion Agent — exact pair materialization + tombstone/recovery;
- Notion Core — Stage-B durable Responses replay + V41/V42/V43/V44 + native Windows gate.

## Finding N — Agent может сменить аккаунт между первым provider step и planner correction

Fresh Agent `payload/reservation_aware_lease.py` blob `c77b4d5214911def1729243516aec73e43f8d425` держит один `DynamicReservationLeaseSession` через initial round и correction rounds. Перед каждым provider attempt `_run()` снова читает foreground reservations. Если текущий аккаунт стал зарезервирован, `_LeaseAccountBecameReserved` приводит к `_reselect()`, а при `retry_operation` correction идёт fresh/recovery путём на новом аккаунте.

До первого provider entry такая reselection уже признана допустимой в Finding L / `20260822T1518Z_agent_core_failover_composition_gap.md`.

Новый конфликт возникает позже:
- Core V37 требует route/account до strict provider intent;
- Core V42 требует deliberate planner correction на том же lease/account и `allow_failover=false`;
- Agent после успешного первого вызова A всё ещё может увидеть новую foreign reservation(A) и перед correction перейти A→B.

Offline probe:
`autonomy/v3/tools/integration_notion_postfirst_provider_reservation_reselect_probe.py`

Verdict:
`NOTION_POSTFIRST_PROVIDER_RESERVATION_RESELECT_REPRODUCED_CANDIDATE_PASS`.

Текущая модель: first=A → после него reservation(A) → correction=B → provider accounts `[A, B]`.

Безопасный контракт:
- сохранить reselection до первого provider entry;
- после первого provider step зафиксировать выбранный account для deliberate correction steps того же durable intent;
- foreign reservation после provider entry => fail closed до следующего provider I/O, unresolved intent сохранить, correction на B не запускать;
- `allow_failover=false` всё равно должен дойти до `AccountLease.run`, но одного transport-флага недостаточно: reservation reselection происходит уровнем выше.

Evidence:
`autonomy/evidence/integration/20260822T1535Z_notion_postfirst_provider_reservation_reselect_gap.json`.

Required composed regression:
1. pre-first-provider reservation A→B остаётся разрешённой;
2. first=A success → reservation(A) → correction не делает provider call B;
3. unresolved intent сохраняется;
4. ordinary Agent behavior вне protected durable-intent sequence не теряет rotation.

## Finding M — Core V41 и Agent account_pool materializer конфликтуют по exact preimage

Agent `tools/apply_account_pool_dynamic_reservation.py` требует старый `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` и старую сигнатуру `AccountLease.run` без `allow_failover`. Core V41 меняет тот же метод. После V41 старый Agent transform неприменим; guards ослаблять нельзя.

Required order: Core V41 postimage становится safety floor → Agent transform перебазируется на точные V41 bytes → combined tests сохраняют default Agent A→B и protected ambiguous transport only A/switch=0.

Artifacts:
- `autonomy/v3/tools/integration_notion_v41_agent_account_pool_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T1436Z_notion_v41_agent_account_pool_materializer_order_conflict.json`.

## Ранее открытые обязательные стыки — не повторять без изменения product bytes

- Finding L: V41 `allow_failover=False` теряется через Agent `DynamicReservationLeaseSession` — `autonomy/evidence/integration/20260822T1337Z_notion_v41_agent_dynamic_session_failover_optout_gap.json`.
- Finding H: Core и Agent `server.py` exact materializers требуют один старый preimage — `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.
- Finding G: durable Agent tombstone создаёт minimum rollback floor — `autonomy/evidence/integration/20260822T0632Z_notion_tombstone_rollback_floor_gap.json`.
- Agent dependency graph не закрыт Core installer manifest — `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`.
- Tombstone multiwriter lost-update / missing established tombstone / success-before-durable-child-progress — evidence `20260822T0033Z`, `0045Z`, `0335Z`.
- Qwen partial SSE failover divergence — `20260822T1036Z_qwen_agent_partial_stream_recovery_divergence.json`.
- Qwen required-arg false uncertainty — `20260822T0935Z_qwen_required_arg_uncertainty_false_positive.json`.
- Qwen explicit session alias conflict — `20260822T0838Z_qwen_explicit_session_alias_conflict.json`.
- Qwen tool-policy/thread affinity — `20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`.
- Qwen cooldown forward-clock-jump + restart — `20260822T1132Z_qwen_cooldown_restart_clock_jump_gap.json`.

Также уже исследованы без нового контрпримера: governor/failover ownership и size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## CircleCI

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан fresh. Helper ничего не триггерил. Agent не прошёл combined exact materialization с Core Stage-B; Core Stage-B ещё не exact-local green; Qwen owner gates принадлежат Qwen workers. Недоступный/старый Circle result не считать PASS.

## Постоянная память

Стартовый canonical LATEST, зафиксированный в начале run:
- blob `e39659e68f5c9adf4323bce9bff72e97c069948b`;
- capsule `20260822T144315Z-b8fc379354`;
- archive SHA-256 `3fa04ffc818a6f09b2efad22c33491d944635c8472e8bd0d9eeed00f9bb57a77`;
- стартовая capsule восстановлена и workspace hashes совпали.

Для Finding N собрана новая v4 capsule:
- `20260822T154334Z-2606ae1840`;
- archive SHA-256 `03f3fbabb457dfe6cb75446bf3ca5e10d03bbb03dddba2ecdb7adeede469d1e0`;
- local `pack → verify → restore` PASS;
- immutable GitHub upload + readback PASS: part blobs `def8fb2c6d58adecf770092a21404a1faf10216b`, `807341d872fb6839102625d73689acc93687840d`; manifest blob `be65ab78b97d228a682e952dbb59fe5031c19325` — все совпали с локально рассчитанными Git blob SHA.

Перед CAS `LATEST` был перечитан и уже имел blob `dbd5db0bbe413f5c706bbd10a56412a9ce0d020d`, отличный от стартового CAS SHA. Поэтому новый checkpoint оставлен immutable orphan, `PREVIOUS` и `LATEST` не переписывались, force-write не использовался. Это штатный CAS-conflict по v4 protocol.

## Следующее

1. Notion Core + Agent забирают Findings L + M + N вместе при combined Stage-B materialization.
2. Не путать transport failover (`allow_failover`) и Agent reservation reselection; protected durable-intent sequence должен закрывать оба после первого provider entry.
3. Helper не должен первым триггерить owning Circle gate; после локального composed green только red-team exact SHA/status/artifacts.
4. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
