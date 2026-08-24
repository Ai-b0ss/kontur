# Notion — Core и Windows

## Exact heads и граница

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Каноническая transformed Agent-пара: `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697 / 48066`, `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7 / 116047`.
- NOTION_AGENT отдельно владеет полной exact Agent-матрицей, включая 12 недавно найденных отрицательных сценариев. Core не дублирует эту работу.
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
- outer transaction управляет файлами, но не жизненным циклом нового каталога `bridge/payload/`.

Для текущего Agent это недостаточно. `turn_affinity.py` уже изменён и участвует в prompt-policy/cache/thread identity, а импорт-граф требует top-level `prompt_modes.py`, `server_subagent_lifecycle.py`, `reservation_aware_lease.py` и пакет `bridge/payload/*`.

## Новый результат 24.08 ~12:52 МСК — installer-v3 transaction plan

Создан исполняемый fail-closed model-кандидат:
`autonomy/evidence/notion/20260824T1252Z_promoted_installer_v3_transaction_model.py`
Git blob `1c47c061a9fe93b216fdb46230c90d281421560b`.

Evidence:
`autonomy/evidence/notion/20260824T1252Z_promoted_installer_v3_transaction_model.json`.

Локальная логическая проверка кандидата: `PROMOTED_INSTALLER_V3_TRANSACTION_MODEL_PASS cases=12 targets=25`.

Доказанные инварианты модели:
1. explicit source→installed-target plan допускает безопасные вложенные `payload/...` только как относительные bridge-path;
2. `..`, absolute/drive-like/backslash пути закрываются до использования;
3. backup artifact name всегда плоский basename и получает collision-resistant digest исходного ключа;
4. legacy v2 recovery навсегда использует исходный keyset: старые 10 payload + `installed.json`; рост v3 targets не меняет recovery старого journal;
5. v3 journal хранит собственный exact managed-target map, а recovery сверяет его с каноническим plan;
6. current `turn_affinity.py` переводится в managed target;
7. Agent package closure включена в v3 target plan;
8. absent-before `bridge/payload/` можно удалить при rollback только после восстановления/удаления managed files и только если каталог доказанно пуст; foreign entry блокирует удаление;
9. installed marker должен покрывать каждый managed target.

Граница доказательства: это transaction-plan MODEL PASS, а не apply-ready patch для `integrated_upgrade.py`. Опубликованные candidate bytes перечитаны из GitHub; точный опубликованный blob ещё не исполнялся из mounted checkout. Windows-ready/full Stage-B не объявлять.

## Promoted installer v3 — что должно войти в реальный патч

- новая journal schema v3 при сохранении чтения/recovery старого v2;
- explicit immutable source→target plan;
- current composed `turn_affinity.py` как managed payload, а не старый static R2;
- path-safe flat backup names, не зависящие от `/` в target key;
- v3 journal должен содержать exact target mapping, чтобы recovery не зависел от будущего `PAYLOAD_NAMES`;
- guarded/journaled directory preimage для `bridge/payload/`: absent-before/create-owned/preexisting distinction;
- при rollback удалять transaction-created `bridge/payload/` только после exact file rollback и только когда он пуст; unknown child/symlink/junction/inode drift => safe stop;
- все новые files/directories должны участвовать в backup/rollback/installed-marker/final verify;
- старый v2 interrupted journal должен восстанавливаться по своей прежней схеме и keyset.

## Финальные предохранители

- Final coverage обязан фактически запускать все обязательные Agent+Core regressions; наличие файла без wiring не PASS.
- Windows readiness обязан rehash реальный candidate-root и exact manifest; historical/stale PASS не переносится.
- Свежий Agent-аудит отдельно нашёл 12 недостающих safety-regressions в старом coverage; strengthened final coverage/readiness ещё предстоит принять после полной same-byte матрицы.

## Следующий обязательный шаг

1. Превратить доказанную installer-v3 модель в exact patch поверх `integrated_upgrade.py@0f4393...`.
2. Targeted local matrix: clean install; pre-existing `bridge/payload`; crash до/после directory creation; crash/rollback после части nested writes; foreign nested child; symlink/junction/hardlink/path alias/inode swap; old-v2 interrupted journal recovery; v3 target-map drift; backup-name collision; installed-marker/hash drift.
3. После installer local PASS собрать на одной exact Agent pair + owner/engineer overlay весь Stage-B store/transaction/stream/lock слой и прогнать same-byte Agent+Core FULL matrix.
4. Coverage + readiness PASS на реальном candidate-root.
5. Только после этого один targeted native Windows Server 2022 Circle proof на тех же байтах.

Последний Core-проход не двигал PR #7/#8, не запускал Circle/Windows и не трогал live Notion/Codex/accounts/secrets/data/main/merge/production.
