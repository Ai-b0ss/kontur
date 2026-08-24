# Notion — Core и Windows

## Exact heads и граница

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Каноническая transformed Agent-пара: `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697 / 48066`, `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7 / 116047`.
- NOTION_AGENT отдельно владеет полной exact Agent-матрицей. Его свежий coverage-кандидат `f521d8324002de16e1dc57b6be4b3ce0a6be21eb` добавляет также `tests.test_live_two_slot_probe_contract` и `tests.test_server_subagent_tool_catalog`; полный Agent safety PASS пока не доказан.
- Circle connectivity уже PASS. Reconnect не нужен. Native Windows запрещён до same-byte local Agent+Core FULL PASS + coverage/readiness PASS.

## Доказанная Core Stage-B база

- Stage-A fail-closed floor: V32 local exact PASS.
- Stage-B store на exact `conversation_segments.py` preimage `553bd349...`: candidate `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`, blob `b3fe792b99daad678e3c773db291576bdf179167`; regression `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection: `a094a4b5484384037fb02c07d345b73531a46091`, regression `8d5fadf31aeff034d09e9943b25249402a2207b0`, local 10/10.
- Server-owned lock boundary: `2f92c2abe56e2d4be39c4930a63dd876aca52294`, regression `b280001743064a86b61306c160820d9b88329672`, local 6/6.
- После durable provider intent каждый осознанный внешний шаг идёт без неявного account failover; обычная Agent-ротация вне защищённой транзакции сохраняется.

## Promoted installer — текущий блокер

Exact Core `integrated_upgrade.py` = Git blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Текущая версия имеет старую модель:
- journal schema `ncm25-integrated-outer-transaction-v2`;
- 10 плоских `PAYLOAD_NAMES` под `<project_root>/bridge`;
- `turn_affinity.py` считается exact-R2 static dependency;
- `_durable_backup_descriptors()` строит backup-имя из ключа через `key.replace('.', '_')`, поэтому вложенный ключ способен превратиться во вложенный backup-path;
- `_load_durable_backups()` пересчитывает keyset через текущий `target_paths()`, поэтому простое расширение target list ломает восстановление старого v2 journal;
- `load_payloads()` при recovery использует текущий `PAYLOAD_NAMES`, поэтому расширение набора без schema-dispatch также изменит `payload_sha256` и способно заблокировать старый v2 journal;
- `backup_files()` требует существующий родитель для NCM28 snapshot и потому не умеет честно снять preimage вложенного файла, если `bridge/payload/` отсутствовал;
- outer transaction управляет файлами, но не жизненным циклом нового каталога `bridge/payload/`.

Для текущего Agent этого недостаточно. `turn_affinity.py` уже изменён и участвует в prompt-policy/cache/thread identity, а импорт-граф требует top-level `prompt_modes.py`, `server_subagent_lifecycle.py`, `reservation_aware_lease.py` и пакет `bridge/payload/*`.

## Installer-v3 transaction plan — предыдущая база

Исполняемый fail-closed model-кандидат:
`autonomy/evidence/notion/20260824T1252Z_promoted_installer_v3_transaction_model.py`
Git blob `1c47c061a9fe93b216fdb46230c90d281421560b`.

Локальная логическая проверка: `PROMOTED_INSTALLER_V3_TRANSACTION_MODEL_PASS cases=12 targets=25`.

Он доказал explicit source→target plan, safe rel paths, плоские backup names, frozen legacy-v2 keyset, v3 exact target-map, managed current `turn_affinity.py`, package closure и installed-marker coverage. Но его правило удаления absent-before `bridge/payload/` по одной только пустоте каталога оказалось недостаточным для crash/restart ownership.

## Новый результат 24.08 ~13:50 МСК — durable ownership каталога `bridge/payload/`

Новый исполняемый self-review model:
`autonomy/evidence/notion/20260824T1350Z_promoted_installer_v3_directory_ownership_model.py`
Git blob `94f6d5807334e74c5576b2107872f9a8f1d58a57`.

Evidence:
`autonomy/evidence/notion/20260824T1350Z_promoted_installer_v3_directory_ownership_evidence.json`.

Локально выполнен опубликованный эквивалент: `PROMOTED_INSTALLER_V3_DIRECTORY_OWNERSHIP_MODEL_PASS cases=20 targets=25`; `py_compile` PASS; локальный SHA-256 candidate `6b4f57c5b6b5448636543544581ccc36f059021441eca93af5ac68c8c1797029`. Опубликованные model bytes перечитаны из GitHub.

Новый доказанный root cause:
1. Пустота absent-before `bridge/payload/` после рестарта НЕ доказывает, что каталог всё ещё создан нашей транзакцией: чужой процесс может заменить его другим пустым каталогом. Удалять такой namespace по одной пустоте нельзя.
2. Для absent-before `bridge/payload/` нужен долговечный exact owner marker как первый child после guarded CREATE_NEW; marker должен содержать schema + transaction_id и оставаться до durably recorded `phase=verified`.
3. Rollback может удалить transaction-created `bridge/payload/` только после exact marker verification, exact rollback всех managed children, exact marker deletion и guarded empty-directory delete. Missing/drifted marker, foreign child, symlink/junction или оставшийся managed file => safe stop.
4. Pre-existing `bridge/payload/` никогда не удаляется outer rollback.
5. Когда parent отсутствует, nested child preimage нельзя притворять обычным NCM28 snapshot. Для него journal хранит synthetic absent preimage; после guarded создания parent отсутствие child и последующая write/delete проверяются уже через тот же parent guard.
6. Legacy v2 recovery обязан не только использовать frozen target keyset, но и загружать frozen старый набор из 10 payload, чтобы `payload_sha256` старого журнала не зависел от v3 growth.
7. Owner marker нельзя снимать до `verified`. При crash после `verified`, но до cleanup, commit-recovery удаляет только exact marker и сохраняет установленный `bridge/payload/`.

Отрицательные сценарии модели: foreign child, marker drift, marker missing, empty foreign replacement, symlinked payload dir, managed child still present, premature marker cleanup, traversal/backslash target path.

Граница доказательства: это усиленная transaction/directory-ownership MODEL PASS, а не apply-ready patch `integrated_upgrade.py`. Windows-ready/full Stage-B не объявлять.

## Promoted installer v3 — что должно войти в реальный патч

- journal schema v3 при сохранении чтения/recovery старого v2;
- schema-aware payload loader: v2 навсегда = старые 10 payload; v3 = exact 25-target plan;
- explicit immutable source→target plan;
- current composed `turn_affinity.py` как managed payload, а не старый static R2;
- path-safe flat backup names, не зависящие от `/` в target key;
- v3 journal содержит exact target mapping, чтобы recovery не зависел от будущего списка файлов;
- guarded/journaled directory preimage для `bridge/payload/`: absent-before / preexisting;
- absent-before directory создаётся под NCM28 guard, после чего первым durable child публикуется exact owner marker; marker остаётся до `verified`;
- nested absent child preimages представлены явно как absent-parent preimages и валидируются после parent creation под тем же guard;
- rollback nested targets выполняется под payload-directory guard; transaction-created directory удаляется только по exact owner marker и только после file rollback; foreign bytes/identity drift => safe stop;
- preexisting payload directory сохраняется всегда;
- все новые files/directories входят в backup/rollback/installed-marker/final verify;
- старый v2 interrupted journal восстанавливается по своей прежней схеме, keyset и payload hash set.

## Финальные предохранители

- Final coverage обязан фактически запускать все обязательные Agent+Core regressions; наличие файла без wiring не PASS.
- Свежий Agent coverage candidate: `f521d8324002de16e1dc57b6be4b3ce0a6be21eb` или позже reviewed superset после same-byte composition.
- Windows readiness обязан rehash реальный candidate-root и exact manifest; historical/stale PASS не переносится.

## Следующий обязательный шаг

1. Превратить усиленную installer-v3 модель в exact patch поверх `integrated_upgrade.py@0f4393...`: schema-aware v2/v3 loader/recovery, managed current `turn_affinity`, flat backups, exact target map, durable payload-dir owner marker, synthetic absent-parent child preimages и parent-guard-bound nested writes/rollback.
2. Targeted local matrix: clean install; pre-existing `bridge/payload`; crash до directory create; crash после create до/после owner marker; crash после части nested writes; foreign child; empty foreign replacement; marker drift/missing; symlink/junction/path alias/inode swap; old-v2 interrupted journal recovery; v3 target-map drift; backup-name collision; installed-marker/hash drift; crash after `verified` before marker cleanup.
3. После installer local PASS собрать на одной exact Agent pair + owner/engineer overlay весь Stage-B store/transaction/stream/lock слой и прогнать same-byte Agent+Core FULL matrix.
4. Coverage + readiness PASS на реальном candidate-root.
5. Только после этого один targeted native Windows Server 2022 Circle proof на тех же байтах.

Последний Core-проход не двигал PR #7/#8, не запускал Circle/Windows и не трогал live Notion/Codex/accounts/secrets/data/main/merge/production.
