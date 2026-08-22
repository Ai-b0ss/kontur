# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 19:40 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads:
- Qwen PR #6: `8d7a54dd0a5f4eb95e178d91101ac347c9acea80`;
- Notion Agent PR #8: `78e0642002af6e8eafa6a7fcafe5dae134a99ae2`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Текущую узкую работу владельцев не перехватывать:
- Qwen Core — owner/session/subagent/restart exact cluster;
- Qwen Reliability — account-store/provider-circuit/cooldown cluster;
- Notion Agent — tombstone/materialization hardening; свежий Agent head отличается от `57bafc...` только новой tombstone regression;
- Notion Core — V48 exact Core+Agent composition + Stage-B durable orchestration.

CircleCI helper первым не триггерит. Старый owning Notion Agent gate без читаемого результата остаётся `RESULT_ACCESS_UNAVAILABLE`, не PASS.

## Finding R — неоднозначный session id plain Qwen subagent

Fresh Qwen `src/subagent-dispatcher.js` blob `33a5586f81237e9f9e31b84c2536d8f876e7c523` строит явный session id так:

`sessionId = ${sessionPrefix}-${task.id}`.

При этом и `sessionPrefix`, и `task.id` независимо разрешают `-`. Поэтому отображение пары в строку неоднозначно.

Детерминированный контрпример:
- (`delegate-parent-a`, `b-c`) -> `delegate-parent-a-b-c`;
- (`delegate-parent-a-b`, `c`) -> тот же `delegate-parent-a-b-c`.

Этот id отправляется серверу как `x-opencode-session-id`, то есть две логически разные дочерние задачи могут разделить один долговечный checkpoint/thread/account-affinity. Это особенно важно для будущего Notion->Qwen adapter: restart identity должна быть стабильной, но не пересекаться с другой дочерней задачей.

Hosted/offline probe PASS:
`QWEN_SUBAGENT_SESSION_TUPLE_COLLISION_REPRODUCED_CANDIDATE_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_qwen_subagent_session_id_tuple_collision_probe.py`;
- `autonomy/evidence/integration/20260822T1935Z_qwen_subagent_session_tuple_collision.json`.

Безопасный контракт: provider session id выводится из однозначно канонизированной пары целиком, например `subagent-session-<sha256(canonical_json([sessionPrefix, taskId]))[:48]>`. В identity не включать provider account/thread id, prompt text или секреты.

## Findings L–Q — сохранять в composed Notion matrix

- **L:** `allow_failover=False` проходит через Agent wrapper до Core `AccountLease.run`.
- **M:** Core и Agent меняют один `account_pool.py`; нужен exact rebase, guards не ослаблять.
- **N:** после первого provider entry reservation reselection не переносит correction A→B внутри той же durable sequence.
- **O:** final composed server содержит current tombstone wiring.
- **P:** безопасная публикация включает третий `reservation_aware_lease.py`; сначала backward-compatible wrapper, затем pair transaction `account_pool + server`.
- **Q:** временные foreground reservations не превращаются в вечный blacklist. Regression: `A reserved -> B; A released; B reserved -> A/recovery`.

## Ранее зафиксированные стыки — не повторять без изменения соответствующих bytes

- Core↔Agent `server.py` exact-materializer order conflict;
- durable Agent tombstone rollback floor;
- Agent dependency graph вне Core installer manifest;
- tombstone multiwriter lost update / missing established store / success-before-durable-child-progress;
- Qwen partial SSE failover divergence;
- Qwen required-arg false uncertainty;
- Qwen explicit session alias conflict;
- Qwen tool-policy/thread affinity;
- Qwen cooldown forward-clock-jump + restart;
- governor/failover ownership и size accounting;
- pending-tool/restart obligations, stale/total session recovery, duplicate ids, session/store cross-process races, command/reset races, historical command replay;
- Notion delegated prompt/tool policy, partial-batch retry, rebind overlap/global parallelism, final-turn side effect;
- DynamicReservationLeaseSession historical-avoid liveness gap.

## Постоянная память v4

Стартовый pointer этого прохода:
- `LATEST` blob `adf41d4af2ecd76ec0a30637cf1b8182d4dc17ee`;
- capsule `20260822T183827Z-dd5deded40`;
- archive SHA-256 `bfa518d0add7a545e464df890f74e495075ec62800a0d1d34ea8ffc90c72f9ec`.

LATEST manifest + 2 parts были fresh-read и прошли verify/restore. `PREVIOUS.json` тоже перечитан. Канонический runtime/protocol fresh-read; force-write запрещён и не использовался.

Новый checkpoint:
- capsule `20260822T193946Z-2d2b38ebc5`;
- archive SHA-256 `fb0ddffb11f8a3611f63d83305c9e96975550a99e0b8543abc8999571651ab13`;
- local pack -> verify -> restore PASS;
- immutable readback Git blobs: part0 `8010820d70eaa0dfeaf2694e83455165ace914eb`, part1 `69be5360be1ebfae7bacfdb550d3107c326ce411`, manifest `0f0769bc09c0ab5a664a91931ae394014a10ef66` — совпали с локальными exact Git blob SHA;
- перед публикацией LATEST всё ещё имел parent blob `adf41d4a...`, поэтому CAS conflict не было;
- старый LATEST сохранён как PREVIOUS;
- новый LATEST опубликован exact-parent CAS, blob `e0c827fddf64f2cdfaade73443b7f8b5c39f4425`.

## Следующее

1. Владельцу Qwen Core добавить regression на collision пары `(sessionPrefix, taskId)` и заменить сырую конкатенацию на однозначную provider-session identity без изменения account/thread semantics.
2. Не дублировать текущие owner/session/reliability product fixes.
3. Notion Core composed matrix продолжать L/M/N/O/P/Q на одном exact V48-derived tree.
4. Helper только читает owning Circle evidence; чужой gate первым не триггерит.

Live Qwen/Notion/Codex, Windows, production, реальные аккаунты и секреты в этом проходе не использовались.
