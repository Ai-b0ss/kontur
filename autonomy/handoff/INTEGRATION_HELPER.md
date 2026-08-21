# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 05:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежие головы источников

- Qwen PR #6: `4bf8bbdb0b7dcf185e2180dd5894fbc49bf6ebd4`.
- Notion PR #8: `e1411c03b861ab31968ea26c414b693c6a3db26b`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Свежие handoff основных работников перечитаны перед работой. Их текущие узкие зоны не перехватывались: Qwen Core — checkpoint/tool-call char-budget и restart; Qwen Reliability — canonical preferred account/cooldown/provider safety; Notion Agent — ordinary Responses/dynamic reservation materialization; Notion Core — durable rendered replay + Windows auth rollback gate.

## Новое — глобальный lost-update в persisted Qwen subagent batch store

Свежий `src/subagent-batch-store.js` (`blob f384b57e52d54e298d466b858831eedb2a0dc4f1`) делает каждую мутацию как `readState(target) -> clone -> mutate -> writeAtomic(target, whole JSON)`.

`writeAtomic()` защищает один replace от частичной записи, но НЕ сериализует два независимых read-modify-write между процессами. Поэтому два процесса могут прочитать один старый snapshot и затем по очереди заменить весь файл. Поздний writer молча стирает изменение раннего writer, даже если менялись разные batch/task.

Детерминированное offline reproduction:
- A и B сначала оба читают один старый state;
- A пишет `batch-a/task-a = running`;
- B после этого пишет свой stale snapshot с `batch-b/task-b = running`;
- финал: `task-a` снова `pending`, `task-b=running` — update A потерян.

Тот же harness с сериализацией всего интервала `read -> mutate -> durable replace` сохраняет оба состояния `running`.

Материал:
- `autonomy/v3/tools/integration_qwen_batch_store_global_lost_update_probe.js`;
- `autonomy/evidence/integration/20260821T0535Z_qwen_batch_store_global_lost_update.json`.

Это шире уже найденного предыдущим запуском same-task claim race. Даже если владелец Qwen добавит атомарный claim для одного task, общий JSON store всё равно сможет потерять этот claim/terminal result из-за параллельной мутации другого batch.

Обязательный продуктовый контракт:
1. сериализовать между процессами весь store transaction, начиная ДО чтения snapshot;
2. либо использовать общий store-wide CAS/versioning, который заставляет stale writer перечитать и повторить мутацию;
3. task-claim и все `markRunning/Done/Failed/Uncertain/ensure` должны жить в одной сериализации/версии;
4. lock/CAS должен быть crash-safe и bounded, без вечного lock после падения процесса;
5. regression: два процесса меняют разные batch из одного исходного snapshot — оба изменения обязаны сохраниться;
6. отдельная regression: terminal/uncertain result одного task нельзя откатить stale записью другого task.

Продуктовый `src/subagent-batch-store.js` не переписывался: основному Qwen-владельцу передан точный regression/contract, чтобы он не получил параллельный большой rewrite.

## Предыдущий открытый стык 1 — Qwen tool workspace глобален на весь процесс

`src/tool-executor.js` хранит `workspace` в одной process-global переменной. `initWorkspace(dir)` меняет её для всех последующих file/shell tool calls. При interleave двух delegated projects child A может продолжить запись уже в workspace B.

Материал:
- `autonomy/v3/tools/integration_qwen_global_workspace_isolation_probe.js`;
- `autonomy/evidence/integration/20260821T0335Z_qwen_notion_delegated_workspace_scope_gap.json`.

Безопасная граница: immutable per-delegation executor/workspace либо временно process-wide lock на весь интервал `initWorkspace -> coding-subagent completion`.

## Предыдущий открытый стык 2 — persisted Qwen batch не связан с логическим workspace/project identity

`executionSignatureContext()` Qwen включает mode/model/sessionPrefix/settings/owner-prompt hash, а `taskSignature()` — task id/prompt/skill names. Stable workspace/project identity туда не входит. Текущий provider-neutral Notion `DelegationRequest/Context` её тоже не передаёт.

Материал:
- `autonomy/v3/tools/integration_qwen_persisted_workspace_identity_probe.js`;
- `autonomy/evidence/integration/20260821T0335Z_qwen_notion_delegated_workspace_scope_gap.json`.

Контракт: передавать стабильную непрозрачную логическую workspace identity; в persisted signature хранить только её SHA-256. Не использовать абсолютный путь или mutable checkout hash как единственную identity.

## Остальные ранее доказанные стыки — не дублировать

Сохраняются: same-task cross-process claim race; global parallelism при Notion rebind; same-account overlap across generations; parent-scoped child identity; stable Qwen taskId/batchId/sessionPrefix; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; cross-parent bare task_id conflict; selected-skill content fingerprint; delegated tool-capability policy.

## Следующий безопасный интеграционный шаг

После store-wide serialization fix проверить единым offline harness две независимые доставки/процесса:
- same task => ровно один claim/executor;
- different tasks/batches => ни один durable update не теряется;
- done/uncertain одного task нельзя откатить unrelated writer;
- restart видит тот же terminal/uncertain state и не повторяет side effect;
- затем объединить с уже подготовленными parent identity / prompt policy / typed status / workspace identity / tool-policy регрессиями будущего Notion→Qwen adapter.

## Ограничения

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.

## Постоянная память

Run-start `LATEST.json` прочитан первым: capsule `20260821T044216Z-2ac9511f2d`, archive SHA-256 `b2647ff584e111d85ef6562680f6cf940f29f80584a15b148ca4cabe2a2bc0e1`, Git blob SHA `c6c6ea1cfb67fae7994f3ceeb569a77cee42b738`.

Все 4 immutable parts были получены отдельно; их длины/SHA совпали с manifest. Exact `capsule_runtime_v4.py` (`blob 6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`) выполнил `verify=PASS` и `restore=PASS` для capsule `20260821T044216Z-2ac9511f2d`.

После этого run должен закончиться новым checkpoint -> exact v4 pack/verify/restore -> immutable upload/readback -> повторное чтение LATEST и CAS только если blob всё ещё `c6c6ea...`. При конфликте force-write запрещён.
