# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 16:39 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads, прочитанные в этом проходе:
- Qwen PR #6: `3f5729180f6669551d8a48a1c5e9be2e756445b3`;
- Notion Agent PR #8: `eaa7e812cb502649fb5291143070b33bfc94380e`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — bounded internal prompt-mode error / owner-session exact cluster;
- Qwen Reliability — account-store/cooldown/failover targeted cluster;
- Notion Agent — exact pair materialization + tombstone/recovery;
- Notion Core — composed Stage-B durable Responses + V41–V46 + native Windows gate.

## Finding O — V46 composed server пропускает каноническую tombstone-проводку Agent

Exact-source разрыв:
- Core V46 composition materializer `autonomy/evidence/notion/20260822T1605Z_v46_agent_core_composition_materializer.py`, blob `76fc60af515cc6a9a0212ff6bcf1de957f6631c3`, для `server.py` вызывает только `apply_startup_status_cleanup.apply` (`agent_server_apply`).
- Он не импортирует и не вызывает текущий `apply_subagent_tombstone_wiring`.
- Канонический Agent wrapper `tools/materialize_agent_wiring_with_tombstones.py`, blob `859039a5e408bc84e7046372cdb509131eb37a97`, после base materialization явно делает `server_updated = apply_tombstone_wiring(server_updated)` и требует ровно один `"subagent-uncertain-tasks.json"` marker.
- `tools/apply_startup_status_cleanup.py`, blob `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`, marker не добавляет; `tools/apply_subagent_tombstone_wiring.py`, blob `40ab3a448e33fb8a8c3ce045ef31a815d0554823`, добавляет.

Следствие: нынешние V46 isolated composed bytes не представляют текущую каноническую Agent no-replay/tombstone конфигурацию. Зеленый Stage-B/Agent cluster на таком output может проверять другой продукт.

Просто запустить канонический Agent wrapper после V46 тоже нельзя: wrapper снова входит в exact-source base transform, а V46 уже изменил frozen `server.py`, поэтому source blob guard должен закрыться.

Artifacts:
- probe: `autonomy/v3/tools/integration_notion_v46_tombstone_composition_probe.py`;
- evidence: `autonomy/evidence/integration/20260822T1632Z_notion_v46_tombstone_composition_gap.json`;
- минимальный кандидат для isolated V46 bytes: `autonomy/v3/candidates/NOTION_V46_TOMBSTONE_COMPOSITION_20260822.patch`.

Важно: этот patch только добавляет текущий tombstone transform в V46 test-composition. Он НЕ заменяет crash-safe Agent transaction/recovery materializer. Финальный product installer должен сохранить/адаптировать Agent journal/backups/recovery уже для composed Core+Agent bytes.

Обязательная composed regression:
1. composed server содержит ровно один `subagent-uncertain-tasks.json` marker;
2. Agent tombstone restart/no-replay tests идут на тех же composed bytes;
3. Core protected no-failover/strict-intent tests идут на тех же bytes;
4. production materialization не использует простой V46 `--apply` вместо транзакционного Agent installer.

## Findings L + M + N — остаются обязательными вместе с O

- **L:** Core `allow_failover=False` теряется через Agent `DynamicReservationLeaseSession` без явного forwarding. Evidence: `autonomy/evidence/integration/20260822T1337Z_notion_v41_agent_dynamic_session_failover_optout_gap.json`.
- **M:** Core V41 и Agent `account_pool.py` exact transform меняют один preimage; нужен явный rebase, guards ослаблять нельзя. Evidence: `autonomy/evidence/integration/20260822T1436Z_notion_v41_agent_account_pool_materializer_order_conflict.json`.
- **N:** даже с `allow_failover=False` Agent может сделать reservation reselection A→B между первым provider step и planner correction. После первого provider entry protected durable sequence должен держать тот же account или fail closed до нового provider I/O. Evidence: `autonomy/evidence/integration/20260822T1535Z_notion_postfirst_provider_reservation_reselect_gap.json`.

При combined Stage-B materialization владельцы Core+Agent должны закрыть L/M/N/O одним набором exact regressions, а не по отдельности на разных postimage.

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
- Notion delegated prompt/tool policy, partial-batch retry, rebind overlap/global parallelism, final-turn side effect.

Подробности сохранены в прежних `autonomy/evidence/integration/*`.

## CircleCI

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан. Helper ничего не триггерил.

Сейчас gate запускать рано:
- Qwen Core на свежем handoff имеет незакрытый bounded-error targeted RED;
- Notion Agent не прошёл текущий exact combined materialization;
- Notion Core V46 ещё не представляет полную текущую Agent tombstone composition и Stage-B не exact-local green.

Helper после локального composed green только сверяет exact SHA, gate branch/status/log/artifact evidence. Недоступный результат не считать PASS.

## Постоянная память v4

Старт этого прохода:
- `LATEST` blob `dbd5db0bbe413f5c706bbd10a56412a9ce0d020d`;
- capsule `20260822T144315Z-b8fc379354`;
- archive SHA-256 `3fa04ffc818a6f09b2efad22c33491d944635c8472e8bd0d9eeed00f9bb57a77`;
- manifest + 2 parts восстановлены, archive/workspace hashes совпали.

Новый checkpoint:
- capsule `20260822T163733Z-02917f5ea5`;
- archive SHA-256 `f68adffb75f29f8a238575b41124331ace4a8f6c5b69919056cc185928c76d4d`;
- local pack/verify/restore PASS;
- readback Git blobs: part0 `050e43ec2a3a463918026b40feb872c73eb782a9`, part1 `fa3fd41cde75491c2f9f8c0cf01d37690df20ad3`, manifest `8229bd8c1d31bd955f84be2232112ce7339224fa` — совпали с локальными exact Git blob SHA;
- перед публикацией `LATEST` повторно был тем же blob `dbd5db0...`, CAS conflict не было;
- старый `LATEST` сохранён в `PREVIOUS`, новый `LATEST` опубликован через exact parent SHA;
- текущий `LATEST` blob `6dac38dd988eca511b946a336c603db4488f6746`.

Force-write не использовался.

## Следующее

1. Core+Agent при следующей composed работе должны добавить current tombstone transform в V46-equivalent composition до запуска Agent no-replay tests.
2. L/M/N/O проверять на одном exact composed tree.
3. Затем red-team'нуть composed Stage-B negative paths: intent/finalize failure, ambiguous transport, post-first reservation, restart/tombstone replay, compaction, stream/non-stream.
4. Только после локального exact green читать owning Circle evidence; helper gate первым не запускает.

Ни hosted CI, ни live Qwen/Notion/Codex, ни Windows, production, реальные аккаунты или секреты в этом проходе не использовались.
