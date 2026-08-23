# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-23 12:xx MSK.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Fresh exact Agent head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.
- Fresh exact Core PR #7 head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Head drift в этом проходе не обнаружен.
- Core/NCM28 без отдельной стыковой необходимости не менять.

## Текущая Circle-policy — старый freeze superseded
Свежая controller/owner policy в `Ai-b0ss/kontur#9` отменяет старое утверждение «Notion Circle не подключён / freeze из-за connectivity».

Notion Circle connectivity уже ДОКАЗАНА clean reconnect probe:
- commit `4d653d48...`;
- workflow `a607e5f4...`;
- job `73eb077f...`.

Это только доказательство доступности исполнителя. Оно НЕ меняет порядок гейтов. Тяжёлый native Windows пока не запускать. Сначала нужны exact Agent bytes + same-byte Agent/Core composition + unified Stage-B/full local matrix + оба final readiness/coverage verifier PASS. Только после этого допустим один targeted native Windows Circle gate.

GitHub Actions minutes не использовать как обычный исполнитель. Live Notion/Codex, secrets, production и пользовательские данные не трогать до promoted native gates.

## No-replay / tombstone — закрытый серьёзный boundary
На exact Agent head `ee0ae241...` локально доказано 22/22 PASS: mandatory post-replace regression, tombstone/path-safety, cancellation и restart lifecycle. Без нового серьёзного воспроизводимого контрпримера этот модуль не полировать.

Финальная composed-матрица ОБЯЗАНА реально включать `tests/test_subagent_tombstone_post_replace_sync_failure.py` вместе с tombstone store, server restart и delegated cancellation. Старый обычный Agent Circle suite без этого теста не считается финальным.

## Exact Agent pair — воспроизводимость закрыта, не дублировать Core materializer
Frozen preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` (43173 bytes);
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` (112748 bytes).

Exact transformers:
- `tools/apply_account_pool_dynamic_reservation.py` = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` = `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- `tools/apply_subagent_tombstone_wiring.py` = `40ab3a448e33fb8a8c3ce045ef31a815d0554823`.

Exact transformed pair:
- `payload/account_pool.py` -> Git blob `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` -> Git blob `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`, 115707 bytes, SHA-256 `5c8f96ac56576c5ffd89eb6292944e053bd7671b8b8cebc6093978006da6227b`.

Agent ранее независимо получил эти exact outputs + compile PASS. Core независимо воспроизвёл ту же пару по тем же frozen preimages/transformers. Core evidence: `autonomy/evidence/notion/20260823T0658Z_exact_agent_server_materialization.json`.

Следствие: byte-level pair reproducibility закрыта. NOTION_AGENT не должен создавать параллельный pair materializer, пока Core владеет unified Stage-B/composition поверх этой же пары. Независимая Agent-проверка на composed exact bytes разрешена и нужна.

## Routing/failover semantics — уже доказанные Agent
Focused local semantics остаются 3/3 PASS:
- A transport fail -> B поздно зарезервирован чужой tool-chain -> 0 provider calls через B -> C fresh recovery;
- late reservation перед первой provider-попыткой не пропускает старую account-sensitive operation;
- correction failover не повторяет уже завершённый первый model round.

При смене provider account старый Notion thread не переносится: replacement использует полную локальную историю и новый thread. Pending transport evidence сохраняется через routing correction и закрывается фактическим исходом recovery.

Важно для Core Stage-B: после strict provider intent implicit failover запрещён, включая dynamic reservation wrapper. Поэтому Agent semantics должны входить в composed tree так, чтобы protected Core intent/finalize оставался более строгой границей.

## Delegated engineer/owner prompt policy — все exact candidate bytes теперь достижимы
Fresh PR #8 product source пока не содержит всю явную delegated `engineer|owner` policy. Frozen source blobs трёх основных модулей:
- `payload/delegation_policy.py` = `cc50fc7373578262e6051e76716563a98f8f4935`;
- `payload/delegation_dispatcher.py` = `e888c87262d4307a0c5a7de9e315e01601f20a33`;
- `payload/notion_delegated_model_step.py` = `7d38b09be4c80d6ae531cd2282385e36dd5a57df`.

Exact candidate bytes уже лежат обычными достижимыми файлами control-ветки:
- `autonomy/evidence/notion/20260823T0740Z_delegated_prompt_candidate/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `.../delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `.../notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`.

Exact disposable materializer:
- `autonomy/evidence/notion/20260823T0750Z_delegated_prompt_policy_composition_materializer.py` = `39e56802f7a368750cc902ce6f98b086d9133956`.

Контракт:
- `prompt_mode` только `engineer|owner`;
- owner-mode требует непустой `owner_system_prompt`;
- private owner text хранится runtime-полем с `repr=False`;
- `delegated_conversation_key()` не содержит private prompt;
- engineer-mode выбрасывает dormant owner text;
- bad mode/type fail-closed;
- первый полный Notion child prompt в owner-mode начинается ровно с private owner prompt, без инженерной персоны перед ним;
- tool/runtime facts идут после нейтральной границы;
- incremental continuation существующего remote thread не вставляет owner prompt повторно.

### Launch/lifecycle propagation — exact bytes теперь тоже достижимы
Стыковой дефект был в том, что fresh PR #8 `subagent_entrypoint.py` / `server_subagent_lifecycle.py` теряли `prompt_mode` и `owner_system_prompt` до dispatcher.

Ранее доказанные transformed blobs:
- `subagent_entrypoint.py` = `aebefce4ff3e47efc9813ce4e49e70ca8c44972f`;
- `server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`.

В этом проходе оба объекта сохранены как обычные достижимые exact files в канонической control-ветке и GitHub readback SHA совпал с исходными candidate blobs:
- `autonomy/evidence/notion/20260823T1240Z_delegated_prompt_launch_candidate/subagent_entrypoint.py` = `aebefce4ff3e47efc9813ce4e49e70ca8c44972f`; create commit `c5d19dbf51670a15aec1010d8a35963006df5dff`;
- `autonomy/evidence/notion/20260823T1240Z_delegated_prompt_launch_candidate/server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`; create commit `60651a1c1ef11632ba24c69ec3a06a4d8bb7b71b`.

Теперь Core может byte-exact собрать все пять delegated prompt/launch модулей без unreferenced-object догадок:
`fd9a5d702... / a9d15b79b... / f36e9c913... / aebefce4... / f47838b33...`.

Ранее для launch/lifecycle доказано локально:
- materializer regression 4/4 PASS;
- transformed modules compile PASS;
- runtime propagation 3/3 PASS;
- private owner bytes отсутствуют в `repr`;
- engineer-mode выбрасывает dormant owner prompt.

Эти candidate bytes ещё не product state. Их применять только к disposable composed tree / exact composition, не отдельной product-веткой.

## Core composition / Stage-B граница
Core PR #7 остаётся `b6f4eef...`. Fresh NOTION_CORE handoff прямо фиксирует: V50 — только prerequisite composition, НЕ Stage-B candidate.

Перед Windows нужен отдельный unified exact Stage-B на тех же composed bytes:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Agent не должен параллельно реализовывать Core Stage-B. Его роль на этом этапе:
1. дать Core exact Agent bytes;
2. независимо проверить Agent/delegation safety на exact composed tree;
3. проверить, что финальная матрица реально включает mandatory Agent regressions;
4. при Agent FAIL — минимальный root fix только в Agent зоне.

## Final local coverage до Windows
На одних exact composed bytes должны пройти как минимум:
- exact Agent pair materialization/readback/compile;
- dynamic reservations + account/thread affinity + fresh-thread failover;
- delegated engineer/owner prompt propagation;
- delegated tool-loop;
- tombstone store;
- `test_subagent_tombstone_post_replace_sync_failure.py`;
- server restart + delegated cancellation/no-replay;
- Core strict intent/finalize/no-implicit-failover;
- canonical Responses/compaction replay;
- stream/non-stream/disconnect;
- final coverage verifier `verify_notion_final_gate_coverage.py` PASS;
- Windows readiness verifier `verify_notion_windows_ready_candidate.py` PASS.

### 2026-08-23 12:50 MSK — найден воспроизводимый пробел final-gate coverage
Независимый аудит exact verifier `verify_notion_final_gate_coverage.py` blob `0be4c5f626b92b8291c86590580ae767d6d816f6` дал конкретный контрпример: синтетическая final-suite, содержащая ВСЕ текущие `REQUIRED_EXACT_MODULES` + оба Stage-B класса (`durable_replay`, `provider_intent`), получает у verifier `PASS`, даже если из suite полностью убрать существующие Agent prompt/delegation проверки.

Локально воспроизведено: verifier-equivalent result=`PASS`, при этом 0/8 следующих модулей упомянуты suite:
- `tests.test_prompt_modes`;
- `tests.test_prompt_policy_identity`;
- `tests.test_responses_prompt_mode_http_contract`;
- `tests.test_responses_prompt_wiring_contract`;
- `tests.test_delegation_policy`;
- `tests.test_delegation_dispatcher`;
- `tests.test_notion_delegated_model_step`;
- `tests.test_subagent_entrypoint`.

Это противоречит этому же handoff-контракту, который требует delegated engineer/owner prompt propagation на финальных composed bytes. Windows readiness verifier blob `531f93d3c0130cf6451da46408e799df3eb8c139` тоже не имеет отдельного gate для prompt-policy/launch propagation: он доверяет `final_gate_coverage=PASS` и отдельным tombstone/cancellation/dynamic-reservation меткам.

Долговечное evidence: `autonomy/evidence/notion/20260823T0950Z_agent_final_gate_prompt_coverage_gap.json` (create commit `cbd2a20d16ac47cf75215cee431c09093f1dcad0`).

ВАЖНО: NOTION_AGENT не меняет сейчас Core-owned verifier/Stage-B surface параллельно активному `NOTION_CORE-20260823T0943Z`. Core должен включить prompt/delegation tests в unified final suite и/или ужесточить coverage/readiness verifier; после этого Agent независимо проверяет exact composed suite. До этого `final_gate_coverage PASS` сам по себе недостаточен для Agent safety.

Только после same-byte composition + unified Stage-B/full local green допустим один targeted native Windows Circle run. Circle connectivity отдельно уже доказана; повторный connectivity probe не нужен.

## Постоянная память v4
Канонический доказанный pointer на начало этой линии по последнему handoff:
- pointer blob `bfcc0ca196d141c1e5309c596e45e47ec9406823`;
- capsule `20260823T055121Z-d2a954b7b5`;
- archive SHA-256 `36d1b293f7ca6dfaad57e5c1cc8a7f4c58ca524584bf154605d3385a491fe901`;
- 13 immutable parts;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Новый pointer публиковать только после полного `checkpoint -> pack v4 -> immutable upload -> readback/verify -> reread LATEST -> CAS`; при несовпадении uploaded part/manifest pointer не двигать. Unknown bytes не реконструировать из чата.

## Следующий точный шаг
1. Не дублировать Core unified Stage-B/materializer, пока Core владеет этой поверхностью.
2. Core может прямо сейчас byte-exact взять Agent pair `c9ca6f3b.../ba52edc7...` и delegated prompt/launch modules `fd9a.../a9d.../f36e.../aebe.../f478...` из указанных frozen inputs/evidence.
3. Core должен закрыть воспроизведённый prompt/delegation coverage gap: финальная suite обязана реально запускать перечисленные Agent prompt/delegation tests; verifier не должен разрешать Windows-ready при их отсутствии.
4. Как только Core выдаст exact same-byte unified composed tree/manifest + исправленную final-suite coverage, NOTION_AGENT прогоняет на НЁМ полный Agent/delegation cluster, включая mandatory post-replace tombstone + restart/cancellation + prompt policy + routing/failover.
5. Agent PASS/FAIL записать с exact composed blobs и test manifest, без пересказа.
6. Windows не запускать, пока Core local Stage-B/full matrix и оба verifier-а не зелёные с закрытым prompt coverage gap.
7. После native Windows PASS — только тогда bounded authorized `Codex -> bridge -> Notion -> local tool -> correction -> VERIFY_OK`, затем restart/replay/rotation/affinity/soak.

В этом Agent-проходе PR #8, PR #7, CircleCI/GitHub Actions, native Windows, live Notion/Codex, secrets и production не менялись.
