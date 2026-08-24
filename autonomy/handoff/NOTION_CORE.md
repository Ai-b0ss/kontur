# Notion — Core и Windows

## Exact heads и граница работы

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144` (`candidate/ncm28-windows-fixed-v1`).
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64` (`autonomy/notion-prompt-modes-20260819`).
- Финальная materialized Agent-пара, доказанная ранее: `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697 / 48066`, `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7 / 116047`.
- Agent lane отдельно владеет полной exact Agent-матрицей и 12 свежими negative-path regressions. Core их не дублирует.
- Circle connectivity уже PASS. Не делать reconnect. Targeted native Windows запускать только после same-byte Agent+Core local FULL PASS.

## Уже доказанная Core Stage-B база

- Stage-A fail-closed floor: V32 local exact PASS.
- Stage-B store на exact `conversation_segments.py` preimage `553bd349...`: candidate `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`, blob `b3fe792b99daad678e3c773db291576bdf179167`; exact regression blob `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection candidate `a094a4b5484384037fb02c07d345b73531a46091`, exact regression `8d5fadf31aeff034d09e9943b25249402a2207b0`, local 10/10.
- Server-owned lock boundary candidate `2f92c2abe56e2d4be39c4930a63dd876aca52294`, regression `b280001743064a86b61306c160820d9b88329672`, local 6/6.
- Protected no-failover Core boundary remains mandatory after durable provider intent; ordinary Agent rotation remains unchanged outside that protected transaction.

## Promoted installer — текущий блокер перед composition/Windows

Current Core `integrated_upgrade.py` = Git blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Он всё ещё управляет только десятью плоскими `PAYLOAD_NAMES` под `<project_root>/bridge/<name>` и считает `notion_images.py` + `turn_affinity.py` exact-R2 static dependencies. Это уже недостаточно для текущего Agent+Core runtime.

Точная текущая локальная import-closure включает как минимум:

- новые top-level runtime modules: `prompt_modes.py`, `server_subagent_lifecycle.py`, materialized `reservation_aware_lease.py`;
- package modules под `payload.*`: `delegated_tool_loop.py`, `delegation_dispatcher.py`, `delegation_policy.py`, `notion_delegated_model_step.py`, `notion_delegation_adapter.py`, `notion_subagent_runtime.py`, `reservation_aware_lease.py`, `server_subagent_runtime.py`, `subagent_entrypoint.py`, `subagent_lifecycle.py`, `subagent_tombstone_store.py`.

### Новое доказанное в проходе 24.08 ~12:10 МСК

Обнаружено, что прежний closure-regression был слишком слабым: он считал модуль «установленным», если его имя присутствовало в `R2_STATIC_DEPENDENCY_SHA256`, не сверяя static identity с exact source bytes composed tree.

Это критично для `turn_affinity.py`:

- Core source Git blob: `6abc6572e537eada9cbd2f07224388be6494910f`;
- Agent source Git blob: `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`;
- installer всё ещё требует старый exact-R2 SHA-256 `dfd8f35bd70e6aff5c4881091664f8543dbcebf06fcddb33d807c075cc5132dc`;
- текущий Agent `turn_affinity.py` уже импортирует `prompt_modes` и включает content-free prompt-policy fingerprint в cache/thread identity.

Следствие: `turn_affinity.py` больше нельзя считать старым статическим non-target для финального Agent+Core candidate. Его нужно продвинуть в managed composed payload либо доказать точную эквивалентную установленную версию. Простого совпадения имени недостаточно.

Closure regression усилен на месте:
`autonomy/evidence/notion/20260824T1115Z_test_promoted_install_payload_closure.py`
новый blob `4883bd59b6a4b8c3f2b17d3103882d1b26dea55d`.
Теперь static dependency засчитывается только если SHA-256 exact source bytes совпадает с объявленным static SHA. Локально: syntax PASS, synthetic static-drift negative PASS, static-exact positive PASS.

Evidence:
`autonomy/evidence/notion/20260824T1210Z_promoted_installer_static_identity_and_nested_targets.json`.

### Почему нельзя просто дописать вложенные имена в PAYLOAD_NAMES

Текущий installer имеет ещё три подтверждённых несовместимых предположения:

1. `_durable_backup_descriptors()` делает имя backup как `key.replace('.', '_')`. Для ключа `payload/delegation_dispatcher.py` получается `00-payload/delegation_dispatcher_py.before`, то есть не basename, а вложенный путь. Локально воспроизведено: `NESTED_BACKUP_NAME_HAZARD_REPRODUCED`.
2. `_load_durable_backups()` заново вычисляет current `target_paths()` и требует точного совпадения keyset с journal. Простое расширение PAYLOAD_NAMES сделает прерванный journal старой схемы невосстановимым. Нужен version-aware legacy recovery / новая journal schema.
3. `bridge/payload/` — новый управляемый каталог. Текущий outer transaction отслеживает только файлы. Нужно долговечно записать preimage каталога, создать его через NCM28 guarded-parent операции и при rollback удалять только если именно эта транзакция создала его и каталог доказанно пуст. Нельзя оставлять мусорный каталог и нельзя удалять чужой.

Следовательно, безопасный installer fix — это не список имён, а versioned source→installed-target plan с nested-directory lifecycle, безопасными flat backup artifact names, полным backup/rollback/installed-marker/final-verify покрытием и backward recovery старого journal.

## Финальные предохранители

- Final coverage verifier должен фактически запускать все обязательные Agent+Core regressions, включая promoted-install closure; наличие файла без wiring не считается PASS.
- Windows readiness обязан rehash реального candidate-root и exact manifest. Старый historical PASS не переносится.
- До local composed FULL PASS Windows не запускать.

## Следующий обязательный шаг

1. На exact Core `integrated_upgrade.py@0f4393...` собрать fail-closed installer-v3 candidate:
   - managed `turn_affinity.py` вместо старой static assumptions для Agent composition;
   - explicit source→target map;
   - nested `bridge/payload` directory preimage/lifecycle;
   - path-safe collision-resistant flat backup names;
   - outer-journal versioning с recovery старого v2 keyset;
   - все targets в backup/rollback/installed marker/final verification.
2. Прогнать targeted local installer regressions: clean install, pre-existing package dir, rollback before/after nested writes, foreign nested entry, symlink/junction/hardlink/path alias, crash old-v2 recovery, marker/hash drift.
3. Затем объединить installer с exact Agent pair + owner/engineer overlay + Stage-B store/transaction/stream/lock слоями и прогнать одну same-byte Agent+Core FULL matrix.
4. Только после coverage + readiness PASS — один targeted Windows Server 2022 Circle proof на этих же bytes.

Никакой Circle/Windows/live Notion/Codex/account/config/data mutation в последнем Core-проходе не было; PR #7/#8 refs не двигались.
