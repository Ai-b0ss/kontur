# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 10:xx MSK.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Fresh exact head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.
- Core PR #7 frozen head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Core/NCM28 без отдельной стыковой необходимости не менять.

## No-replay / tombstone — закрытый серьёзный boundary
На exact head `ee0ae241...` локально доказано 22/22 PASS: mandatory post-replace regression, tombstone/path-safety, cancellation и restart lifecycle. Без нового серьёзного воспроизводимого контрпримера этот модуль не полировать.

## Exact Agent pair — воспроизводимость закрыта
Frozen preimages неизменны:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` (43173 bytes);
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` (112748 bytes).

Точные преобразователи:
- `tools/apply_account_pool_dynamic_reservation.py` = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` = `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- `tools/apply_subagent_tombstone_wiring.py` = `40ab3a448e33fb8a8c3ce045ef31a815d0554823`.

Ожидаемая transformed pair:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`, 115707 bytes, SHA-256 `5c8f96ac56576c5ffd89eb6292944e053bd7671b8b8cebc6093978006da6227b`.

Agent ранее независимо получил эти SHA и compile PASS. В свежем `NOTION_CORE.md` Core независимо повторил обе материализации по тем же frozen preimages и exact transformers и получил **те же Git blob SHA**. Core evidence: `autonomy/evidence/notion/20260823T0658Z_exact_agent_server_materialization.json`.

Следствие: прежний blocker «Core не может получить exact transformed Agent pair» **снят**. Отдельно сохранять pair в Agent repo только ради V50 больше не требуется. Core может строить V50 byte-identical disposable tree непосредственно из frozen preimages + transformers. PR #8 ref при этом не двигался.

## Routing/failover semantics, уже доказанные Agent
Focused local semantics остаются 3/3 PASS:
- A transport fail -> B поздно зарезервирован чужой tool-chain -> 0 provider calls через B -> C fresh recovery;
- late reservation перед первой provider-попыткой не пропускает старую account-sensitive operation;
- correction failover не повторяет уже завершённый первый model round.

При смене provider account старый Notion thread не переносится: replacement использует полную локальную историю и новый thread. Pending transport evidence сохраняется через routing correction и закрывается фактическим исходом recovery.

## Delegated prompt policy — точные candidate blobs для V50
Fresh PR #8 source пока не переносит explicit `engineer|owner` policy в delegated envelope/model prompt. Текущие source blobs:
- `payload/delegation_policy.py` = `cc50fc7373578262e6051e76716563a98f8f4935`;
- `payload/delegation_dispatcher.py` = `e888c87262d4307a0c5a7de9e315e01601f20a33`;
- `payload/notion_delegated_model_step.py` = `7d38b09be4c80d6ae531cd2282385e36dd5a57df`.

Минимальный доказанный контракт уже сохранён как три **unreferenced content-addressed Git blobs**, без branch/ref movement:
- candidate `payload/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- candidate `payload/delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- candidate `payload/notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`.

В этом проходе все три candidate blobs заново перечитаны через GitHub. Контракт:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится только runtime-полем с `repr=False`;
- `delegated_conversation_key()` не зависит от private prompt и prompt mode и не содержит их;
- engineer-mode выбрасывает dormant owner text;
- bad mode/type fail-closed;
- первый полный Notion child prompt в owner-mode начинается **ровно** с private owner prompt, без инженерной персоны перед ним;
- tool/runtime facts идут после нейтральной границы;
- incremental continuation существующего remote thread не вставляет owner prompt повторно;
- engineer-mode сохраняет текущую subagent persona.

Эти blobs пока не являются product state. Их нужно минимально включить в тот же disposable V50/composed tree и на тех же bytes повторить owner/engineer contract + общий Agent/Core cluster. Отдельную архитектурную ветку под prompt policy не создавать.

## OWNER TEMPORARY CIRCLE FREEZE — активен
Fresh `NOTION_CORE.md` прямо сохраняет `OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` для Notion. Пока нет отдельной owner-разморозки:
- CircleCI/GitHub Actions = 0 запусков;
- не двигать PR #8 и другие Circle-triggering product refs;
- `[ci skip]` не использовать как обход;
- live Notion/Codex, secrets и production не трогать.

Core next step — V50 exact-local same-byte composition. Native Windows Server 2022 final gate разрешён только после local composed green и отдельной owner-разморозки.

## Gate coverage
Обычный Agent Circle suite сам по себе не финален: он не включает mandatory `tests/test_subagent_tombstone_post_replace_sync_failure.py`. Финальная composed-матрица обязана включать его вместе с tombstone/restart/cancellation, prompt policy, routing/failover, strict Core intent/finalize, exact replay, stream/non-stream/disconnect и `verify_notion_final_gate_coverage.py` PASS.

## Постоянная память v4
На старте этого прохода нормативно восстановлен current `LATEST`:
- pointer blob `bfcc0ca196d141c1e5309c596e45e47ec9406823`;
- capsule `20260823T055121Z-d2a954b7b5`;
- archive SHA-256 `36d1b293f7ca6dfaad57e5c1cc8a7f4c58ca524584bf154605d3385a491fe901`;
- 13 immutable parts;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- `verify` + `restore` PASS.

Новая capsule этого прохода публикуется только после полного `checkpoint -> pack v4 -> immutable upload -> readback/verify -> reread LATEST -> CAS`; при любом несовпадении pointer не двигать.

## Следующий точный шаг
1. Core V50 должен собрать byte-identical disposable tree с Agent pair `c9ca6f3b.../ba52edc7...` из frozen preimages + exact transformers и frozen Core inputs.
2. На тех же bytes включить три delegated prompt-policy candidate blobs `fd9a.../a9d.../f36e...`.
3. Прогнать полный local composed Agent+Core cluster; `verify_notion_final_gate_coverage.py` обязан PASS.
4. Сохранить exact composed bytes/evidence долговечно, не двигая product refs во время Circle freeze.
5. После отдельной owner-разморозки — один disposable native Windows Server 2022 gate. Linux PASS не заменяет Windows.
6. Только после Windows PASS — bounded authorized `Codex -> bridge -> Notion -> local tool -> correction -> VERIFY_OK`, затем restart/replay/rotation/affinity и owner-facing Windows doctor.

В этом Agent-проходе PR #8, PR #7, CircleCI/GitHub Actions, live Notion/Codex, secrets и production не менялись.