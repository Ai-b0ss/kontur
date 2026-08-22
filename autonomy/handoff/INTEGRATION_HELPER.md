# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 03:42 UTC.

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

## Finding E — Qwen/Notion расходятся на whitespace-only owner prompt

Fresh Notion blobs:
- `payload/prompt_modes.py` `5dd1ff18840e6a78d1fa5612192c96891e4b1d69`;
- `tests/test_prompt_modes.py` `dca0e394f4c3d6d7944ea48c3c5bd3137eeaad0b`.

Свежий Qwen Core уже закрыл этот контракт: explicit owner prompt должен быть строкой с ненулевым содержимым после `trim()`-проверки, при этом валидные байты возвращаются без обрезки/переписывания (`e1206891ad8782229463ac375eadc51c3b608091`).

Notion `resolve_prompt_policy()` сейчас проверяет только `not owner_prompt`, поэтому `"   "` и `"\n\t"` принимаются как валидная owner-authority. Один и тот же owner-mode запрос может быть fail-closed в Qwen и фактически пустым, но принятым в Notion.

Offline parity regression PASS:
- current Notion: empty REJECT, spaces-only ACCEPT, newline/tab-only ACCEPT;
- candidate: все blank/whitespace-only REJECT;
- валидный prompt с внешними пробелами/переводами строк сохраняется byte-exact.

Artifacts:
- `autonomy/v3/tools/integration_owner_blank_prompt_parity_probe.py`;
- `autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.

Минимальный product fix: в Notion проверять `not isinstance(owner_prompt, str) or not owner_prompt.strip()`, после проверки возвращать исходный `owner_prompt` без `strip()`; добавить spaces-only/newline-only regressions.

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
5. child session создаётся `NotionDelegationAdapter` только в памяти и отдельного durable child-history/final-result store сейчас нет.

Hard crash в окне `resolve_call успешно удалил marker -> process-local tool result/final completion ещё не опубликован durably` забывает уже успешный side effect. После restart тот же логический child больше не tombstoned, локальная история исчезла, objective может начаться заново и повторить запись/команду.

Offline regression verdict: `CURRENT_REPLAY_REPRODUCED_CANDIDATE_CONTRACT_PASS`.
Нынешняя семантика дала `side_effect_count=2`, `restart_blocked=false`; кандидатная граница с durable `completed_uncommitted/dirty` дала `side_effect_count=1`, `restart_blocked=true`.

Artifacts:
- `autonomy/v3/tools/integration_notion_success_crash_replay_probe.py`;
- `autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.

Минимальный безопасный контракт:
- confirmed mutating success не удаляет последнее durable no-replay evidence раньше равносильной durable publication child progress/final result;
- нужен переход `inflight -> completed_uncommitted` либо настоящий durable child-history journal;
- restart должен fail-closed или точно восстановить child progress, но не перезапускать objective;
- task-level marker очищается только после strict durable child completion/history publication;
- лучше объединить семантику с Notion Core V22 intent/replay слоем, а не заводить отдельный recovery-протокол.

Существующие тесты crash boundary не закрывают: durable-tool-guard прямо ожидает немедленное удаление marker на `ok=true`, а restart-тест проверяет только inflight marker.

## Finding C — Agent server не замкнут Core installer payload manifest

Core integrated installer транзакционно пишет только старые 10 `PAYLOAD_NAMES`. Текущий Agent server уже зависит от новых локальных модулей, включая `prompt_modes.py`, `server_subagent_lifecycle.py` и после materialization `reservation_aware_lease.py`, плюс их dependency graph. Source checkout compile не является deployment proof.

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

Finding C усиливает B: initial tombstone generation и модуль store должны войти в согласованный Core install/deploy contract.

## Не повторять без изменения продукта

Уже отдельно исследованы: Qwen failover governor account ownership; governor-size accounting owner prompt + skills; final-turn orphan tool side effect; partial/truncated tool result; failover full-history rebase; durable pending obligation; duplicate unresolved tool ids; stale/total Qwen session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result; Notion tombstone multiwriter/missing-file semantics; Agent/Core payload closure; confirmed-success crash gap; whitespace-only owner parity.

## Постоянная память

Стартовый проверенный v4 `LATEST` этого запуска:
- blob `faa82cc10472bda1b0bae242a905fc779fe74c4a`;
- capsule `20260822T023953Z-d6e82f6fe3`;
- archive SHA-256 `a928b38a73f3a0be3dd41321dc007804ea0cbd94f55d7fe2e3afb05c9cc3dd06`.

Он восстановлен локально из immutable manifest + part с точной SHA/size/workspace проверкой до начала новой работы.

Новая substantial работа уже долговечно сохранена probe/evidence и этим handoff. Перед финальным v4 publish перечитать `LATEST`, затем checkpoint -> pack -> immutable upload/readback -> CAS; при изменившемся parent blob не overwrite.

## Следующее

1. Notion Agent/Core согласуют одну durable child-progress boundary: local mutating success нельзя забывать между `resolve_call` и crash.
2. Добавить product regression: successful `write_file` -> crash сразу после guard resolution -> new lifecycle/same task_id must not execute write twice.
3. Notion Agent синхронизирует whitespace-only owner validation с уже закрытым Qwen контрактом без изменения валидных prompt bytes.
4. Совместить Finding D с V22/provider-intent и deploy-manifest работой, а не форкать recovery protocol.
5. После product changes helper перепроверяет A/B/C/D/E; без изменения продукта не повторять.
6. Native Windows не объявлять доказанной по Linux.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
