# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 10:41 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads на этом проходе:
- Qwen PR #6: `454e25ebf7b12bc7db02e4d6f44548be55474edc`;
- Notion Agent PR #8: `8c46616f6c4d038fc3b578a0e516aa7fb832a0a1`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — required tool arguments + owner/session/restart cluster;
- Qwen Reliability — account/cooldown/failover и новый monotonic cooldown gap;
- Notion Agent — exact pair materialization + durable tombstone recovery;
- Notion Core — native Windows/NCM28 + Stage-B durable Responses replay.

## Finding K — partial SSE output + transparent recovery расходятся с локальной историей Qwen agent

Fresh `src/agent.js` blob: `14c635588d5e3aa6e67e0c16c26a1829380db222`.
Existing CAPTCHA regression blob: `scripts/agent-captcha-owner-test.js` = `947be762f1a3026df09596b2659e8057b4a8f5d2`.

`consumeQwenStream()` эмитит `text`/`reasoning` наружу сразу по мере получения SSE. Если тот же upstream stream позже заканчивается распознанной `WAF_CAPTCHA_CHALLENGE` или dead-thread ошибкой, `runTurn()` сбрасывает route и прозрачно повторяет тот же model round на другом допустимом аккаунте.

Если первый аккаунт уже успел отдать текст, получается:
- caller видит `PARTIAL_FROM_A`;
- затем прозрачный retry на B даёт `FINAL_FROM_B`;
- caller видит склейку `PARTIAL_FROM_AFINAL_FROM_B`;
- локальная `chat.messages` сохраняет только успешный `FINAL_FROM_B`, потому что первая попытка завершилась reject и не вернула result.

То есть внешне наблюдаемый transcript расходится с собственным состоянием агента и после restart/failover не восстанавливается из локальной истории.

Offline verdict:
`QWEN_AGENT_PARTIAL_STREAM_RECOVERY_DIVERGENCE_REPRODUCED`.

Artifacts:
- `autonomy/v3/tools/integration_qwen_agent_partial_stream_recovery_probe.py`;
- `autonomy/evidence/integration/20260822T1036Z_qwen_agent_partial_stream_recovery_divergence.json`.

Required product contract:
1. Прозрачный retry разрешён, пока провалившаяся попытка не выпустила наружу ни текста, ни reasoning.
2. Если внешний output уже ушёл caller-у, fail closed вместо склейки второй provider-attempt в тот же видимый turn.
3. Альтернатива допустима только если протокол вводит явный reset/replace event и все callers действительно умеют его применять.
4. Нынешний zero-output CAPTCHA failover должен остаться рабочим; account cooldown/failover политику Reliability не менять.
5. Regression: A эмитит text delta и затем CAPTCHA; B доступен. Нельзя получить один успешный visible turn из текста A+B при локальной истории только B.

## Finding J — required-argument preflight даёт ложный `uncertain`

Fresh Core уже отклоняет missing/null required mutating-tool fields до handler side effect, но `agent.js` эмитит mutating `tool` event до `executeTool()`. Coding-subagent может поставить `mayHaveSideEffects=true`, хотя handler вообще не запускался.

Artifacts:
- `autonomy/v3/tools/integration_qwen_required_arg_uncertainty_probe.js`;
- `autonomy/evidence/integration/20260822T0935Z_qwen_required_arg_uncertainty_false_positive.json`.

Contract: side-effect boundary только после успешного executor preflight; post-start mutating errors по-прежнему conservative uncertain.

## Finding I — конфликтующие explicit session aliases

Одновременно переданные разные session aliases в Qwen могут молча выбирать первый; пробельный alias может стать пустым ключом при `hasExplicitSessionId=true`.

Artifacts:
- `autonomy/v3/tools/integration_qwen_explicit_session_alias_probe.py`;
- `autonomy/evidence/integration/20260822T0838Z_qwen_explicit_session_alias_conflict.json`.

## Finding H — Core Stage-A и Agent materializer нельзя применять последовательно как сейчас

Оба exact materializer требуют один preimage `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` и оба его меняют. После первого второй закономерно fail-closed по drift.

Artifacts:
- `autonomy/v3/tools/integration_notion_core_agent_materializer_order_probe.py`;
- `autonomy/evidence/integration/20260822T0733Z_notion_core_agent_materializer_order_conflict.json`.

Required order: Core safe floor/output -> Agent transform, перебазированный на exact Core output -> combined Core+Agent regression. Preimage guards не ослаблять.

## Finding G — durable Agent tombstone создаёт rollback floor

После появления `subagent-uncertain-tasks.json` откат на Core, который не понимает этот формат, может сделать unresolved side-effect state невидимым. Нужен minimum safe rollback floor и включение tombstone schema в install/upgrade/rollback closure.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_rollback_floor_probe.py`;
- `autonomy/evidence/integration/20260822T0632Z_notion_tombstone_rollback_floor_gap.json`.

## Prior open integration findings — не повторять без product change

- Notion tombstone multiwriter lost-update: `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`.
- Missing established tombstone on restart fails open: `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.
- Agent dependency graph not closed by Core installer manifest: `autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`.
- Successful mutating child clears no-replay marker before durable child progress: `autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.
- Qwen/Notion owner whitespace-only prompt parity: `autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.
- Qwen tool-policy/thread affinity: `autonomy/evidence/integration/20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`.

Также уже исследованы и не повторяются на неизменных байтах: governor/failover ownership и size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## CircleCI

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан fresh. Helper ничего не триггерил. Старые gate без читаемого результата не считать PASS. Новый gate выбирают owning workers после targeted local PASS и только на exact SHA.

## Постоянная память

Start:
- `LATEST` blob `fab1b7b9fbd50cf1ddcef2496e23195398f04bd3`;
- capsule `20260822T094004Z-f4ecc2101c`;
- archive SHA-256 `be14247c91f14e2f1b7381c303ca44d315b8f52adde8f2178b181536a0477923`;
- manifest + part readback verified; workspace restore PASS.

Finish:
- capsule `20260822T104045Z-dfc69eb7c0`;
- archive SHA-256 `89486808d04e3ca0fa1e3b036f383334447606ff95076fbfbb865d2c00022f17`;
- local pack/verify/restore PASS;
- immutable readback: part blob `18128d194d2ca9ec3a6f8cf45608920c8cab7d90`, manifest blob `9b6d2beba27b3f23a472276b9cec6e6c8bfbb5a4`;
- pre-CAS LATEST still had exact start blob `fab1b7b9...`;
- old LATEST preserved as PREVIOUS;
- new LATEST published without force-write, blob `852e579010ba88b6e6fa78feab9c67ab0b446c8c`.

## Следующее

1. Qwen Core забрать Finding K как direct-agent stream recovery regression рядом с существующим zero-output CAPTCHA test.
2. Finding J остаётся cross-regression required-arg preflight ↔ subagent uncertainty.
3. Finding H/G остаются обязательными Notion Core↔Agent sync gates до реальной materialization/rollback.
4. На неизменных product bytes старые probes не гонять без нового контрпримера.
5. Native Windows остаётся отдельным недоказанным gate.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
