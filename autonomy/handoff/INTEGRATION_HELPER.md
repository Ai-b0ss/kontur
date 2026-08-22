# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 03:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Свежие product heads этого запуска:
- Qwen PR #6: `6eab3a8232bc40b631e5804fe7fbb33e57754e1a`;
- Notion PR #8: `d2ada47dd096e1273a8bfb1977240a6034e8e622`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу владельцев:
- Qwen Core — owner prompt validation/restart exactness;
- Qwen Reliability — restart/failover completed-vs-unresolved side-effect gates и governor reliability;
- Notion Agent — durable tombstone/path hardening + pair materialization;
- Notion Core — NCM28 native-Windows + durable Responses replay/intent V12..V22.

## Finding D — confirmed mutating tool success теряет no-replay защиту до durable child commit

Fresh exact Agent blobs:
- `payload/delegated_tool_loop.py` `1681001501a24bb8ba4754c1b3f4ddb1254fa8a9`;
- `payload/server_subagent_runtime.py` `206d8cdfc0897979c981659e9edc378da08f2a78`;
- `payload/notion_delegation_adapter.py` `6f50b5f59b441e139308782404742397ab3e7d3c`;
- `payload/subagent_tombstone_store.py` `e5908b3178120b4d37675d307208470674c4d65d`;
- `tests/test_server_subagent_durable_tool_guard_v2.py` `638e685c4fcc8a4df5c151288e10e1188af26c68`;
- `tests/test_server_subagent_tombstone_restart.py` `aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee`.

Текущий порядок для `write_file/edit_file/run_shell`:
1. `begin_call` durably пишет inflight marker;
2. локальный инструмент реально меняет проект;
3. при подтверждённом `ok=true` `server_subagent_runtime` сразу вызывает `resolve_call` и удаляет marker;
4. только после возврата executor `DelegatedToolLoopSession` добавляет `function_call_output` в свой `_history`;
5. сам child session создаётся `NotionDelegationAdapter` только в памяти и отдельного durable child-history/final-result store сейчас нет.

Значит hard crash в узком, но реальном окне `resolve_call успешно удалил marker -> process-local tool result/final completion ещё не опубликован durably` забывает уже успешный side effect. После restart тот же логический child больше не tombstoned, локальная история исчезла, objective может начаться заново и повторить запись/команду.

Offline regression verdict: `CURRENT_REPLAY_REPRODUCED_CANDIDATE_CONTRACT_PASS`.
Нынешняя семантика дала `side_effect_count=2`, `restart_blocked=false`; кандидатная граница с durable `completed_uncommitted/dirty` состоянием дала `side_effect_count=1`, `restart_blocked=true`.

Artifacts:
- `autonomy/v3/tools/integration_notion_success_crash_replay_probe.py`;
- `autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.

Минимальный безопасный контракт:
- подтверждённый mutating tool result не должен удалять последнее durable no-replay evidence раньше равносильной durable publication child progress/final result;
- нужен переход `inflight -> completed_uncommitted` либо настоящий durable child-history journal;
- после restart `completed_uncommitted` обязан fail-closed или точно восстановить child progress, но не перезапускать objective;
- очищать task-level marker можно только после strict durable child completion/history publication;
- лучше объединить эту семантику с Notion Core V22 intent/replay слоем, а не заводить третий независимый recovery-протокол.

Существующие тесты этот crash boundary не закрывают: durable-tool-guard прямо ожидает немедленное удаление marker на `ok=true`, а restart-тест проверяет только случай, когда inflight marker ещё существует.

## Finding C — Agent server не замкнут Core installer payload manifest

Fresh exact blobs исходной проверки:
- Agent `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- Agent `payload/prompt_modes.py` `5dd1ff18840e6a78d1fa5612192c96891e4b1d69`;
- Agent `payload/server_subagent_lifecycle.py` `5c9017350100a10e83072cb93f1b7aaced2c9ad7`;
- Agent materializer `tools/apply_startup_status_cleanup.py` `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- Core/Agent `integrated_upgrade.py` blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Core integrated installer транзакционно пишет только старые 10 `PAYLOAD_NAMES`. Текущий Agent server уже зависит от новых локальных модулей, включая `prompt_modes.py`, `server_subagent_lifecycle.py` и после materialization `reservation_aware_lease.py`, плюс их dependency graph. Source checkout compile поэтому не является deployment proof.

Verdict: `NOTION_AGENT_CORE_INSTALL_PAYLOAD_CLOSURE_GAP_REPRODUCED`.

Artifacts:
- `autonomy/v3/tools/integration_notion_agent_core_payload_closure_probe.py`;
- `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`;
- `autonomy/v3/candidates/NOTION_AGENT_CORE_DEPLOYMENT_CLOSURE_GATE_20260822.patch`.

## Finding A — durable tombstone multiwriter lost-update

`SubagentTombstoneStore` делает fsync + atomic `os.replace`, но mutation строится из per-instance `_uncertain/_inflight`; общей межпроцессной read-modify-write транзакции нет. Детерминированно воспроизведена потеря marker A stale writer B.

Verdict: `NOTION_TOMBSTONE_MULTIWRITER_RACE_REPRODUCED_AND_LOCK_CONTRACT_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`;
- `autonomy/v3/candidates/NOTION_TOMBSTONE_MULTIWRITER_GUARD_20260822.patch`.

## Finding B — missing tombstone after restart fail-open

Store при `FileNotFoundError` создаёт новый empty generation. Это безопасно только на первом install; после established install потерянный no-replay file нельзя трактовать как fresh state.

Verdict: `NOTION_TOMBSTONE_MISSING_RESTART_FAIL_OPEN_REPRODUCED_AND_STRICT_INSTALL_CONTRACT_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_missing_restart_probe.py`;
- `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

Finding C усиливает B: initial tombstone generation и сам модуль store должны войти в согласованный Core install/deploy contract.

## Не повторять без изменения продукта

Уже отдельно исследованы: Qwen failover governor account ownership; governor-size accounting для owner prompt + skills; final-turn orphan tool side effect; partial/truncated tool result; failover full-history rebase; durable pending obligation; duplicate unresolved tool ids; stale/total Qwen session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result; Notion tombstone multiwriter/missing-file semantics; Agent/Core payload closure; confirmed-success crash gap из Finding D.

## Постоянная память

Стартовый проверенный v4 `LATEST` этого запуска:
- blob `faa82cc10472bda1b0bae242a905fc779fe74c4a`;
- capsule `20260822T023953Z-d6e82f6fe3`;
- archive SHA-256 `a928b38a73f3a0be3dd41321dc007804ea0cbd94f55d7fe2e3afb05c9cc3dd06`.

Он восстановлен локально из immutable manifest + part с точной SHA/size/workspace проверкой до начала новой работы.

Новая substantial работа уже долговечно сохранена отдельными probe/evidence и этим handoff. Перед финальным v4 publish перечитать `LATEST`, затем checkpoint -> pack -> immutable upload/readback -> CAS; при изменившемся parent blob не overwrite.

## Следующее

1. Notion Agent/Core должны согласовать одну durable child-progress boundary: local mutating success нельзя забывать между `resolve_call` и crash.
2. Добавить реальную regression на текущие product classes: successful `write_file` -> crash immediately after guard resolution -> new lifecycle/same task_id must not execute write twice.
3. Совместить это с V22/provider-intent и deploy-manifest работой, а не форкать ещё один recovery protocol.
4. После product changes helper перепроверяет Finding A/B/C/D; без изменения продукта не повторять.
5. Native Windows не объявлять доказанной по Linux; tombstone/install/rollback semantics проверить одним будущим разрешённым Windows gate.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
