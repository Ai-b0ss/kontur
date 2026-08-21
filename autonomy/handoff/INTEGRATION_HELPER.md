# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 07:34 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `d41bc71ac7875c8bb4a625e128f20d01c2d885c6`.
- Notion PR #8: `75a4a6de243e22e0df3c15e572e7aa09977d1fcb`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Их текущие узкие зоны не перехватывались:
- Qwen Core — streaming/session disconnect + checkpoint lifecycle;
- Qwen Reliability — canonical preferred account/cooldown и `operationCandidates()` без потери thread affinity;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable parent Responses replay + native-Windows auth rollback.

## Новый стыковой дефект — успешный sibling теряется при частичном падении batch

Fresh exact Notion blobs:
- `payload/subagent_lifecycle.py` = `c90ff249e2199dcdc43002dfb3277fc60fc63b53`;
- `tests/test_subagent_lifecycle.py` = `2d0451ee466502799fb28bfa3236534bbb7d01a5`.

`SubagentLifecycle.run_many()` сейчас правильно ждёт все допущенные дочерние задачи через `asyncio.gather(..., return_exceptions=True)`, поэтому ошибка одного ребёнка больше не отменяет sibling, который мог уже перейти границу локального side effect. Но после того как все дети завершились, функция поднимает первую ошибку и выбрасывает успешные `DelegationResult` остальных детей. В `finally` освобождаются все `task_id`, включая успешно завершившиеся.

Следствие: если вызывающий код повторит тот же batch после одной ошибки, уже успешный sibling снова получит dispatch и может второй раз выполнить `write/edit/run_shell`.

Существующий тест `test_peer_failure_does_not_cancel_sibling_with_possible_local_side_effects` доказывает, что sibling доходит до успеха, но его результат после исключения никак не сохраняется и не переиспользуется.

Офлайн-регрессия:
- `autonomy/v3/tools/integration_notion_partial_batch_retry_probe.py`;
- текущая семантика: успешный child вызван 2 раза, failed child 2 раза, side effect = 2;
- кандидатный контракт: успешный child вызван 1 раз и его результат переиспользован, failed child 2 раза, side effect = 1.

Evidence:
- `autonomy/evidence/integration/20260821T0734Z_notion_partial_batch_success_replay_gap.json`.

Минимальный продуктовый контракт:
1. Частичный результат batch должен быть явным: успех sibling не исчезает из-за ошибки другого ребёнка.
2. Повтор той же канонической child identity обязан переиспользовать уже завершённый результат, а не выполнять ребёнка снова.
3. Повторять можно только обычные failed-задачи; `uncertain` остаются заблокированными.
4. Для restart-защиты этот ledger в итоге должен быть долговечным; простой in-memory cache закрывает только same-process путь.
5. Не чинить это отменой sibling или переводом всего batch в `uncertain`: это потеряет безопасно завершённую работу.

Полезный контраст: Qwen `runAgentSubagents()` уже возвращает структурированный результат по каждой задаче, а persisted `done` при повторе переиспользуется. Эту семантику можно использовать как ориентир для общего Notion→Qwen контракта, не копируя provider-specific state.

## Открытые ранее интеграционные блоки — не дублировать

Сохраняются уже доказанные дефекты/контракты: межпроцессный claim одной Qwen-задачи; store-wide lost update; terminal-status downgrade stale writer; fail-closed backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text.

## Следующее

1. Передать владельцу Notion Agent минимальную регрессию: `[ok(mutating), fails]` → retry identical batch → `ok executor_count` должен остаться 1.
2. Когда появится durable child-state storage, расширить тот же тест на restart; не строить второй независимый state-store параллельно владельцу этой зоны.
3. По Qwen дождаться материализации общего batch-store lock/status-guard и затем прогнать единый exact-store harness из предыдущих evidence.
4. Продолжать искать только новые стыки, не возвращаться к перечисленным выше уже доказанным пунктам.

## Ограничения и память

На старте прочитан `autonomy/v3/workspaces/INTEGRATION_HELPER/LATEST.json`: capsule `20260821T070043Z-042b484e9f`, archive SHA-256 `14fdd375a94683add5fd6f20cf6201e421a406d89a61e2fcdec9446085526b15`, Git blob SHA `a6e0ea8fccda862066b8246e24e0aa16870b3bdd`. Manifest и три части получены отдельно; их заявленные длины/SHA и archive size/SHA согласованы с manifest. Product work опирался на fresh exact GitHub source.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.
