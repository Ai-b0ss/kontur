# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~08:5x МСК.

## Текущая точка

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Circle connectivity уже доказана; reconnect не повторять.
- Native Windows закрыт до полного same-byte Agent+Core local PASS. Старые PR #7 Windows/pending результаты новую composition не доказывают.

Agent fresh pair на этом head воспроизведена локально и скомпилирована:
- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- final `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

Но Agent RELEASE `5391235865` нашёл обязательную границу: raw PR #8 delegation files не доказывают delegated owner-mode. Полная Agent safety matrix должна идти на exact transformed pair **плюс** corrected owner/engineer five-file overlay:
- `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`
- `a9d15b79b421cd29b094b549be06d2b0319e26d9`
- `f36e9c91355dec667173b6265dd550554fb0f05d`
- `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`
- `f47838b338f2bd94163cf466110f939c065ac041`

Raw `delegation_policy=cc50fc7373578262e6051e76716563a98f8f4935` / `delegation_dispatcher=e888c87262d4307a0c5a7de9e315e01601f20a33` не содержат owner prompt fields; локальный `DelegationRequest(... prompt_mode='owner' ...)` на raw source падает с `TypeError`. Поэтому исторические/частичные Agent greens не переносятся. Windows остаётся запрещённым до full matrix на pair+overlay.

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
- helper 12/12 PASS; exact store+helper integration 11/11 PASS.

Обязательный порядок:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

Failure-safe stream projector:
- `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_candidate.py` blob `a094a4b5484384037fb02c07d345b73531a46091`, 3318 bytes;
- exact regression blob `8d5fadf31aeff034d09e9943b25249402a2207b0`, 3957 bytes;
- Python 3.13.5 + Starlette 0.50.0: `STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS 10/10`.

Server-owned lock boundary:
- candidate `autonomy/evidence/notion/20260824T0752Z_stageb_server_owned_lock_boundary_candidate.py`;
- blob `2f92c2abe56e2d4be39c4930a63dd876aca52294`, 896 bytes;
- regression `autonomy/evidence/notion/20260824T0752Z_test_stageb_server_owned_lock_boundary.py`;
- blob `b280001743064a86b61306c160820d9b88329672`, 4233 bytes;
- Python compile PASS; `STAGEB_SERVER_OWNED_LOCK_BOUNDARY_PASS 6/6`.

Инвариант: detached/server-owned commit task сам держит inference/conversation/affinity locks до durable completion. SSE client disconnect не имеет права освободить эти locks, пока provider/finalize ещё работает.

## Финальные gate pins — обновлены

До этого новый server-owned-lock regression можно было случайно не запустить и всё равно пройти финальные проверки. Это закрыто fail-closed.

Coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- blob `fafc7eb733da90d306b4fa599e57b6ecd921a357`;
- обязательно требует `tests.test_stageb_server_owned_lock_boundary`;
- Stage-B discovery также включает `stageb_server_owned_lock_boundary`, поэтому наличие теста без wiring в suite даёт `NOT_READY`.

Windows readiness:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v9`;
- blob `349b6005255382bab7284c42da43c2d163a178be`;
- pin coverage `fafc7eb7...`;
- обязательно требует `local_gates.stageb_server_owned_lock_boundary=PASS`;
- сохраняет exact `--candidate-root` Git-blob readback и отклонение symlink/drift.

Локальная проверка: `NOTION_LOCK_FINAL_GATE_HARDENING_PASS 7/7`: полный синтетический набор проходит; отсутствие exact lock regression, похожее имя вместо него, отсутствие lock gate, старый coverage pin и byte drift — блокируются.

Evidence:
`autonomy/evidence/notion/20260824T0848Z_stageb_lock_final_gate_hardening.json`.

## Следующий обязательный маршрут

1. Fresh-read #9 и PR #7/#8 перед любой записью. При head drift не переносить старые pair/gate доказательства автоматически.
2. Agent должен собрать candidate = exact transformed pair `c9ca... + 273db...` + corrected five-file owner/engineer overlay и прогнать полный mandatory Agent/delegation matrix. Raw PR #8 matrix для owner-mode недостаточна.
3. После Agent full PASS Core reconstruct/readback **те же bytes** и поверх них встраивает store `3ca05116...`, transaction helper `b3fe792b...`, stream projector `a094a4b5...`, server-owned lock boundary `2f92c2ab...` и соответствующие regressions.
4. Прогнать полный Agent+Core same-byte matrix: materializer/journal/tombstone/dynamic reservation/startup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover + strict intent/finalize + Responses/compaction replay + restart/tool-call + stream/nonstream/disconnect + server-owned lock boundary + ambiguous transport + removed account + TTL/size/oversize/stale retry + rollback + Codex shell-env secret exclusion.
5. Coverage `fafc7eb7...` PASS; если появляется новый mandatory regression, сначала fail-closed repin.
6. Readiness `349b6005... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only bridge/Notion tool loop -> owner-doctor -> discovered tool coverage -> legitimate rotation/restart/crash/bounded soak -> `NOTION_CORE_DONE`.

## Persistent memory

`LATEST` не переключать без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Не реконструировать неизвестные capsule bytes. Текущие результаты долговечно лежат в Git evidence/handoff/#9.
