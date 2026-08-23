# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 08:xx MSK.

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
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` (size 43173);
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` (size 112748).

Изолированная exact materialization уже доказала ожидаемые результаты:
- account pool transformed blob `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- server transformed blob `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`;
- compile PASS;
- focused routing semantics 3/3 PASS: A transport fail -> B late-reserved -> 0 provider calls through B -> C fresh recovery; late reservation before first provider attempt; correction failover without replaying completed round1.

Fresh `fetch_blob` в этом проходе всё ещё дал 404 для `c9ca6f3b...` и `ba52edc7...`: exact transformed pair пока не существует как fetchable immutable Git objects. Product pair не публиковалась и PR #8 ref не двигался.

## OWNER TEMPORARY CIRCLE FREEZE — активен
Fresh controller issue #9 содержит прямой owner freeze: до отдельной разморозки запрещено запускать/двигать Circle gates для Notion/Qwen/Kontur. Поэтому **не двигать PR #8 product ref**, если обычный push способен запустить Circle. Low-level Git blob/tree/commit surface решает атомарность, но не отменяет freeze. `[ci skip]` как неподтверждённый обход не использовать.

Безопасный путь до разморозки: exact transformed pair сохранить content-addressed/immutable без обновления product ref; Core может использовать эти байты для V50/composed local proof. После явной разморозки — один fast-forward product ref update с exact readback, затем bounded final gates.

## Delegated prompt policy — три immutable candidate blobs без движения ref
Fresh source на `ee0ae241...` всё ещё не переносит explicit `engineer|owner` policy в дочерний envelope/model prompt.

Минимальный контракт сохранён в трёх **unreferenced content-addressed Git blobs**, без branch/ref movement и без Circle trigger:
- candidate `payload/delegation_policy.py` blob `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- candidate `payload/delegation_dispatcher.py` blob `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- candidate `payload/notion_delegated_model_step.py` blob `f36e9c91355dec667173b6265dd550554fb0f05d`.

Все три blob перечитаны через GitHub `fetch_blob`. Третий blob сохраняет доказанный смысл: первый полный Notion child prompt в owner-mode начинается непосредственно с приватного owner prompt; инженерная персона перед ним отсутствует; runtime/tool facts идут после нейтральной границы; incremental continuation не вставляет owner prompt повторно в уже существующий remote thread. Эти blobs пока **не входят ни в один branch/commit** и не являются product state.

Доказанный контракт:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится runtime field с `repr=False`;
- `delegated_conversation_key()` не зависит от owner text и не содержит его;
- engineer-mode отбрасывает dormant owner text;
- bad mode/type fail-closed;
- первый полный Notion child prompt в owner-mode начинается ровно с приватного owner prompt, без префикса инженерной персоны;
- tool/runtime facts идут только после нейтральной границы;
- engineer-mode сохраняет текущую subagent persona и не включает dormant owner text.

Не публиковать этот контракт отдельной архитектурной веткой: интегрировать минимально вместе с materialized/composed pair и затем прогнать combined Agent cluster. Перед product integration на exact candidate bytes нужен локальный compile/contract readback; unreferenced blob сам по себе не считается product PASS.

## Gate coverage
Core fresh audit обнаружил: текущие обычные Circle Agent suites не включают обязательный `tests/test_subagent_tombstone_post_replace_sync_failure.py`. Будущий disposable Agent/composed gate обязан включить его явно вместе с tombstone/restart/cancellation cluster; иначе green не является финальной приёмкой.

## Постоянная память v4 — завершена штатно
Стартовый нормативный указатель этого прохода:
- `LATEST` blob `bdd3c0767305f11d14ac2d64361ce6a6b0557362`;
- capsule `20260823T023849Z-863c6be6bb`;
- archive SHA-256 `4291103723b0c01f316bedd3c01e5f0616208cc827e35ead81e6c96b0f33ee56`;
- manifest v4 = 13 immutable parts.

На старте все 13 parts были перечитаны по exact Git blobs и локально проверены: длина и SHA-256 каждого part совпали с manifest; собранный archive имеет size 9430 и exact SHA-256 `4291103723b0c01f316bedd3c01e5f0616208cc827e35ead81e6c96b0f33ee56`. Канонический `capsule_runtime_v4.py` восстановлен с exact Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; `verify` и `restore` дали PASS.

После существенной работы создана новая capsule:
- `20260823T055121Z-d2a954b7b5`;
- archive SHA-256 `36d1b293f7ca6dfaad57e5c1cc8a7f4c58ca524584bf154605d3385a491fe901`;
- archive size 9441;
- 13 immutable parts, все reread Git blob SHA/size совпали с локально рассчитанными;
- manifest blob `d835513894c31c73204c96ccf7876d7d4da257ba`, reread совпал;
- immutable capsule upload commit `1abd76f6b4403e5b1d8ab71e4ba240a134ebf91d`.

Старый `LATEST` сохранён как `PREVIOUS` CAS-обновлением. Перед публикацией новый `LATEST` был ещё раз перечитан и оставался на исходном blob `bdd3c076...`; затем опубликован CAS-обновлением без force. Текущий `LATEST` blob `bfcc0ca196d141c1e5309c596e45e47ec9406823` и указывает на `20260823T055121Z-d2a954b7b5`. Unknown bytes не реконструировались.

## Следующий точный шаг
1. Fresh-read PR #8; при новом head re-freeze.
2. Не открывать снова no-replay/tombstone без нового серьёзного reproducer.
3. Текущий главный blocker Core V50: получить exact transformed pair `c9ca6f3b...` + `ba52edc7...` как fetchable immutable Git blobs без product-ref movement. Fresh `fetch_blob` пока 404 для обоих.
4. Использовать только exact frozen preimages и канонический `materialize_agent_wiring_with_tombstones.py --check/apply`; после materialization сделать readback/compile и combined prompt/routing/reservations/failover/delegation/tool-loop/lifecycle/tombstone cluster.
5. На тех же composed bytes минимально подключить три immutable delegated prompt-policy candidate blobs и повторить owner/engineer contract; private text не должен попадать в identity/logs.
6. После materialized Agent green передать Core exact Agent blobs/tests через этот handoff + issue #9 для V50/composed Stage-B local/native-Windows proof.
7. Пока owner Circle freeze активен: Circle branches/jobs = 0 и PR #8 ref не двигать. После явной разморозки — fast-forward exact product commit/readback, затем один disposable Agent gate; Linux PASS не заменяет Core native-Windows proof.
8. Live Notion/Codex, secrets, production — только после local composed + Windows gates.
