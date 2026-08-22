# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 02:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Свежие product heads этого запуска:
- Qwen PR #6: `25c1347588ea9621a0ff5cf11a08c5df488cce00`;
- Notion PR #8: `04a659a23b3d72b44b334c9e35f23c1220d73eb3`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу владельцев:
- Qwen Core — owner prompt validation/restart exactness;
- Qwen Reliability — restart -> account failover -> completed side-effect no-replay;
- Notion Agent — durable subagent tombstone/path alias hardening + pair materialization;
- Notion Core — NCM28 native-Windows + durable Responses replay V12..V18.

## Finding C — Agent server не замкнут Core installer payload manifest

Fresh exact blobs:
- Agent `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- Agent `payload/prompt_modes.py` `5dd1ff18840e6a78d1fa5612192c96891e4b1d69`;
- Agent `payload/server_subagent_lifecycle.py` `5c9017350100a10e83072cb93f1b7aaced2c9ad7`;
- Agent materializer `tools/apply_startup_status_cleanup.py` `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- Core/Agent `integrated_upgrade.py` всё ещё один и тот же blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Core integrated installer по-прежнему транзакционно пишет только 10 `PAYLOAD_NAMES`:
`server.py`, `account_pool.py`, `diagnostics.py`, `auth_contract.py`, `migration_contract.py`, `stable_identity.py`, `stable_runtime_state.py`, `thread_state_registry.py`, `transport_evidence.py`, `conversation_segments.py`.
Из bridge-static отдельно hash-bound только `notion_images.py` и `turn_affinity.py`.

Но текущий Agent server уже напрямую импортирует `prompt_modes.py` и `server_subagent_lifecycle.py`, которых в этом deploy manifest нет. Pair materializer дополнительно вставляет `reservation_aware_lease.py`. У `server_subagent_lifecycle.py` следующий уровень локальных зависимостей включает как минимум `delegation_dispatcher.py`, `notion_delegation_adapter.py`, `notion_subagent_runtime.py`, `server_subagent_runtime.py`, `subagent_entrypoint.py`, `subagent_tombstone_store.py`.

То есть `compile(server.py)` в source checkout сейчас не является доказательством deployability. После синхронизации Agent->Core интегрированный upgrade способен записать новый `bridge/server.py`, не записав и не hash-bind'нув модули, которые этот server импортирует. На чистой первой установке это путь к `ModuleNotFoundError`; на нечистой — к ещё хуже скрытой зависимости от stale локальных файлов вне outer journal/rollback.

Offline regression verdict: `NOTION_AGENT_CORE_INSTALL_PAYLOAD_CLOSURE_GAP_REPRODUCED`.

Artifacts:
- `autonomy/v3/tools/integration_notion_agent_core_payload_closure_probe.py`;
- `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`;
- `autonomy/v3/candidates/NOTION_AGENT_CORE_DEPLOYMENT_CLOSURE_GATE_20260822.patch`.

Минимальная безопасная граница для owner:
1. До lifecycle stop/source write проверить явный runtime local-import closure.
2. Все новые Agent-модули либо транзакционно включить в один payload manifest, либо явно объявить сохранёнными зависимостями с exact SHA и доказанной установкой.
3. Каждый реально деплоимый модуль должен автоматически входить в payload SHA, preimage backup, outer journal, installed marker, rollback и final verification.
4. Incomplete closure => fail closed до mutation.
5. После окончательной materialization проверить чистый simulated installed bridge, а не только компиляцию в source tree.

## Finding A — durable tombstone multiwriter lost-update

Fresh exact Notion blobs на исходной проверке:
- `payload/subagent_tombstone_store.py` `6185f502fcdd7ead72237c1a0f3790b114e8a844`;
- `payload/server_subagent_lifecycle.py` `5c9017350100a10e83072cb93f1b7aaced2c9ad7`;
- `payload/server_subagent_runtime.py` `206d8cdfc0897979c981659e9edc378da08f2a78`.

`SubagentTombstoneStore` делает fsync + atomic `os.replace`, но `begin_call/resolve_call/mark_uncertain` строят новый snapshot из per-instance `_uncertain/_inflight`. Общей межпроцессной read-modify-write транзакции нет. Детерминированно воспроизведена потеря marker A при stale writer B.

Verdict: `NOTION_TOMBSTONE_MULTIWRITER_RACE_REPRODUCED_AND_LOCK_CONTRACT_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`;
- `autonomy/v3/candidates/NOTION_TOMBSTONE_MULTIWRITER_GUARD_20260822.patch`.

## Finding B — missing tombstone after restart fail-open

Store при `FileNotFoundError` создаёт новый empty generation. Это безопасно только на первом install; после established install потерянный no-replay file нельзя трактовать как fresh state. Воспроизведено: durable inflight marker -> файл исчез -> restart -> `state_uncertain=false` и задача больше не блокируется.

Verdict: `NOTION_TOMBSTONE_MISSING_RESTART_FAIL_OPEN_REPRODUCED_AND_STRICT_INSTALL_CONTRACT_PASS`.

Artifact:
- `autonomy/v3/tools/integration_notion_tombstone_missing_restart_probe.py`;
- `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

Finding C усиливает B: initial tombstone generation и сам модуль tombstone store должны войти в согласованный Core install/deploy contract, а не появляться отдельным side-channel после основного upgrade.

## Не повторять без изменения продукта

Уже отдельно исследованы: Qwen failover governor account ownership; governor-size accounting для owner prompt + skills; final-turn orphan tool side effect; partial/truncated tool result; failover full-history rebase; durable pending obligation; duplicate unresolved tool ids; stale/total Qwen session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result; Notion tombstone multiwriter/missing-file semantics.

## Постоянная память

Стартовый v4 `LATEST` этого запуска:
- blob `65ea91b001f8b7b2adfc38d46496b80f55c77676`;
- capsule `20260822T004900Z-01bbd14e89`;
- archive SHA-256 `7cfc2cdaaf7b389f2e124298a2bd9db4b6bad16a6c8e0eca8a3441f3ec26ae2f`.

Он был восстановлен локально из immutable manifest + part с полной SHA/size/workspace verify до начала новой работы.

Новая substantial работа уже долговечно сохранена отдельными probe/evidence/candidate и этим handoff. Перед финальным v4 publish нужно заново перечитать `LATEST` и сделать обычный pack -> immutable upload/readback -> CAS; при изменившемся parent blob не overwrite.

## Следующее

1. Notion Agent/Core owner согласуют packaging namespace и полный deploy manifest после pair materialization.
2. Добавить real closure regression на чистую installed bridge tree; source-checkout import availability не считать доказательством.
3. Одновременно закрыть tombstone multiwriter + established-install missing semantics так, чтобы initial tombstone generation входил в тот же durable install contract.
4. Native Windows проверку не размножать: deployment/rollback + tombstone path/lock semantics проверить в одном будущем разрешённом Windows gate.
5. После product change helper перепроверяет эти seams; без изменения продукта не повторять те же findings.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
