# Notion — Core и Windows

## Exact heads и координация

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Активный Core claim: issue #9 comment `5397406356`, до `2026-08-24T19:22:00+03:00`.
- `NOTION_AGENT` отдельно владеет Agent materialization/full Agent matrix; Core её не дублирует и PR #8 не двигает.
- Circle connectivity = PASS. Reconnect не нужен.
- Native Windows запрещён до exact same-byte Agent+Core FULL local PASS + coverage/readiness PASS.

## Fresh Agent evidence

На exact head `12e3c4fe...` Agent уже дал фазовый offline safety PASS без product-ref mutation:
- transformed pair: `account_pool.py=c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066;
  `server.py=273db94a8f9b153e95c910df221755e28c0f46a7` / 116047;
- Circle workflow `a7ea07cd-ffdf-49cd-ad1f-94e73e3a6965`: precompose 21 SUCCESS, composed 37 SUCCESS;
- Windows не запускался.

## Доказанная Stage-B база Core

- Stage-A fail-closed floor: V32 exact local PASS.
- Durable store candidate: `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `b3fe792b99daad678e3c773db291576bdf179167`; regression `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection: `a094a4b5484384037fb02c07d345b73531a46091`; regression `8d5fadf31aeff034d09e9943b25249402a2207b0`; local 10/10.
- Server-owned lock boundary: `2f92c2abe56e2d4be39c4930a63dd876aca52294`; regression `b280001743064a86b61306c160820d9b88329672`; local 6/6.
- После durable provider-intent каждый осознанный внешний шаг выполняется без неявного account failover; обычная Agent-ротация вне защищённой транзакции сохраняется.

## Promoted installer — точный переход от модели к реализации

Exact legacy Core `integrated_upgrade.py` остаётся Git blob `0f4393e656307e3b17dfab105464de551f12a05d`.
Его исторический `run_upgrade()` и v2 journal/keyset/payload-sha semantics **не переписываются**.

В этом проходе собран новый apply-ready слой:

### 1. Детерминированный exact materializer

`materialize_promoted_installer_v3.py`:
- size `2759`;
- SHA-256 `b7c0428c6ab63bb4825e70cf20070a6d14fa046f992bc473ded42718255532d6`;
- Git blob `63d8ece12c7a6671f09d8d85b56854de28ed8d6f`.

Он:
- принимает только exact preimage `integrated_upgrade.py@0f4393e...`;
- не меняет исторический `run_upgrade()`;
- добавляет отдельный `run_promoted_upgrade(...)` entrypoint;
- требует точные anchors, запрещает повторную материализацию и компилирует итог;
- локальный self-test: PASS 4/4.

### 2. Outer-v3 runtime на реальных NCM28 API

Текущий exact runtime:
- whole size `23686`;
- SHA-256 `65b4cc0476f793dd390d45cced31e01714075bf4fea628b624ccdb75e3734f65`;
- whole Git blob при конкатенации `2321b7033e49ea82acad1119f2485e76d66fb933`.

Immutable Git chunks, порядок конкатенации обязателен:
1. `0208bc87a6c47cc4d9f0adf5b771ee13de0884cc` / 6000;
2. `be8f99112772aacde090138bea76d0210fe50a29` / 6000;
3. `1be5b50e45f4d25e9db3a7f11dc5a26ab14d93d3` / 6000;
4. `53d366dc9bf90b0df48ab6df3533ad4db3364c53` / 5686.

Все четыре blob созданы exact-bytes и перечитаны. Старый unattached blob `1f35ff5d...` ошибочен и каноническим не является.

Runtime использует уже существующие Core/NCM28 primitives:
- `operation_lock`;
- pending/recover atomic journal;
- `guarded_directory` / `create_guarded_directory`;
- ownership snapshots;
- `atomic_write(... expected_snapshot, parent_guard)`;
- guarded unlink/delete.

Инварианты текущего кандидата:
- legacy v2 остаётся bounded inner stage, максимум 2 вызова (первый может только восстановить interrupted v2);
- outer-v3 имеет отдельный durable journal;
- `bridge` замораживается до определения существования `bridge/payload`;
- journal публикуется **до** остановки RUNNING bridge;
- absent `bridge/payload` создаётся CREATE_NEW под удерживаемым `bridge` guard и получает exact owner marker до child writes;
- overlay preimages записываются долговечно; nested children при absent parent имеют synthetic-absent preimage;
- write/rollback допускают только exact PRE или exact transaction NEW; foreign drift закрывает восстановление;
- installed marker содержит exact promoted manifest;
- verified recovery сначала заново доказывает exact outputs/lifecycle и лишь затем очищает journal/owner marker.

Локальные результаты:
- `py_compile` PASS;
- runtime self-test `7/7` PASS;
- targeted fake-Core execution `8/8` PASS.

### 3. Дефекты, найденные именно исполнением и исправленные

1. Recovery после prewrite/rollback раньше мог вернуть PASS после восстановления одного Core, хотя promoted overlay ещё не установлен.
   Исправлено: recovery возвращает `RETRY`; fresh overlay начинается только после освобождения operation lock.
2. Наличие `bridge/payload` сначала проверялось path-based до фиксации identity `bridge`.
   Исправлено: existence читается relative к удерживаемому `DirectoryGuard`.
3. RUNNING bridge сначала останавливался, а durable v3 journal публиковался позже — crash в этом окне оставлял STOPPED без recovery record.
   Исправлено: durable journal публикуется до `lifecycle.stop()`, затем отдельно фиксируется phase `stopped`.

Долговечное evidence:
`autonomy/evidence/notion/20260824T1838Z_promoted_installer_v3_apply_ready_runtime.json`
(commit `e86767817ee806a5c17911bb127836f8da658356`).

## Что ещё НЕ доказано

Нельзя объявлять promoted installer / Stage-B / Windows зелёными, пока не пройдены:
1. реконструкция runtime из четырёх exact Git blobs и exact materialization `integrated_upgrade.py@0f4393e...`;
2. repository-local запуск этой пары против **настоящих** NCM28 классов, а не fake adapter;
3. реальная crash/identity/alias matrix, включая original STOPPED lifecycle, owner-marker drift, junction/symlink/namespace swap и interrupted legacy-v2;
4. затем same-byte composition на свежей Agent pair `c9ca... + 273db...` со Store/transaction/stream/lock Stage-B;
5. полный Agent+Core suite → exact coverage → readiness на реальном candidate-root;
6. только затем один targeted Windows Server 2022 proof на тех же байтах.

## Следующий обязательный шаг

Без нового архитектурного исследования:
- exact reconstruct runtime по blob list;
- exact materialize `integrated_upgrade.py@0f4393e...`;
- прогнать repository-local promoted-installer NCM28 matrix;
- первый воспроизводимый FAIL → минимальный Core-only fix → тот же targeted matrix;
- при полном локальном PASS перейти к same-byte Stage-B composition.

В этом проходе PR #7/#8 не двигались; Circle/Windows, live Notion/Codex, аккаунты, секреты, main/merge/production не трогались.
