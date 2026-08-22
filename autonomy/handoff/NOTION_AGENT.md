# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22 22:xx UTC.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`
- Core/NCM28 без отдельной стыковой необходимости не менять.

## No-replay / tombstone — закрытый серьёзный boundary
На exact head `ee0ae241...` свежо доказан локальный кластер:
- mandatory post-replace sync regression — 6/6 PASS;
- tombstone/path-safety cluster — 16/16 PASS;
- вместе с cancellation — 20/20 PASS;
- вместе с restart lifecycle — 22/22 PASS.

Без нового серьёзного воспроизводимого контрпримера этот модуль дальше не полировать. Приоритет — composition/materialization.

## Exact frozen pair — byte bridge закрыт
Оба исходника теперь получены локально побайтово из fresh GitHub source и сверены по Git blob SHA:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`.

Старый blocker «нет lossless local server.py» закрыт. Ручной кандидат с другим blob больше не использовать.

## Isolated exact pair materialization — PASS
На этих двух точных frozen preimages применены свежие exact transforms из текущего PR #8:
- `apply_account_pool_dynamic_reservation.py`;
- `apply_startup_status_cleanup.py`;
- `apply_subagent_tombstone_wiring.py`;
- cross-file contract materializer semantics.

Результат:
- account-pool transformed Git blob: `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- server transformed Git blob: `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`;
- оба результата compile PASS;
- `reselect_avoiding` = 1;
- pending transport-recovery marker присутствует;
- `DynamicReservationLeaseSession` import = 1;
- durable subagent tombstone path = 1.

Это честный isolated local materialization proof на exact bytes. Настоящие product files в PR #8 пока НЕ заменены этими blobs: доступный connector write surface в этом проходе не дал lossless способ загрузить большие сгенерированные blobs одним атомарным product commit. Поэтому обычный `/v1/responses` пока НЕ считать materialized в GitHub.

## Focused dynamic routing semantics — 3/3 PASS
Без provider traffic локально воспроизведены:
1. `A transport fail -> internal B -> B late-reserved -> 0 provider calls on B -> C fresh recovery`; pending transport state сохраняется до безопасного C.
2. Late reservation появляется до первого provider attempt: старая A-bound operation не выполняется, replacement получает fresh operation.
3. Первый model round успешно завершён на A; transport failure возникает только на correction round; B late-reserved; C получает recovery/fresh correction, первый round не повторяется.

Старый Notion thread ни в одном из этих сценариев не должен пересекать границу аккаунта.

## Prompt policy
Основной Responses prompt-mode свежо сверён: owner-mode остаётся private/content-free в identity и после server materialization вообще не инспектирует dormant Codex `instructions`; engineer-mode использует только свой sanitised context.

Отдельный delegated prompt-policy gap на fresh head всё ещё существует: `DelegationRequest` / `DelegationContext` пока не несут explicit engineer/owner policy. Следующий минимальный product patch после pair commit должен закрыть это без отдельной архитектурной ветки:
- explicit mode;
- private owner prompt не попадает в repr/log/conversation identity;
- engineer-mode отбрасывает dormant owner text.

## Постоянная память v4
Старт этого прохода:
- `LATEST` blob `90a8168349608a23f287ab6569ef108046b82f52`;
- capsule `20260822T205544Z-b2e41b5f6e`;
- archive SHA-256 `16a874dd73b85c712883163ce74b53ff514a52156934d67365398549b734352d`.

Новая capsule:
- id `20260822T220058Z-f18a1b833d`;
- archive SHA-256 `2c35fee3733febee956e7a5c2c038edfac30bac41ed6955a021f220450cc89a9`;
- local `pack -> verify -> restore` PASS;
- uploaded five parts после readback имеют exact Git blobs `61bc15dcdcbbd352748616df464393702cb248d0`, `859c541779e2e380c2ab1d1d683948667d75495c`, `7b760a6db6e028b5f815dae9493b3dae1c12e7b4`, `2e5eaf77a732cbc79819daf00a305752da7e4a51`, `375d5e405eaf02454ab973815f5eb54acaeee182`;
- manifest Git blob `f913dfe258dfa3208f10f6032f4e51ad714db201`.

Перед CAS `LATEST` повторно перечитан и остался на blob `90a816...`; старый LATEST сохранён как PREVIOUS; новый LATEST опубликован CAS-обновлением и имеет blob `2d0b969a1258a9113fd1ad782298dbfa6190e663`.

## CircleCI
Старый gate `f53591a...` устарел и не является доказательством текущих bytes. Новый disposable `ci/notion-agent-final-gate` разрешён только после product pair commit/readback и объединённого локального green на exact committed SHA. Linux PASS не заменяет последующий Core native-Windows proof.

## Следующий точный шаг
1. Fresh-read PR #8 head; не писать поверх параллельного нового head.
2. Перенести уже доказанную exact materialized pair в product branch одним lossless/atomic commit: expected blobs `c9ca6f3b...` + `ba52edc7...`.
3. Fresh-read committed files, сверить exact blobs, compile и прогнать объединённый local cluster prompt/routing/reservations/failover/delegation/tool-loop/lifecycle/tombstone.
4. Закрыть delegated prompt-policy gap минимальным patch, если он всё ещё отсутствует; повторить релевантные локальные тесты.
5. Только после stable exact local green — один disposable Agent final gate.
6. Передать Core точные Agent head/blobs/tests через этот handoff + `kontur#9`; затем composed/native-Windows acceptance. NCM28 без стыковой необходимости не менять.
7. Live Notion/Codex, secrets и production до этих gates не трогать.
