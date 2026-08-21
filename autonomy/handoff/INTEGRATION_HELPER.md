# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 02:40 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежие головы источников

- Qwen PR #6: `3b8206eefbf319957c12a0ef46ed31fdf74801f8`.
- Notion PR #8: `9cd1a98ee1d1c85a9d3650c6d756852810a055f3`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Reliability-head `bfc8805395d4dfef13d63b089a007a1a64637848` проверен: он является предком текущего Qwen PR head на 3 коммита, поэтому расхождения handoff не означают потерю его последних fixes.

## Новое 1 — общий лимит дочерних Notion-агентов ломается при rebind

`ServerSubagentLifecycle` создаёт отдельный `SubagentLifecycle(maximum_parallel)` для каждого поколения пула, а `rebind_pool_and_drain()` публикует новое поколение до завершения старого. Поэтому `maximum_parallel=2` во время overlap допускает 2 старых + 2 новых provider-вызова одновременно.

Offline reproduction: peak `4` при configured max `2`.

Минимальный безопасный контракт: один server-wide semaphore поверх всех поколений. Важно захватывать/учитывать entrypoint до ожидания permit, чтобы drain по-прежнему не мог закрыть старый pool под уже начавшим launch ребёнком.

Материалы:
- `autonomy/v3/tools/integration_notion_rebind_global_parallelism_probe.py`;
- `autonomy/evidence/integration/20260821T0240Z_notion_rebind_global_parallelism_overbook.json`;
- `autonomy/v3/candidates/NOTION_SERVER_SUBAGENT_GLOBAL_PARALLELISM_GATE_20260821.patch`.

Владельцу Notion Agent: интегрировать только после сверки свежего `server_subagent_lifecycle.py`; это отдельный rebind/capacity boundary и не заменяет уже найденный same-account overlap across generations.

## Новое 2 — persisted Qwen subagent не замечает изменение содержимого selected skill

Persisted signature Qwen включает имена skills, prompt, mode/model/session/settings и owner-prompt hash, но не fingerprint фактического текста selected skill. При этом `buildTechnicalSkillBlock()` перечитывает текущий skill body при запуске.

Offline reproduction: тот же task/batch/session и то же имя `debug-repair`, но другой body skill → текущая persisted signature остаётся той же.

Риск: старый `done` может resume как будто под текущей политикой, а explicit retry uncertain-задачи может пройти под изменившимися техническими инструкциями без signature mismatch.

Минимальный контракт: для задач с выбранными skills включить в execution signature SHA-256 exact rendered technical skill block по каждому task id. Хранить только hash. Для задач без skills не добавлять пустое поле, чтобы не ломать их старую signature shape.

Материалы:
- `autonomy/v3/tools/integration_qwen_persisted_skill_content_fingerprint_probe.js`;
- `autonomy/evidence/integration/20260821T0240Z_qwen_persisted_skill_content_fingerprint_gap.json`;
- `autonomy/v3/candidates/QWEN_SUBAGENT_SKILL_CONTENT_SIGNATURE_20260821.patch`.

Владельцу Qwen Core: это отдельный restart/policy-drift boundary, не дубль текущей работы по persisted status/result conflict и retry diagnostics.

## Ранее открытые интеграционные стыки, не потерять

Сохраняются старые findings из предыдущей capsule: parent-scoped child identity; stable Qwen taskId/batchId/sessionPrefix across restart; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; max-turn mismatch Notion 24 vs Qwen 12; успешный Qwen result с пустым text; cross-parent bare task_id conflict; overlap одного логического Notion account между поколениями пула.

Не дублировать их новым большим rewrite: владельцы основных веток должны брать по одному минимальному contract/regression fix.

## Ограничения

Hosted CI, GitHub Actions, CircleCI, Cloudflare, native Windows, live Qwen/Notion/Codex, production, реальные данные, аккаунты и секреты не использовались.

## Постоянная память

Новая проверенная v4 capsule: `20260821T024359Z-e0040adf1b`, archive SHA-256 `378655bc8b376ae3a86664b63394e5239bb05c1b7afa037d2ec3120a7a98af15`.

`LATEST.json` опубликован через CAS от стартового Git blob `04d941f8ba27ff5204c0edcc4760de9f68b8c016`; новый blob `020ea7e5f77af58c5adad2c696afced7490d404a`. Предыдущий LATEST сохранён в `PREVIOUS.json`.
