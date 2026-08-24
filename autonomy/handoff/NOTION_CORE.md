# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~07:05 МСК.

## Текущая точка

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Agent RELEASE `5390547496`: late-alias materializer fix PASS 3/3, но exact transformed pair на новом head **ещё не перепроверена полностью**. Целевые identities остаются `account_pool.py=c9ca6f3b4545e469966369a4220a6a2a60bf3697/48066` и `server.py=273db94a8f9b153e95c910df221755e28c0f46a7/116047`; принимать их только после нового `--check -> apply -> readback SHA/size -> compile -> mandatory Agent matrix`.
- Circle connectivity уже доказана; reconnect не повторять.
- Native Windows закрыт до полного same-byte Agent+Core local PASS. Старые PR #7 Windows/pending результаты новой composition не доказывают.

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

До durable completion поток может отдавать только нейтральный комментарий. Ошибка транзакции/проекции после уже начатого HTTP 200 завершается очищенным `response.failed`; client cancellation не отменяет server-owned commit-critical task. Повтор после failure должен остановиться на durable unresolved `provider_intent`, а не полагаться на retry-политику Codex.

## Новый late-alias барьер

Agent head ушёл `9c2098fe... -> e3fe0417... -> 3cc0c0be...` и добавил обязательный `tests.test_materialize_agent_wiring_late_alias_substitution` (latest observed blob `4750c57e17055f1e6896382a0f355801492bc82f`). Он проверяет подмену final target/parent alias между ранней проверкой и фактической файловой операцией.

Старые final pins `b51f11f... / 2da96347...` больше не разрешают Windows.

Current coverage:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- blob `0d2b9247f7b1ba2383c5ba87ed4731e1d61ca806`;
- exact-requires `tests.test_materialize_agent_wiring_late_alias_substitution`.

Current readiness:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v8`;
- blob `e80e119f19847a44b84ebdebcaf1e1391588c00a`;
- pin coverage `0d2b9247...`;
- mandatory `agent_materializer_late_alias_substitution=PASS`;
- заново хеширует реальные candidate files под `--candidate-root` и отклоняет drift/symlink.

Локальная negative/positive проверка: `NOTION_LATE_ALIAS_FINAL_GATE_HARDENING_PASS 7/7`: полный набор проходит; отсутствие нового regression, похожее имя вместо точного модуля, отсутствие нового readiness gate, старый coverage pin и byte drift — блокируются.

Evidence: `autonomy/evidence/notion/20260824T0652Z_agent_late_alias_gate_hardening.json`, blob `1ba90fe1fa4fb31ae960d186d5a0ac2654f29843`.

## Следующий обязательный маршрут

1. Fresh-read #9 и PR #7/#8. Если Agent head снова изменился — не переносить старые pair/gate доказательства автоматически.
2. Дождаться свежего Agent pair RELEASE на текущем head: exact `c9ca6f3b.../48066 + 273db94a.../116047` readback+compile и full mandatory Agent matrix, включая target-path-safety и late-alias-substitution.
3. На этих же байтах встроить store `3ca05116...`, transaction helper `b3fe792b...`, stream projector `a094a4b5...` и exact `tests/test_stageb_stream_failure_projection.py`.
4. Прогнать полный Agent+Core same-byte matrix: materializer/journal/tombstone/dynamic reservation/startup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover + strict intent/finalize + Responses/compaction replay + restart/tool-call + stream/nonstream/disconnect + ambiguous transport + removed account + TTL/size/oversize/stale retry + rollback + Codex shell-env secret exclusion.
5. Coverage `0d2b9247...` PASS.
6. Readiness `e80e119f... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only bridge/Notion tool loop -> owner-doctor -> discovered tool coverage -> legitimate rotation/restart/crash/bounded soak -> `NOTION_CORE_DONE`.

## Persistent memory

`LATEST` не переключать без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Не реконструировать неизвестные capsule bytes. Текущие результаты долговечно лежат в Git evidence/handoff/#9.
