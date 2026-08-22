# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 05:33 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh product heads/readback этого прохода:
- Qwen PR #6: `8c5a08f13668d28888f150b994f5d9e76f51f4cc`;
- Notion PR #8: GitHub PR metadata сейчас показывает `590ae476b7dee4a9a07916cb3504c70568c12552`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу владельцев:
- Qwen Core — strict system/owner preflight до session mutation;
- Qwen Reliability — preferred-reuse distinct-account budget;
- Notion Agent — durable tombstone/path hardening + exact pair materialization;
- Notion Core — NCM28 native-Windows + durable Responses replay/intent V12..V25.

## Finding F — tool policy меняется, а старый Qwen thread переиспользуется

Fresh exact Qwen observations на head `8c5a08f...`:
- `server.js` выбирает `existingChatId` по `rollover + savedAccountAvailable`, без сравнения текущей tool policy со старой;
- `src/chat-adapter.js` строит exact tool prompt из `tools + tool_choice` и вычисляет `toolPromptHash = sha256(prompt).slice(0,16)`;
- `sessionStore.set(...)` сохраняет `toolPromptHash` рядом с `chatId/accountId`;
- `scripts/opencode-thread-affinity-test.js` проверяет account/thread affinity, но не tool-policy/thread affinity.

Следствие: при той же локальной сессии и том же доступном аккаунте переход, например, `read_file + write_file` -> только `read_file`, либо смена `tool_choice` на `required`, не создаёт новый upstream Qwen thread. Новый prompt попадает в уже существующий remote context, где остаётся старая tool policy. Для будущего Notion -> Qwen adapter это особенно опасно при сужении разрешённых инструментов.

Offline semantic regression PASS:
`QWEN_TOOL_POLICY_THREAD_AFFINITY_GAP_REPRODUCED_CANDIDATE_PASS`.

Проверено:
- текущая схема переиспользует `chat-old` после read-write -> read-only;
- кандидат при изменении exact `toolPromptHash` делает fresh-thread/full-history rebase;
- одинаковый hash сохраняет обычный owned-thread reuse;
- legacy record без hash безопасно перебазируется один раз;
- изменение `tool_choice` тоже меняет policy identity и требует fresh thread.

Artifacts:
- `autonomy/v3/tools/integration_qwen_tool_policy_thread_affinity_probe.py`;
- `autonomy/evidence/integration/20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`;
- `autonomy/v3/candidates/QWEN_TOOL_POLICY_THREAD_AFFINITY_GUARD_20260822.patch`.

Минимальный product contract:
1. exact requested `toolPromptHash` вычислять тем же canonical builder, который потом строит реальный tool prompt;
2. upstream `chatId` переиспользовать только если saved owner доступен, rollover=false и stored hash == requested hash;
3. mismatch/legacy missing hash => fresh upstream thread + full local history/current tool policy;
4. не ослаблять pending-tool replay guard, account/thread affinity, retry budget или provider failover.

## Открытые прежние интеграционные находки — не переисследовать без product change

A. Notion durable tombstone multiwriter lost-update:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`.

B. Missing tombstone after established restart fail-open:
- `autonomy/v3/tools/integration_notion_tombstone_missing_restart_probe.py`;
- `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

C. Agent server dependency graph is not closed by Core installer payload manifest:
- `autonomy/v3/tools/integration_notion_agent_core_payload_closure_probe.py`;
- `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`;
- `autonomy/v3/candidates/NOTION_AGENT_CORE_DEPLOYMENT_CLOSURE_GATE_20260822.patch`.

D. Confirmed mutating Notion child success clears no-replay marker before durable child progress exists:
- `autonomy/v3/tools/integration_notion_success_crash_replay_probe.py`;
- `autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.

E. Qwen/Notion owner whitespace-only prompt parity:
- `autonomy/v3/tools/integration_owner_blank_prompt_parity_probe.py`;
- `autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.

Уже отдельно исследованы и без изменения продукта не повторять: Qwen governor/failover ownership; governor size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## Постоянная память

Старт этого запуска:
- `LATEST.json` blob `ad6cba3acaed9dbef454537b2403ec8a1a931a6b`;
- capsule `20260822T033906Z-5f3bac7b6b`;
- archive SHA-256 `530bde81264fcdb055f96ac962b3de03305924a430b1393586ccf4dbb04e2b87`;
- manifest + обе части отдельно перечитаны, part lengths/SHA и archive size/SHA проверены; workspace восстановлен безопасно.

Перед завершением этого прохода обязателен новый checkpoint -> v4 pack -> immutable upload/readback -> CAS `LATEST`; при изменившемся parent blob не overwrite.

## Следующее

1. Qwen owner применяет Finding F как узкий thread-affinity regression рядом с `opencode-thread-affinity-test.js`, но не смешивает это с preferred-reuse budget работой Reliability.
2. После product change helper проверяет: same hash reuse; tool-set shrink fresh thread; `tool_choice` change fresh thread; legacy hash fresh thread; failover/pending replay без регрессии.
3. Notion Agent/Core продолжают A-D/E только после соответствующих product changes; без изменений не повторять.
4. Native Windows не объявлять доказанной по Linux.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
