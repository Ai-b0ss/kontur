# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head at exit `680457a197910ae47b25931b36b4db069a546d79`. Он на один commit опередил проверенный `37abfaa5...`; diff затронул только `payload/reservation_aware_lease.py`. Exact Codex project probe остался тем же blob `2f6d5873606975771b5ab418d5f9d45cd602304c`, поэтому Core finding ниже остаётся актуальным. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity из PR #8.

## Режим

ZERO-MINUTE: не запускать CircleCI/GitHub Actions/Cloudflare/другой hosted CI и не делать trigger-push. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260820T225631Z-94b0ef88fe`;
- archive SHA-256 `1a6cbec858476279027ad2551a87026179139b4c6038d284ea5b83f338be88cd`;
- 1 part;
- part size `9768`, Git blob `87ddb09f3cc0352100b31388fc6fdb4cb4aff456` — совпадает с локально рассчитанным;
- manifest size `3141`, Git blob `fa24a9c3fbb113e1ccd478107a4d3e363916cf0e` — совпадает с локально рассчитанным;
- `LATEST.json` после exact CAS: Git blob `967a929fa5eabe7610284f6dba8c802c7330671a`;
- предыдущая capsule `20260820T214540Z-d76b548d33` сохранена как `PREVIOUS`.

В начале текущего прохода `20260820T214540Z-d76b548d33` восстановлена из exact part через v4; part/archive/workspace verification прошёл. После восстановления runtime-restore v4 Linux regression повторно дал `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа — v23. Native Windows write primitive без нового точного Windows evidence не менять.

Уже доказано настоящим Windows: `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят; аварийный `auth-rollback` остаётся красным; managed-file rollback и non-target preservation проходят; auth/stable rollback падают с `PermissionError`; `remove_plain_tree` исключён как источник.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) при последней read-only проверке всё ещё `pending`. Нового Windows/hosted запуска не было.

Когда появится новый точный callsite/outside-digest: использовать готовый call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4` → минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore v4

Кандидат v4 на Linux закрывает partial final, temp cleanup, directory/symlink destination, unsafe restore root, создание root mode 700, сохранение exit codes и утечку `RUNTIME_STATE_KEY` в argv/child env. Вердикт повторно подтверждён: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point + overwrite/atomic replace semantics НЕ доказаны; объединить с будущим единственным разрешённым Windows Core gate и auth-rollback callsite.

## Codex lifecycle

PR #7 уже имеет `/v1/responses`, streaming/non-streaming, function/custom tools, Responses Lite, incremental tool-result continuation, persistent `ConversationSegmentStore` и turn affinity.

Ранее доказан restart gap: PR #7 persistent segment identity учитывает только Responses input, поэтому изменившийся tool/runtime contract может продолжить старую Notion-ветку. PR #8 уже независимо исправляет эту границу, добавляя prompt-policy/engineer instructions/tools/tool_choice/structured output в identity. Перед `NOTION_CORE_DONE` combined Core+Agent exact head обязан пройти restart → tool result regression; вручную копировать Agent fix в Core не нужно.

## Новый Core security blocker перед живым Codex probe

Fresh exact `tools/run_real_codex_cli_project_probe.py` создаёт временный Codex config с `env_key = "NOTION_BRIDGE_API_KEY"`, но без `shell_environment_policy`. Upstream Codex сейчас по умолчанию использует `inherit=all` и `ignore_default_excludes=true`; следовательно model-reachable shell может унаследовать launcher environment, включая bridge key.

Подготовлен bounded integration-only patch:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Он не меняет NOTION_AGENT архитектуру. Локальная проверка на точной текущей семантике Codex показала, что `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый `AWS_SECRET_ACCESS_KEY` после этой политики не попадают в shell. Вердикт `CODEX_PROBE_SHELL_ENV_POLICY_CANDIDATE_PASS`.

Материалы:
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy.json`;
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy_candidate.patch`.

Из-за ZERO-MINUTE PR #8 не мутировался: его push может запустить hosted CI. До применения/локальной проверки этого patch настоящий Codex/Notion probe не запускать.

## Следующий порядок

1. Восстановить текущий v4 `LATEST`, затем read-only проверить Windows digest; не перезапускать.
2. Если всё ещё pending: materialize exact свежий PR #8 probe, применить shell-env hardening локально, targeted offline contract; затем combined restart/tool-result harness и rollback invariants.
3. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore reparse/overwrite proof; без нового fanout.
4. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery без повторного локального side effect.

PR #7/PR #8 product branches в этом проходе не менялись; hosted CI и provider traffic не запускались.
