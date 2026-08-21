# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 03:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежие головы источников

- Qwen PR #6: `ffd19b208da8be58f5de9d11c4240327b9e0ad81`.
- Notion PR #8: `1d80d4f2939b4c76a43313b722e4e80c1041564c`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Свежие handoff основных работников перечитаны перед работой. Их текущие узкие зоны не перехватывались: Qwen Core продолжает checkpoint/tool-pair trimming, Qwen Reliability — pool/provider/session safety, Notion Agent — materialization ordinary Responses/dynamic reservation, Notion Core — durable rendered replay + Windows auth rollback gate.

## Новое 1 — Qwen tool workspace глобален на весь процесс и ломает изоляцию параллельных делегированных проектов

Свежий `src/tool-executor.js` хранит `workspace` в одной process-global переменной. `initWorkspace(dir)` меняет её для всех последующих `resolveInsideWorkspace()`/file/shell tool calls.

Это безопасно только пока один Qwen-процесс обслуживает один workspace. Будущий Notion→Qwen adapter должен уметь запускать независимые дочерние задачи, а Notion lifecycle уже рассчитан на параллельность. Если child A выбрал project-A, затем уступил выполнение, child B переключил process-global workspace на project-B, то следующий `write_file/edit_file/bash` A разрешится уже относительно project-B.

Offline reproduction пройден:
- A ожидает project-A;
- B переключает глобальный workspace на project-B;
- последующий write от A создаёт файл в B;
- `a_has_file=false`, `b_has_file=true`, `cross_workspace_write=true`.

Кандидатный контракт с immutable per-delegation executor/workspace дал независимые A/B записи при намеренном interleave.

Материал:
- `autonomy/v3/tools/integration_qwen_global_workspace_isolation_probe.js`;
- `autonomy/evidence/integration/20260821T0335Z_qwen_notion_delegated_workspace_scope_gap.json`.

Минимальная безопасная интеграционная граница:
1. долгосрочно — tool executor должен быть привязан к workspace конкретной delegated session, а не к process-global переменной;
2. до этого будущий Qwen adapter обязан сериализовать весь интервал `initWorkspace -> coding-subagent completion` одним process-wide cross-workspace lock. Лочить только отдельный tool call недостаточно;
3. параллельные Qwen children разрешать только если у каждого immutable собственный executor/workspace binding.

## Новое 2 — persisted Qwen batch не связан с логическим workspace/project identity

`executionSignatureContext()` Qwen включает mode/model/sessionPrefix/settings/owner-prompt hash. `taskSignature()` добавляет task id/prompt/skill names. Stable workspace/project identity туда не входит.

Одновременно текущий provider-neutral Notion `DelegationRequest/DelegationContext` тоже не содержит workspace/project identity. Поэтому будущий deterministic adapter может получить один и тот же `taskId/batchId/sessionPrefix` для логически той же делегации, запущенной уже против другого проекта/workspace, а persisted Qwen state не увидит смену контекста.

Offline reproduction: при одинаковых task/context две разные логические рабочие области дают один текущий signature:
`71a28405f723f89aa3ed9dad081662e11cb42ce8e27750369aff7b2282f9b8e1`.

Кандидат с content-free `SHA-256(stable workspace identity)` в execution signature даёт разные signatures:
- project-A: `3c9716edf3501bb72a4514bc6d63309658e7e66804f4b28d050e7d0f324e86ec`;
- project-B: `bffaed0f8b44f7c9fb4c9269136205cea1187dc9ec1bf7cc212c18bd6e5abb2e`.

Материал:
- `autonomy/v3/tools/integration_qwen_persisted_workspace_identity_probe.js`;
- то же evidence `20260821T0335Z_qwen_notion_delegated_workspace_scope_gap.json`.

Контракт: родитель/агент передаёт стабильную непрозрачную логическую workspace identity; в persisted signature хранится только её SHA-256. Не использовать абсолютный путь как единственную identity — тот же проект может переехать на другой хост/путь после restart. Не использовать mutable checkout hash как единственную identity — сама агентная задача может менять рабочее дерево.

## Предыдущие открытые стыки — не дублировать

Сохраняются ранее доказанные findings: global parallelism при Notion rebind; same-account overlap across generations; parent-scoped child identity; stable Qwen taskId/batchId/sessionPrefix; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; cross-parent bare task_id conflict; selected-skill content fingerprint в persisted Qwen signature.

Владельцы основных веток должны забирать их по одному минимальному contract/regression fix, а не получать параллельный большой rewrite.

## Следующий безопасный интеграционный шаг

После того как Notion Agent материализует свежие delegation/server changes, проверить будущий Qwen adapter единым offline harness:
- parent-scoped task identity;
- prompt policy;
- typed status/uncertain;
- deterministic restart ids;
- stable workspace identity;
- two children against two logical workspaces без cross-write;
- persisted batch from workspace A must fail closed if replayed as workspace B;
- cancellation after possible side effect must not release automatic retry.

Сам продуктовый adapter до закрытия этих контрактов не писать большим rewrite.

## Ограничения

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.

## Постоянная память

Run-start `LATEST.json` был прочитан до работы: capsule `20260821T024359Z-e0040adf1b`, archive SHA-256 `378655bc8b376ae3a86664b63394e5239bb05c1b7afa037d2ec3120a7a98af15`, стартовый Git blob SHA `020ea7e5f77af58c5adad2c696afced7490d404a`.

Новая capsule этого запуска должна публиковаться только после checkpoint -> v4 pack/verify/restore -> immutable readback -> повторного чтения этого LATEST и CAS. При конфликте LATEST не перезаписывать.
