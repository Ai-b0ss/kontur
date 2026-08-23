# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 11:xx MSK.

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

Agent ранее независимо получил эти SHA и compile PASS. Core независимо повторил обе материализации по тем же frozen preimages и exact transformers и получил те же Git blob SHA. Core evidence: `autonomy/evidence/notion/20260823T0658Z_exact_agent_server_materialization.json`.

Следствие: прежний blocker «Core не может получить exact transformed Agent pair» снят. Core может строить V50 byte-identical disposable tree непосредственно из frozen preimages + transformers. PR #8 ref при этом не двигался.

## Routing/failover semantics, уже доказанные Agent
Focused local semantics остаются 3/3 PASS:
- A transport fail -> B поздно зарезервирован чужой tool-chain -> 0 provider calls через B -> C fresh recovery;
- late reservation перед первой provider-попыткой не пропускает старую account-sensitive operation;
- correction failover не повторяет уже завершённый первый model round.

При смене provider account старый Notion thread не переносится: replacement использует полную локальную историю и новый thread. Pending transport evidence сохраняется через routing correction и закрывается фактическим исходом recovery.

## Delegated prompt policy — exact bytes теперь достижимы из канонического control repo
Fresh PR #8 source пока не переносит explicit `engineer|owner` policy в delegated envelope/model prompt. Текущие source blobs:
- `payload/delegation_policy.py` = `cc50fc7373578262e6051e76716563a98f8f4935`;
- `payload/delegation_dispatcher.py` = `e888c87262d4307a0c5a7de9e315e01601f20a33`;
- `payload/notion_delegated_model_step.py` = `7d38b09be4c80d6ae531cd2282385e36dd5a57df`.

Ранее доказанные candidate bytes теперь сохранены как обычные достижимые файлы в канонической control-ветке, причём readback Git blob SHA полностью совпадают с исходными content-addressed blobs:
- `autonomy/evidence/notion/20260823T0740Z_delegated_prompt_candidate/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `.../delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `.../notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`.

Добавлен exact disposable materializer:
- `autonomy/evidence/notion/20260823T0750Z_delegated_prompt_policy_composition_materializer.py` = `39e56802f7a368750cc902ce6f98b086d9133956`.

Он fail-closed проверяет три текущих product preimage blob, три exact candidate blob, компилирует все candidate modules до первой записи; `--check` ничего не меняет, `--apply` предназначен только для disposable composed tree и после замены повторно сверяет Git blob SHA. Product refs этим инструментом не двигаются.

Контракт candidate:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится только runtime-полем с `repr=False`;
- `delegated_conversation_key()` не зависит от private prompt и prompt mode и не содержит их;
- engineer-mode выбрасывает dormant owner text;
- bad mode/type fail-closed;
- первый полный Notion child prompt в owner-mode начинается ровно с private owner prompt, без инженерной персоны перед ним;
- tool/runtime facts идут после нейтральной границы;
- incremental continuation существующего remote thread не вставляет owner prompt повторно;
- engineer-mode сохраняет текущую subagent persona.

### Новый найденный стыковой дефект: policy терялась до dispatcher
Fresh `payload/subagent_entrypoint.py` blob `ff489004c4ff8f195eea028f6b1e314feb57408d` и `payload/server_subagent_lifecycle.py` blob `96b07cf8e8069586b33b516a1d66e38b6439a4f9` всё ещё содержат только `task_id/parent/objective/target/max_model_turns`. Поэтому даже после замены трёх policy/model-step файлов реальный `ServerSubagentLifecycle.launch()` создавал бы `DelegationRequest` с дефолтным `engineer`, а owner prompt до dispatcher вообще не доходил.

Под это подготовлена fail-closed exact wiring-пара без движения refs:
- materializer Git blob `53253d43d29b90b0bc925d5321e26b940342e9fc`;
- static regression blob `1a7603925f9f6d545600eca84f20958b9c9811a3`;
- exact transformed `subagent_entrypoint.py` blob `aebefce4ff3e47efc9813ce4e49e70ca8c44972f`;
- exact transformed `server_subagent_lifecycle.py` blob `f47838b338f2bd94163cf466110f939c065ac041`;
- focused runtime propagation test blob `9a896a78879630c91ab3c87cd03ffca491a19a54`.

Локально:
- materializer regression 4/4 PASS, включая fail-closed drift для обоих frozen preimages;
- exact preimages вручную/побайтово сверены по Git blob SHA;
- exact transformed modules компилируются;
- runtime propagation 3/3 PASS: owner prompt проходит `SubagentLaunch -> SubagentEntryPoint -> DelegationRequest/Context`, затем сохраняется через `ServerSubagentLifecycle` validation/rebuild; private bytes не появляются в `repr`; engineer-mode выбрасывает dormant owner text.

Эти blobs пока unreferenced и не являются product state. Их нужно добавить в тот же disposable composed tree вместе с тремя delegated prompt-policy candidate files; отдельную product-ветку под них не создавать.

Кандидат всё ещё не является product state. Его нужно включить в тот же disposable V50/composed tree и на тех же bytes повторить owner/engineer contract + общий Agent/Core cluster.

## OWNER TEMPORARY CIRCLE FREEZE — активен
Controller comment `5384843976` от 2026-08-23 явно сохраняет Notion freeze: проект `notion-agent-bridge` в Circle ещё не подтверждён/подключён; `free-fabric-gpt-bridge` нельзя считать тем же проектом.

Пока нет отдельной owner-разморозки:
- CircleCI/GitHub Actions = 0 запусков;
- не двигать PR #8 и Notion gate refs;
- `[ci skip]` не использовать как обход;
- live Notion/Codex, secrets и production не трогать.

Если полный local composed cluster станет зелёным, зафиксировать exact SHA/state как `READY_FOR_CIRCLE_AFTER_RECONNECT` и продолжать полезную локальную работу. Native Windows Server 2022 gate разрешён только после local composed green и отдельной owner-разморозки.

## Gate coverage
Обычный Agent Circle suite сам по себе не финален: он не включает mandatory `tests/test_subagent_tombstone_post_replace_sync_failure.py`. Финальная composed-матрица обязана включать его вместе с tombstone/restart/cancellation, prompt policy, routing/failover, strict Core intent/finalize, exact replay, stream/non-stream/disconnect и `verify_notion_final_gate_coverage.py` PASS.

## Постоянная память v4
На старте текущего Agent-прохода нормативно восстановлен current `LATEST`:
- pointer blob `bfcc0ca196d141c1e5309c596e45e47ec9406823`;
- capsule `20260823T055121Z-d2a954b7b5`;
- archive SHA-256 `36d1b293f7ca6dfaad57e5c1cc8a7f4c58ca524584bf154605d3385a491fe901`;
- 13 immutable parts;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- все 13 parts повторно сверены по длине/SHA, archive SHA совпал, `verify` + `restore` PASS.

После существенной работы новый pointer публиковать только после полного `checkpoint -> pack v4 -> immutable upload -> readback/verify -> reread LATEST -> CAS`; при любом несовпадении pointer не двигать.

## Следующий точный шаг
1. На disposable V50 tree собрать byte-identical Agent pair `c9ca6f3b.../ba52edc7...` из frozen preimages + exact transformers и frozen Core inputs.
2. На том же tree применить delegated prompt-policy composition (`fd9a.../a9d.../f36e...`) и новый launch/lifecycle wiring (`aebe.../f478...`); materializer `53253...` должен сначала PASS в `--check` на exact preimages.
3. Прогнать полный local composed Agent+Core cluster, включая runtime propagation 3/3 и mandatory post-replace tombstone regression; `verify_notion_final_gate_coverage.py` обязан PASS.
4. Сохранить exact composed bytes/evidence долговечно, не двигая product refs во время Circle freeze. Если всё зелёное — пометить `READY_FOR_CIRCLE_AFTER_RECONNECT` с exact composed SHA/blobs.
5. После отдельной owner-разморозки — один disposable native Windows Server 2022 gate. Linux PASS не заменяет Windows.
6. Только после Windows PASS — bounded authorized `Codex -> bridge -> Notion -> local tool -> correction -> VERIFY_OK`, затем restart/replay/rotation/affinity и owner-facing Windows doctor.

В этом Agent-проходе PR #8, PR #7, CircleCI/GitHub Actions, live Notion/Codex, secrets и production не менялись.