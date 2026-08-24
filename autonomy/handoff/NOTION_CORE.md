# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~10:4x МСК.

## Текущая точка

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Circle connectivity уже доказана; reconnect не повторять.
- Native Windows закрыт до полного same-byte Agent+Core local PASS. Старые PR #7 Windows/pending результаты новую composition не доказывают.

Agent exact transformed pair на этом head воспроизведена локально и скомпилирована:
- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- final `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

Полная Agent safety matrix должна идти на exact transformed pair **плюс** corrected owner/engineer five-file overlay:
- `delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`
- `delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`
- `notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`
- `subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`
- `server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`

Raw PR #8 delegation files не доказывают delegated owner-mode; исторические/частичные Agent greens не переносить на итоговый candidate.

## Что Core уже доказал локально

Stage A: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Durable Stage-B store на preimage `conversation_segments.py=553bd3496c21a7949c3a5dfa03f33b9e09293213`:
- candidate `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`, 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- compile PASS, targeted recovery/replay 16/16 PASS;
- manifest `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

Transaction helper:
- `autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`;
- blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes;
- exact regression `autonomy/evidence/notion/20260824T0403Z_test_stageb_transaction_helper.py`, blob `478fa18a2917861917ade1a444735757e6d75198`;
- helper 12/12 PASS; exact store+helper integration 11/11 PASS.

Обязательный порядок:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

Дополнительная локальная отрицательная проверка этого прохода: если route cleanup падает уже после durable finalize + ephemeral publish, точный retry берёт сохранённый replay и provider call count остаётся `1`. Это подтверждает post-commit replay floor; отдельный новый provider вызов не возникает.

Failure-safe stream projector:
- `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_candidate.py` blob `a094a4b5484384037fb02c07d345b73531a46091`, 3318 bytes;
- exact regression blob `8d5fadf31aeff034d09e9943b25249402a2207b0`, 3957 bytes;
- Python 3.13.5 + Starlette 0.50.0: `STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS 10/10`.

Server-owned lock boundary:
- candidate `autonomy/evidence/notion/20260824T0752Z_stageb_server_owned_lock_boundary_candidate.py` blob `2f92c2abe56e2d4be39c4930a63dd876aca52294`;
- regression `autonomy/evidence/notion/20260824T0752Z_test_stageb_server_owned_lock_boundary.py` blob `b280001743064a86b61306c160820d9b88329672`;
- `STAGEB_SERVER_OWNED_LOCK_BOUNDARY_PASS 6/6`.

Инвариант: detached/server-owned commit task сам держит inference/conversation/affinity locks до durable completion. SSE client disconnect не имеет права освободить эти locks, пока provider/finalize ещё работает.

## Финальные gate pins — актуальны после этого прохода

В этом проходе найден реальный coverage gap: canonical Stage-B transaction helper и его executable regression существовали, но прежний final coverage verifier не требовал `tests.test_stageb_transaction_helper`. Значит финальный suite теоретически мог стать зелёным без исполнения проверки самой транзакционной границы `route -> intent -> provider -> finalize -> publish`.

Gap закрыт fail-closed.

Coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- **blob `1342ed03e3a2b7eb4013480ba80db1e3d99750d7`**;
- обязательно требует `tests.test_stageb_transaction_helper`;
- Stage-B discovery включает `stageb_transaction_helper`; наличие теста без wiring в suite даёт `NOT_READY`.

Windows readiness:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema **`notion_windows_ready_candidate_v11`**;
- **blob `4b90b639b943dd627f27c030efa087e904181560`**;
- pin coverage `1342ed03...`;
- обязательно требует `local_gates.stageb_transaction_helper=PASS`;
- сохраняет exact `--candidate-root` Git-blob readback и отклонение symlink/drift;
- v10/старый coverage pin больше не являются допустимым Windows readiness proof.

Локальная falsification-проверка:
- coverage без transaction helper -> `NOT_READY`;
- coverage с exact module + suite wiring -> `PASS`;
- readiness без `stageb_transaction_helper` -> blocked;
- readiness со старым coverage pin -> blocked;
- полностью заполненный synthetic candidate -> PASS.

Evidence:
`autonomy/evidence/notion/20260824T1035Z_stageb_transaction_helper_gate_hardening.json`.

## Следующий обязательный маршрут

1. Fresh-read #9 и PR #7/#8 перед любой записью. При head drift не переносить pair/gate доказательства автоматически.
2. Candidate = exact transformed pair `c9ca... + 273db...` + corrected five-file owner/engineer overlay. Полный mandatory Agent/delegation matrix должен быть на этих bytes.
3. На **тех же bytes** Core встраивает store `3ca05116...`, transaction helper `b3fe792b...`, stream projector `a094a4b5...`, server-owned lock boundary `2f92c2ab...` и соответствующие regressions. `tests.test_stageb_transaction_helper` должен быть реально materialized и wired в suite, иначе новый coverage gate закономерно красный.
4. Прогнать полный Agent+Core same-byte matrix: materializer/journal/tombstone/dynamic reservation/startup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover + strict intent/finalize + transaction helper + Responses/compaction replay + restart/tool-call + stream/nonstream/disconnect + server-owned lock boundary + ambiguous transport + removed account + TTL/size/oversize/stale retry + rollback + Codex shell-env secret exclusion.
5. Coverage `1342ed03...` PASS.
6. Readiness v11 `4b90b639... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only bridge/Notion tool loop -> owner-doctor -> discovered tool coverage -> legitimate rotation/restart/crash/bounded soak -> `NOTION_CORE_DONE`.

## Persistent memory

`LATEST` не переключать без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Не реконструировать неизвестные capsule bytes. Текущие результаты долговечно лежат в Git evidence/handoff/#9.
