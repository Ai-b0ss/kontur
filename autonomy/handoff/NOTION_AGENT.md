# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 05:xx MSK.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Fresh exact head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.
- Core PR #7 frozen head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Core/NCM28 без отдельной стыковой необходимости не менять.

## No-replay / tombstone — закрытый серьёзный boundary
На exact head `ee0ae241...` локально доказано 22/22 PASS: mandatory post-replace regression, tombstone/path-safety, cancellation и restart lifecycle. Без нового серьёзного воспроизводимого контрпримера этот модуль не полировать.

## Exact frozen pair / materialization
Frozen preimages неизменны:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`.

Изолированная exact materialization уже доказала ожидаемые результаты:
- account pool transformed blob `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- server transformed blob `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`;
- compile PASS;
- focused routing semantics 3/3 PASS: A transport fail -> B late-reserved -> 0 provider calls through B -> C fresh recovery; late reservation before first provider attempt; correction failover without replaying completed round1.

Fresh `tools/materialize_agent_wiring_with_tombstones.py` и дочерние exact-transformers перечитаны. Они по-прежнему требуют frozen preimages и собирают base pair + durable tombstone wiring в guarded transaction. В текущем проходе product pair не публиковалась и PR #8 ref не двигался.

## OWNER TEMPORARY CIRCLE FREEZE — активен
Fresh controller issue #9 содержит прямой owner freeze: до отдельной разморозки запрещено запускать/двигать Circle gates для Notion/Qwen/Kontur. Поэтому **не двигать PR #8 product ref**, если обычный push способен запустить Circle. Low-level Git blob/tree/commit surface решает атомарность, но не отменяет freeze. `[ci skip]` как неподтверждённый обход не использовать.

Безопасный путь до разморозки: exact transformed pair сохранить content-addressed/immutable без обновления product ref; Core может использовать эти байты для V50/composed local proof. После явной разморозки — один fast-forward product ref update с exact readback, затем bounded final gates.

## Delegated prompt policy — gap локально закрыт кандидатом, product bytes ещё не перенесены
Fresh source `payload/delegation_policy.py` / `payload/delegation_dispatcher.py` / `payload/notion_delegated_model_step.py` на `ee0ae241...` всё ещё не переносит explicit `engineer|owner` policy в дочерний envelope и model prompt.

В этом проходе минимальный кандидат расширен до полного child envelope + provider prompt contract. Первый вариант намеренно пойман негативным тестом: граница owner-mode была записана с неверным escaping и не давала реальных переводов строк. После исправления объединённый локальный набор — **10/10 PASS**.

Доказанный контракт:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится runtime field с `repr=False`;
- `delegated_conversation_key()` не зависит от owner text и не содержит его;
- engineer-mode отбрасывает dormant owner text;
- bad mode/type fail-closed;
- первый полный Notion child prompt в owner-mode начинается **ровно с приватного owner prompt**, без префикса инженерной персоны;
- tool/runtime facts идут только после нейтральной границы;
- engineer-mode сохраняет текущую subagent persona и не включает dormant owner text.

Кандидат сохранён в новой v4 capsule в `candidates/delegated_prompt_policy/`. Не публиковать его отдельной архитектурной веткой: интегрировать минимально вместе с materialized/composed pair и затем прогнать combined Agent cluster.

## Gate coverage
Core fresh audit обнаружил: текущие обычные Circle Agent suites не включают обязательный `tests/test_subagent_tombstone_post_replace_sync_failure.py`. Будущий disposable Agent/composed gate обязан включить его явно вместе с tombstone/restart/cancellation cluster; иначе green не является финальной приёмкой.

## Постоянная память v4
Старт этого прохода:
- `LATEST` blob `01f43b35a93b62ccdc0402792baf2a71048c3665`;
- capsule `20260823T005431Z-9679490e09`;
- archive SHA-256 `8742a6159321761501f8c25e6f7b228607ab785d4def6a43c90acfd1230e100a`.

Стартовая capsule восстановлена нормативным v4 с PASS.

Новая capsule:
- id `20260823T023849Z-863c6be6bb`;
- archive SHA-256 `4291103723b0c01f316bedd3c01e5f0616208cc827e35ead81e6c96b0f33ee56`;
- 13 частей, все после immutable upload перечитаны через GitHub directory metadata и имеют ровно ожидаемые Git blob SHA/размеры;
- manifest перечитан отдельно, Git blob `eb0dcf8c2813b801d53fddabd2a600a5cd1c9edc` совпал с локальным;
- локальные `pack -> verify -> restore` через exact v4 tool blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f` — PASS;
- перед CAS старый `LATEST` повторно имел исходный blob `01f43b35...`; `PREVIOUS` сохранён на старую capsule;
- новый `LATEST` опубликован только CAS и подтверждён повторным чтением, blob `bdd3c0767305f11d14ac2d64361ce6a6b0557362`.

## Следующий точный шаг
1. Fresh-read PR #8; при новом head re-freeze.
2. Не открывать снова no-replay/tombstone без нового серьёзного reproducer.
3. На exact-checkout-capable local surface повторно materialize pair и подтвердить blobs `c9ca6f3b...` + `ba52edc7...`; canonical `materialize_agent_wiring_with_tombstones.py --check` обязателен.
4. Сохранить exact transformed bytes долговечно без product-ref movement, пока Circle freeze активен.
5. На тех же bytes интегрировать сохранённый минимальный delegated prompt-policy candidate и прогнать combined local prompt/routing/reservations/failover/delegation/tool-loop/lifecycle/tombstone cluster.
6. После materialized Agent green передать Core exact Agent blobs/tests через этот handoff + issue #9 для V50/composed Stage-B local/native-Windows proof.
7. Пока owner Circle freeze активен: Circle branches/jobs = 0 и PR #8 ref не двигать. После явной разморозки — fast-forward exact product commit/readback, затем один disposable Agent gate; Linux PASS не заменяет Core native-Windows proof.
8. Live Notion/Codex, secrets, production — только после local composed + Windows gates.
