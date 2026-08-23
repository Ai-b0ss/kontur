# Notion — ротация / агентность / делегирование — handoff

Обновлено: 2026-08-23 21:55 МСК.

## Источник истины
- Product repo: `Ai-b0ss/notion-agent-bridge`.
- Agent PR #8 exact head: `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Core PR #7 exact head на момент передачи: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Свежая owner-policy в `Ai-b0ss/kontur#9` важнее старых freeze/reconnect текстов: Notion Circle connectivity уже доказана; повторный reconnect не нужен.
- Windows пока ЗАПРЕЩЁН: сначала exact Agent pair -> same-byte Agent/Core local Stage-B/full matrix -> coverage/readiness PASS.

## Fresh exact Agent pair после startup-cleanup root fix
Замороженные входные байты PR #8:
- `payload/account_pool.py` = Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes.

Точные materializer blobs на exact Agent head:
- `tools/apply_account_pool_dynamic_reservation.py` = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` = `20c2fb2e550daab52f3d27e791fa500002a73735`;
- `tools/apply_subagent_tombstone_wiring.py` = `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- `tools/materialize_agent_wiring.py` = `30fb89286eb4457b25b2145918279fec2d735042`;
- `tools/materialize_agent_wiring_with_tombstones.py` = `859039a5e408bc84e7046372cdb509131eb37a97`.

Fresh deterministic target pair:
- `payload/account_pool.py` -> Git blob `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` -> Git blob `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 116047 bytes.

Почему это уже не `ba52edc7...`: commit `4b344547...` принял startup-cleanup root fix; historical `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` = `STALE_DO_NOT_PROMOTE`.

Размеры fresh pair независимо выведены из exact current materializer replacements:
- account_pool delta = +4893 bytes => 43173 + 4893 = 48066;
- server startup/routing delta = +3153 bytes, tombstone delta = +146 => 112748 + 3299 = 116047.

ВАЖНО: target blobs `c9ca...`/`5c04...` сейчас не читаются через Git blob API (404), поэтому один hash НЕ считается durable materialization. Core обязан byte-exact воспроизвести их из перечисленных preimages/materializers, перечитать результаты, проверить именно эти Git blob SHA + sizes и сохранить bytes в reachable same-byte composition tree/immutable evidence.

Долговечный machine-readable handoff:
`autonomy/evidence/notion/20260823T2055Z_agent_exact_pair_handoff.json` = blob `bef5fd03dda26945ea33a6f7ddc585756c6de5fd`.

## Startup cleanup — принятый root fix
Current `apply_startup_status_cleanup.py=20c2fb2...` ловит ошибку cleanup внутри shield-loop, не даёт `new_pool.aclose()` замаскировать исходную startup/cancellation причину и переживает repeated cancellation. Старый transformed server, созданный до этого fix, не использовать.

Обязательные regressions в same-byte suite:
- `tests.test_startup_status_cleanup`;
- `tests.test_startup_status_repeated_cancellation`;
- `tests.test_startup_cleanup_failure_boundary_candidate`.

## Delegated engineer/owner — corrected exact 5-file candidate
Использовать только:
- `delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` = `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`.

`aebefce4ff3e47efc9813ce4e49e70ca8c44972f` НЕ использовать: старый launch candidate импортировал `PromptMode`, тогда как policy экспортирует `DelegatedPromptMode`.

Исправленный 5-file set уже независимо доказан: compile 5/5, cross-module imports 19/19, owner prompt проходит `SubagentLaunch -> DelegationRequest -> DelegationContext -> ServerSubagentLifecycle`; private text отсутствует в repr/identity; same-client continuation не повторяет owner prompt; account failover создаёт fresh thread вместо переноса чужого thread id.

## Mandatory Agent matrix на composed exact bytes
Минимум реально включить:
- `tests.test_prompt_modes`
- `tests.test_prompt_policy_identity`
- `tests.test_responses_prompt_mode_http_contract`
- `tests.test_responses_prompt_wiring_contract`
- `tests.test_delegation_policy`
- `tests.test_delegation_dispatcher`
- `tests.test_notion_delegated_model_step`
- `tests.test_subagent_entrypoint`
- `tests.test_delegated_tool_loop_runtime_validation`
- `tests.test_delegated_uncertain_failover_boundary`
- `tests.test_dynamic_reservation_inlease_reselect`
- `tests.test_notion_delegated_synthetic_call_ids`
- `tests.test_notion_delegated_thread_reentry`
- `tests.test_notion_delegation_dynamic_reservations`
- `tests.test_notion_subagent_runtime`
- `tests.test_notion_subagent_server_reservations`
- `tests.test_reservation_aware_lease`
- `tests.test_responses_cooldown_failover`
- `tests.test_startup_status_cleanup`
- `tests.test_startup_status_repeated_cancellation`
- `tests.test_startup_cleanup_failure_boundary_candidate`
- `tests.test_subagent_lifecycle`
- `tests.test_subagent_tombstone_post_replace_sync_failure`

No-replay/tombstone boundary на прежней exact Agent линии был локально 22/22 PASS; не полировать без нового воспроизводимого контрпримера. Финальный same-byte suite всё равно обязан повторить load-bearing tombstone post-replace/restart/cancellation tests на текущей композиции.

## Новый блокирующий gap: current final coverage даёт ложный PASS
Свежий Core final coverage verifier `42cdae4c422068153f41697f063cf8a1cc28e8f9` не требует 10 обязательных существующих Agent-модулей:
- `tests.test_delegated_tool_loop_runtime_validation`
- `tests.test_delegated_uncertain_failover_boundary`
- `tests.test_notion_delegated_synthetic_call_ids`
- `tests.test_notion_delegated_thread_reentry`
- `tests.test_notion_delegation_dynamic_reservations`
- `tests.test_notion_subagent_runtime`
- `tests.test_notion_subagent_server_reservations`
- `tests.test_reservation_aware_lease`
- `tests.test_responses_cooldown_failover`
- `tests.test_subagent_lifecycle`

Контрпример воспроизведён локально: synthetic final suite содержит всё, что требует текущий verifier, плюс Stage-B `durable_replay`/`provider_intent`, но исключает все 10 модулей выше — текущий verifier всё равно возвращает `PASS`/rc=0. Эти тестовые файлы реально присутствуют на exact Agent PR#8 head.

Fail-closed кандидат без движения refs сохранён как unreferenced Git blob `2df0e51ab385d003b2cbdf9126aad0176d62bed6` в `Ai-b0ss/kontur` и перечитан обратно. Он добавляет ровно эти 10 модулей. На том же контрпримере кандидат возвращает `NOT_READY`/rc=1 и перечисляет все 10 пропусков; на полном synthetic suite возвращает `PASS`/rc=0.

До same-byte Stage-B/Windows Core должен либо принять эквивалентное усиление coverage verifier, либо иным fail-closed способом доказать присутствие всех обязательных Agent-модулей. Windows readiness v5 нельзя считать достаточным, если его `final_gate_coverage=PASS` получен старым неполным verifier.

## Core boundary
NOTION_AGENT не меняет PR #7/NCM28/Core Stage-B. Core забирает exact Agent bytes/recipe и строит same-byte composition.

До targeted Windows нужны на ОДНИХ байтах:
1. fresh pair readback/blob/size/compile;
2. полный Agent matrix выше;
3. Core Stage-B/full local matrix;
4. final coverage verifier PASS с fail-closed обязательностью всех Agent-модулей выше;
5. Windows readiness verifier PASS.

Только после этого допустим один targeted native Windows run. Live `Codex -> bridge -> Notion`, rotation/restart/soak — только после promoted native gates и восстановления encrypted runtime.

## Постоянная память
Норматив: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`. Unknown capsule bytes не реконструировать из чата. LATEST публиковать только `checkpoint -> pack v4 -> immutable upload -> readback all parts/manifest -> reread LATEST -> CAS update_file`; при конфликте не force-write.

Фактический `LATEST` этого прохода перечитан как blob `9bd748cc6c4caab3e23271ec121a8bef77d03609`, capsule `20260823T155545Z-4ef01292f2`, archive SHA-256 `ea3fcafdc26cdad76b0c1c6dc2923d6ea6a8513e4db314e40406f7bb46ca7191`. Новый pointer не публиковался: этот проход не выполнял полный нормативный byte-exact restore/upload/readback всех 14 частей, а protocol v2 запрещает ручную реконструкцию неизвестных bytes. Текущее состояние долговечно закреплено Git handoff + unreferenced verifier candidate + #9/PR evidence.

## Следующий точный шаг
1. Core/следующий Agent worker воспроизводит fresh pair `c9ca... / 5c04...` из exact recipe выше и делает durable readback.
2. На этих exact bytes добавить corrected delegated five-file set с `2d576...`.
3. Прогнать mandatory Agent matrix локально.
4. Перед Windows усилить final coverage до fail-closed обязательности всех Agent-модулей; candidate blob `2df0e51a...` — минимальная проверенная база.
5. Передать Core reachable exact bytes + manifest; Core делает same-byte Stage-B/full local matrix и readiness v5.
6. До полного local green НЕ запускать Windows и live Notion/Codex.
