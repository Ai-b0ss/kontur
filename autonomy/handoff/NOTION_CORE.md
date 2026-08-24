# Notion — Core и Windows

## Exact heads и координация

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Каноническая transformed Agent-пара: `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697 / 48066`, `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7 / 116047`.
- `NOTION_AGENT` отдельно владеет полной exact Agent-матрицей на pair+owner/engineer overlay; не дублировать её из Core.
- Circle connectivity уже PASS; reconnect не нужен. Native Windows закрыт до same-byte Agent+Core FULL local PASS + coverage/readiness PASS.

## Доказанная Core Stage-B база

- Stage-A fail-closed floor: V32 exact local PASS.
- Durable store candidate на exact `conversation_segments.py@553bd349...`: `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `b3fe792b99daad678e3c773db291576bdf179167`; regression `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection: `a094a4b5484384037fb02c07d345b73531a46091`; regression `8d5fadf31aeff034d09e9943b25249402a2207b0`; local 10/10.
- Server-owned lock boundary: `2f92c2abe56e2d4be39c4930a63dd876aca52294`; regression `b280001743064a86b61306c160820d9b88329672`; local 6/6.
- После durable provider intent каждый осознанный внешний шаг выполняется без неявного account failover; обычная Agent-ротация вне защищённой транзакции сохраняется.

## Promoted installer — exact blocker

Exact Core `integrated_upgrade.py` = Git blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Текущий installer всё ещё использует старую модель:
- journal schema v2;
- 10 плоских `PAYLOAD_NAMES` под `<project_root>/bridge`;
- `turn_affinity.py` считается exact-R2 static, хотя текущий Agent его изменил;
- backup-имя строится из key и небезопасно для вложенных `payload/...`;
- recovery пересчитывает keyset и payload set из текущей версии кода, поэтому простое расширение ломает старый v2 journal;
- `backup_files()` не умеет честно снять preimage вложенного файла при отсутствующем `bridge/payload/`;
- lifecycle нового managed-каталога `bridge/payload/` не журналируется.

Текущий Agent import closure требует top-level `prompt_modes.py`, `server_subagent_lifecycle.py`, `reservation_aware_lease.py`, current managed `turn_affinity.py` и пакет `bridge/payload/*` с delegation/subagent/tombstone modules.

## Installer-v3 — доказанная схема

Предыдущая directory-ownership модель:
- `autonomy/evidence/notion/20260824T1350Z_promoted_installer_v3_directory_ownership_model.py`
- blob `94f6d5807334e74c5576b2107872f9a8f1d58a57`
- `PROMOTED_INSTALLER_V3_DIRECTORY_OWNERSHIP_MODEL_PASS cases=20 targets=25`.

Обязательные инварианты:
1. v2 recovery навсегда использует старые 10 payload и старый keyset.
2. v3 имеет immutable source→target map: 25 managed files + `installed.json`.
3. `turn_affinity.py` в v3 — managed payload.
4. backup artifacts имеют плоские path-safe имена.
5. `bridge/payload/` journaled как `absent-before` или `preexisting`.
6. Для absent-before nested children используются synthetic absent-parent preimages; после guarded parent create проверки/write/delete выполняются через тот же parent guard.
7. Transaction-created `bridge/payload/` первым durable child получает owner marker `{schema, transaction_id}`; marker остаётся до durable `verified`.
8. Rollback удаляет transaction-created payload dir только после exact marker verification, exact managed-child rollback, marker deletion и guarded empty-dir delete. Foreign child, marker drift/missing, symlink/junction, alias/identity drift => safe stop.
9. Preexisting payload dir никогда не удаляется outer rollback.
10. После `verified` commit-recovery снимает только exact owner marker и сохраняет установленный payload dir.

## Новый результат 24.08 ~14:50 МСК — исполняемый installer-v3 engine

Опубликован более близкий к реальной реализации sidecar-кандидат:
- `autonomy/evidence/notion/20260824T1445Z_promoted_installer_v3_engine_candidate.py`
- Git blob `4e427d6407616e686609dc5968ad3a7a1d0a6b2b`
- SHA-256 `0038dc5e63f7afbe027a659c193ea9121e76b001b115bde05ee6e40c18f5c792`
- `py_compile` PASS
- execution: `PROMOTED_INSTALLER_V3_ENGINE_CANDIDATE_PASS cases=17`.

Readback evidence:
- `autonomy/evidence/notion/20260824T1445Z_promoted_installer_v3_engine_evidence.json`
- Git blob `af357548eba224551abf91a6742e89bd0ee9426a`.

Engine уже реализует и проверяет: schema-aware v2/v3 target plan, safe rel paths, flat unique backup names, managed current `turn_affinity`, synthetic absent-parent preimages, exact txid owner marker, nested-write absence gate, marker-bound rollback/delete, foreign-child/managed-residue fail-closed, marker drift fail-closed, verified-only marker cleanup, frozen v2 keyset и exact v3 target-map validation.

Граница доказательства: это `LOCAL_MODEL_PASS_NOT_INTEGRATED`. Он ещё не наложен на exact `integrated_upgrade.py@0f4393e...`, не заменяет full installer crash/recovery matrix, не является same-byte Stage-B PASS и не открывает Windows.

## Coverage/readiness

- Full coverage обязан фактически запускать все обязательные Agent+Core regressions; наличие файла без wiring не PASS.
- Свежий Agent coverage candidate сейчас `f521d8324002de16e1dc57b6be4b3ce0a6be21eb` или более новый reviewed superset после Agent matrix.
- Windows readiness обязан exact-pin canonical Agent pair, owner/engineer overlay, composed Stage-B files и `integrated_upgrade.py`, затем rehash реальный candidate-root. Historical/stale PASS не переносится.

## Следующий обязательный шаг

1. Сделать детерминированный exact materializer/patch поверх `integrated_upgrade.py@0f4393e...`, перенеся туда проверенные installer-v3 primitives без семантической реконструкции неизвестных байтов.
2. На изолированной копии прогнать targeted matrix: clean install; preexisting payload dir; crash до create; crash после create до/после owner marker; partial nested writes; foreign child; empty foreign replacement; marker drift/missing; symlink/junction/path alias/inode swap; old-v2 interrupted journal recovery; v3 target-map drift; backup-name collision; installed-marker/hash drift; crash after verified before marker cleanup.
3. После installer local PASS собрать на одной exact Agent pair + owner/engineer overlay полный Store+transaction+stream+lock Stage-B и прогнать same-byte Agent+Core FULL matrix.
4. Coverage + readiness PASS на реальном candidate-root.
5. Только затем один targeted native Windows Server 2022 Circle proof на тех же байтах.

Текущий Core-проход не двигал PR #7/#8, не запускал Circle/Windows и не трогал live Notion/Codex/accounts/secrets/data/main/merge/production.
