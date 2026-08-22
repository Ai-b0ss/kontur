# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 02:xx MSK.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Fresh exact head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.
- Parent `f588e9706e69ab84965099190323bbfbde6bd557` содержит substantive durable tombstone fix/tests; `ee0ae241...` меняет только текст ожиданий cancellation lifecycle.
- Core/NCM28 без отдельной стыковой необходимости не менять.

## No-replay / tombstone — закрытый серьёзный boundary
На exact head `ee0ae241...` уже доказан локальный кластер:
- mandatory post-replace sync regression — 6/6 PASS;
- tombstone/path-safety cluster — 16/16 PASS;
- вместе с cancellation — 20/20 PASS;
- вместе с restart lifecycle — 22/22 PASS.

Без нового серьёзного воспроизводимого контрпримера этот модуль дальше не полировать. Приоритет — composition/materialization.

## Exact frozen pair — byte bridge закрыт локально, publication path теперь доказан
Frozen preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`.

Isolated exact local materialization уже дал:
- account-pool transformed Git blob: `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- server transformed Git blob: `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`;
- оба compile PASS;
- focused dynamic routing semantics 3/3 PASS.

Fresh tool-surface audit этого прохода закрыл старую проблему «нельзя атомарно опубликовать два больших файла»: GitHub connector реально предоставляет low-level `create_blob -> create_tree(base_tree) -> create_commit(parent) -> update_ref(force=false)`. Поэтому после повторной локальной материализации exact bytes можно создать оба blobs, один tree и один commit, а product ref сдвинуть единственным fast-forward. Force-write не нужен.

НО: сейчас product ref НЕ двигать до локального combined green и соблюдения Circle gate policy. `payload/server.py`/`payload/account_pool.py` в PR #8 всё ещё frozen old pair; ordinary `/v1/responses` ещё не считать materialized.

## Delegated prompt policy — gap подтверждён, минимальный контракт локально доказан
Fresh source подтверждает: `DelegationRequest` и `DelegationContext` на `ee0ae241...` пока не несут explicit engineer/owner policy.

Минимальный кандидат проверен локально 5/5:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- приватный owner prompt хранится только как runtime field с `repr=False`;
- `delegated_conversation_key()` не зависит от текста owner prompt и не содержит его;
- `DelegationContext` передаёт prompt policy адаптеру, но не печатает private prompt в repr;
- engineer-mode принудительно отбрасывает dormant `owner_system_prompt`;
- неверный mode/type fail-closed.

Этот кандидат пока НЕ записан в product branch: по owner/controller порядку сначала pair materialization + combined green; затем минимальный prompt-policy patch на тех же exact bytes, без отдельной архитектурной ветки.

## Постоянная память v4
Стартовый `LATEST` fresh-read:
- pointer blob `2d0b969a1258a9113fd1ad782298dbfa6190e663`;
- capsule `20260822T220058Z-f18a1b833d`;
- archive SHA-256 `2c35fee3733febee956e7a5c2c038edfac30bac41ed6955a021f220450cc89a9`.

Manifest и все пять immutable parts перечитаны через GitHub. В текущем hosted runtime не удалось честно передать part-0000 из connector response в локальный v4 без изменения байтов; это ограничение транспорта между connector и Python, а не доказательство порчи GitHub capsule. Поэтому unknown bytes не реконструировались, `LATEST`/`PREVIOUS` не менялись и новый pointer не публиковался.

## CircleCI
`autonomy/ci/CIRCLECI_GATE_POLICY.md` fresh-read: CircleCI разрешён только как bounded final evidence, не как цикл разработки. Старый Agent gate устарел. Новый disposable `ci/notion-agent-final-gate` — только после exact product pair commit/readback и объединённого локального green на одном SHA. Linux PASS не заменяет последующий Core native-Windows proof.

## Следующий точный шаг
1. Fresh-read PR #8 head; при новом head re-freeze, не писать поверх параллельного писателя.
2. На disposable exact checkout повторно materialize frozen pair и получить exact bytes/blobs `c9ca6f3b...` + `ba52edc7...`.
3. Прогнать combined local prompt/routing/reservations/failover/delegation/tool-loop/lifecycle/tombstone cluster на materialized bytes.
4. Если green, применить минимальный delegated prompt-policy contract и его локальные тесты; повторить релевантный combined cluster.
5. Создать оба product blobs через GitHub low-level API, один tree поверх fresh parent tree и один commit. Перед `update_ref` ещё раз fresh-read PR head. Сдвигать product ref только `force=false` и только если parent всё ещё exact; иначе detached commit оставить как evidence и принять нового писателя.
6. Readback committed `server.py`/`account_pool.py`, сверить exact blobs, compile и повторить combined local cluster.
7. Только после stable exact local green — один disposable Agent final gate.
8. Передать Core exact Agent head/blobs/tests через этот handoff + `kontur#9`; затем composed/native-Windows acceptance. Live Notion/Codex, secrets и production до этих gates не трогать.
