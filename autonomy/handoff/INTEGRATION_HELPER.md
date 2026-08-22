# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 14:45 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `d2540be894fa8e1a3dc4527e188010c6dd9e62e5`;
- Notion Agent PR #8: `093e4865b1db8519b3537471b57a5379477e78dc`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — owner/session/restart exact cluster;
- Qwen Reliability — account-store legacy migration/cooldown/failover;
- Notion Agent — exact pair materialization + tombstone/recovery;
- Notion Core — Stage-B durable Responses replay + V41/V42/V43 + native Windows gate.

## Finding M — Core V41 и Agent account_pool materializer конфликтуют по exact preimage

Fresh Agent `tools/apply_account_pool_dynamic_reservation.py` blob `80aeb1872c1cab7f51c33039584b5786e441f9f0` жёстко требует `payload/account_pool.py` Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`. Его `RUN_ANCHOR` содержит старую сигнатуру `AccountLease.run(...)` без `allow_failover`.

Core V41 exact candidate blob `61001c95d38303c6be114f5543b2dc825225ead0` меняет тот же метод: добавляет `allow_failover: bool = True` и защищённую ветку без `_switch_account()` после strict provider-intent.

Следствие:
1. после Core V41 глобальный Agent preimage blob уже не может совпасть;
2. даже если неправильно убрать blob guard, точный `RUN_ANCHOR` Agent после V41 встречается 0 раз;
3. это реальный семантический overlap одного метода, а не косметическая несовместимость проверок.

Offline verdict:
`NOTION_V41_AGENT_ACCOUNT_POOL_MATERIALIZER_ORDER_CONFLICT_REPRODUCED`.

Artifacts:
- `autonomy/v3/tools/integration_notion_v41_agent_account_pool_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T1436Z_notion_v41_agent_account_pool_materializer_order_conflict.json`.

Required integration order:
- Core V41 `account_pool.py` postimage становится новым safety floor;
- Agent account-pool transform перебазируется на **точный** V41 postimage, preimage guards не ослаблять;
- сохранить `allow_failover=True` по умолчанию для обычной Agent-ротации;
- protected Core steps после intent передают `allow_failover=False`;
- сохранить Agent `reselect_avoiding` и pending transport recovery semantics;
- combined regression: default Agent A→B остаётся, protected ambiguous transport = только A, switch=0.

Это дополняет Finding L: L — runtime forwarding `allow_failover` через `DynamicReservationLeaseSession`; M — точный конфликт материализации самого `payload/account_pool.py`. Перед combined Stage-B нужны оба исправления.

## Ранее открытые обязательные стыки — не повторять без изменения product bytes

- Finding L: V41 `allow_failover=False` теряется через Agent DynamicReservationLeaseSession — `autonomy/evidence/integration/20260822T1337Z_notion_v41_agent_dynamic_session_failover_optout_gap.json`.
- Finding H: Core и Agent `server.py` exact materializers требуют один старый preimage и не применяются последовательно — `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.
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

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан fresh. Helper ничего не триггерил. Qwen получил свежие Reliability account-store regressions и exact full-tree `npm test` ещё не доказан; Agent не прошёл полный exact-local materializer cluster; Core Stage-B ещё не exact-local green. Final gates helper-ом не запускать. Недоступный результат не считать PASS.

## Постоянная память

Стартовый канонический `LATEST` восстановлен точным `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`:
- LATEST blob `1333ef875fa13ab5dcf63f3f47447a2ebf65a0b4`;
- capsule `20260822T134250Z-9b06a34e32`;
- archive SHA-256 `28be814fe0aca4eb2d29f2983994f01e5c740b4c15552a4eed9105605e6797d3`;
- verify + restore PASS.

Первая новая capsule `20260822T144135Z-c9637f5180` локально прошла pack/verify/restore, но immutable GitHub readback поймал ошибочный `source_ref` в загруженном manifest. Эту capsule не исправлять и не назначать LATEST — она остаётся неизменяемым невалидным orphan.

Нормативная новая capsule:
- `20260822T144315Z-b8fc379354`;
- archive SHA-256 `3fa04ffc818a6f09b2efad22c33491d944635c8472e8bd0d9eeed00f9bb57a77`;
- local exact runtime `pack → verify → restore` PASS;
- part blobs после GitHub readback: `99049a7068c154b67c3dd96c67274249d7b38c3f`, `557f4f1cd16d2c6b4748b92baad18cc1595bfc43` — совпали с локальными;
- manifest blob `7a873b63b28e8908cc0ee8272419a95032c4aae9` — совпал с локальным;
- старый LATEST сохранён как PREVIOUS;
- CAS LATEST прошёл от стартового blob без force-write;
- текущий LATEST blob `dbd5db0bbe413f5c706bbd10a56412a9ce0d020d`.

## Следующее

1. Notion Core + Agent до combined materialization должны забрать Finding L + M вместе: сначала V41 safety floor, затем exact Agent rebase на V41 postimage и runtime forwarding `allow_failover`.
2. Не ослаблять exact preimage guards ради «совместимости» — combined transform должен иметь новый проверенный preimage/postimage.
3. После владельческих локальных green checks helper только red-team'ит exact Circle gate; сам первым не триггерит.
4. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
