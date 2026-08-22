# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 02:xx MSK.

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

Fresh `tools/materialize_agent_wiring_with_tombstones.py` read confirms it still composes base pair materialization plus durable subagent tombstone wiring and guarded transaction recovery/finalization.

## OWNER TEMPORARY CIRCLE FREEZE — активен
Fresh controller issue #9 содержит прямой owner freeze: до отдельной разморозки запрещено запускать/двигать Circle gates для Notion/Qwen/Kontur. Поэтому **не двигать PR #8 product ref**, если обычный push способен запустить Circle. Low-level Git blob/tree/commit surface решает атомарность, но не отменяет freeze. `[ci skip]` как неподтверждённый обход не использовать.

Безопасный путь до разморозки: exact transformed pair сохранить content-addressed/immutable без обновления product ref; Core может использовать эти байты для V50/composed local proof. После явной разморозки — один fast-forward product ref update с exact readback, затем bounded final gates.

## Delegated prompt policy — fresh gap и минимальный контракт
Fresh source `payload/delegation_policy.py` / `payload/delegation_dispatcher.py` на `ee0ae241...` всё ещё не переносит explicit `engineer|owner` policy в дочерний envelope.

Минимальный локальный кандидат повторно проверен 5/5 PASS:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится runtime field с `repr=False`;
- `delegated_conversation_key()` не зависит от owner text и не содержит его;
- engineer-mode отбрасывает dormant owner text;
- bad mode fail-closed.

Не расширять это в отдельную архитектурную ветку. Интегрировать минимально вместе с materialized/composed bytes, не допуская owner prompt в identity/log/repr.

## Gate coverage
Core fresh audit обнаружил: текущие обычные Circle Agent suites не включают обязательный `tests/test_subagent_tombstone_post_replace_sync_failure.py`. Будущий disposable Agent/composed gate обязан включить его явно вместе с tombstone/restart/cancellation cluster; иначе green не является финальной приёмкой.

## Постоянная память v4
Fresh start pointer:
- `LATEST` blob `2d0b969a1258a9113fd1ad782298dbfa6190e663`;
- capsule `20260822T220058Z-f18a1b833d`;
- archive SHA-256 `2c35fee3733febee956e7a5c2c038edfac30bac41ed6955a021f220450cc89a9`;
- `PREVIOUS` capsule `20260822T205544Z-b2e41b5f6e`.

Manifest fresh-read: five immutable parts; workspace contains only `CHECKPOINT.json` + `README.md`, so capsule не является byte bridge для transformed pair. В этом проходе новый pointer не публиковался: exact connector->local v4 byte restore/publish не был выполнен без ручной реконструкции неизвестных bytes. Старые LATEST/PREVIOUS оставлены нетронутыми согласно v2.

## Следующий точный шаг
1. Fresh-read PR #8; при новом head re-freeze.
2. На exact-checkout-capable local surface повторно materialize pair и подтвердить blobs `c9ca6f3b...` + `ba52edc7...`.
3. Сохранить exact transformed bytes долговечно без product-ref movement (v4/content-addressed handoff или unreferenced Git objects).
4. Прогнать combined local prompt/routing/reservations/failover/delegation/tool-loop/lifecycle/tombstone cluster на тех же bytes.
5. Добавить минимальный delegated prompt-policy contract и повторить релевантные local tests.
6. Передать Core exact Agent blobs/tests через этот handoff + issue #9 для V50/composed Stage-B local proof.
7. Пока owner Circle freeze активен: Circle branches/jobs = 0 и PR #8 ref не двигать. После явной разморозки — fast-forward exact product commit/readback, затем один disposable Agent gate; Linux PASS не заменяет Core native-Windows proof.
8. Live Notion/Codex, secrets, production — только после local composed + Windows gates.
