# Notion — Core и Windows

## Exact heads и координация

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Agent drift `3cc0c0be... -> 12e3c4fe...` затронул только materializer helper и focused regression; promoted runtime import closure/product payload не менялся.
- `NOTION_AGENT`/manual worker отдельно владеет Agent pair/materialization/full Agent matrix. Core не дублирует её.
- Circle connectivity = PASS. Reconnect не нужен. Native Windows закрыт до exact same-byte Agent+Core FULL local PASS + coverage/readiness PASS.
- Историческая pair `c9ca6f3b... + 273db94a...` не считается current-proof для head `12e3c4fe...`, пока Agent заново не даст exact blob/size/readback/compile evidence.

## Доказанная Core Stage-B база

- Stage-A fail-closed floor: V32 exact local PASS.
- Durable store candidate на exact `conversation_segments.py@553bd349...`: `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `b3fe792b99daad678e3c773db291576bdf179167`; regression `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection: `a094a4b5484384037fb02c07d345b73531a46091`; regression `8d5fadf31aeff034d09e9943b25249402a2207b0`; local 10/10.
- Server-owned lock boundary: `2f92c2abe56e2d4be39c4930a63dd876aca52294`; regression `b280001743064a86b61306c160820d9b88329672`; local 6/6.
- После durable provider-intent каждый осознанный внешний шаг выполняется без неявного account failover; обычная Agent-ротация вне защищённой транзакции сохраняется.

## Promoted installer — exact source и старый v2

Exact Core `integrated_upgrade.py` = Git blob `0f4393e656307e3b17dfab105464de551f12a05d`.

Его историческая v2-транзакция умеет безопасно восстанавливать старые 10 плоских payload-файлов. Её journal/keyset/payload-sha нельзя переопределять новым Agent-набором: после аварии один вызов legacy `run_upgrade()` может только восстановить/откатить незавершённый v2 и вернуть PASS, не выполнив новую интеграцию.

Текущий Agent требует дополнительно current managed `turn_affinity.py`, `prompt_modes.py`, `server_subagent_lifecycle.py`, `reservation_aware_lease.py` и пакет `bridge/payload/*` с delegation/subagent/tombstone modules.

## Новый результат — безопасная двухслойная схема installer-v3

Вместо переписывания старого v2 выбран более безопасный слой:

1. **Inner v2 остаётся неизменным.** Внешний v3 вызывает текущий `run_upgrade()` и после каждого вызова отдельно доказывает, что Core реально интегрирован. Разрешено максимум два вызова: первый может только восстановить старую v2-транзакцию, второй — выполнить фактическую интеграцию. Если после двух Core не интегрирован — fail closed.
2. **Outer v3 имеет отдельный журнал.** После доказанного Core PASS он снимает preimage нового Agent/Core overlay, управляет вложенным `bridge/payload/`, owner-marker с `transaction_id`, backup/readback, точной картой source→target, installed marker и lifecycle.
3. **Авария inner v2** делегируется существующему legacy recovery, без изменения его journal/keyset semantics.
4. **Авария outer v3** откатывает только overlay к уже проверенному Core-preimage и не пытается заново толковать legacy v2.
5. После `verified` recovery только перепроверяет exact outputs/lifecycle и завершает cleanup.

Локально исполненный кандидат:
- `/mnt/data/promoted_installer_v3_wrapper_candidate.py`
- size `30121`
- SHA-256 `9da1ef7b407c1b0e3ce6e8f336ceaf0fa9270e4bd0d2db65653661269124e4af`
- Git blob `47c44b4d8dc8a98fac0493b51077779250e27155`
- `py_compile` PASS
- `PROMOTED_INSTALLER_V3_WRAPPER_CANDIDATE_PASS cases=18`
- повторный запуск: 3 раза подряд PASS.

Проверены: clean RUNNING install, original STOPPED, crash после outer journal/Core/backups/nested write/verified, legacy recovery-only first call + bounded second integrate, foreign target, payload-manifest drift, preexisting payload-dir с чужим файлом, owner-marker drift, foreign backup, target-map drift, symlink payload-dir и verified lifecycle drift.

### Важная граница exact bytes

Опубликованная ранее control-копия
`autonomy/evidence/notion/20260824T1625Z_promoted_installer_v3_two_layer_wrapper_candidate.py`
**не является каноническим исполняемым кандидатом**: её Git blob `098075b69166917174f04c331125b9deec082f8c` не совпал с blob реально запущенных локальных байтов `47c44b4d8dc8a98fac0493b51077779250e27155`.

Это явно зафиксировано в:
`autonomy/evidence/notion/20260824T1630Z_promoted_installer_v3_wrapper_candidate_evidence.json`
(blob `035859ced326004fac5473c7146ce0f43e732b20`).

Статус: `LOCAL_EXECUTED_BYTES_ONLY__CONTROL_COPY_NONCANONICAL`. Никакой PASS нельзя переносить с локальных байтов на control-copy.

## Что ещё не доказано

- Двухслойный wrapper пока модель на generic filesystem primitives, а не exact patch `integrated_upgrade.py@0f4393e...`.
- Production-интеграция обязана использовать существующие NCM28 guarded-directory / snapshot / atomic-write primitives и их identity/alias guarantees; нельзя заменять их семантической реконструкцией.
- Current Agent exact transformed pair на head `12e3c4fe...` ещё принадлежит Agent lane и должна прийти с exact blob/size/readback/compile evidence.
- Полный same-byte Agent+Core Stage-B, coverage/readiness и Windows ещё не запускались.

## Следующий обязательный шаг

1. Сделать детерминированный exact materializer/patch поверх `integrated_upgrade.py@0f4393e...`, перенеся двухслойную схему на реальные NCM28 guarded APIs и **не меняя** inner-v2 journal/keyset/payload-sha semantics.
2. На изолированной exact-копии прогнать crash/rollback matrix: clean install; preexisting payload-dir; crash до/после Core; absent-parent create + owner-marker; partial nested writes; foreign child/marker/backup/target-map drift; symlink/junction/alias/identity swap; historical interrupted v2 recovery; verified cleanup; lifecycle preservation.
3. Получить свежую exact Agent pair от Agent lane и только на этих байтах собрать Store + transaction + stream + lock Stage-B.
4. Full Agent+Core matrix → exact coverage verifier → readiness verifier на реальном candidate-root.
5. Только затем один targeted native Windows Server 2022 Circle proof на тех же байтах.

В текущем проходе PR #7/#8 не двигались, Circle/Windows не запускались, live Notion/Codex/accounts/secrets/data/main/merge/production не трогались.
