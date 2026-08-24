# Notion — Core и Windows

## Exact heads и координация

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Текущий Core claim: issue #9 comment `5397793566`, target = promoted-installer-v3 exact reconstruction / real-NCM28 local matrix, без движения PR #7/#8.
- `NOTION_AGENT` отдельно владеет Agent product/materialization/full Agent matrix; Core её не дублирует.
- Circle connectivity = PASS; reconnect не нужен.
- Native Windows запрещён до exact same-byte Agent+Core FULL local PASS + coverage/readiness PASS.

## Fresh Agent boundary

На exact Agent head `12e3c4fe...` уже есть фазовый offline safety PASS без product-ref mutation.
Exact transformed pair:
- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

Agent matrix не повторять. После Core installer + Stage-B local green использовать только эти fresh exact bytes, если head не сдвинулся.

## Доказанная Stage-B база Core

- Stage-A fail-closed floor: V32 exact local PASS.
- Durable store candidate: `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`.
- Transaction helper: `b3fe792b99daad678e3c773db291576bdf179167`; regression `478fa18a2917861917ade1a444735757e6d75198`.
- Stream failure projection: `a094a4b5484384037fb02c07d345b73531a46091`; regression `8d5fadf31aeff034d09e9943b25249402a2207b0`; local 10/10.
- Server-owned lock boundary: `2f92c2abe56e2d4be39c4930a63dd876aca52294`; regression `b280001743064a86b61306c160820d9b88329672`; local 6/6.
- После durable provider-intent каждый осознанный внешний шаг выполняется без неявного account failover; обычная Agent-ротация вне защищённой транзакции сохраняется.

Это база, не FULL Stage-B PASS: её ещё надо наложить на одну exact Agent-pair и прогнать одной same-byte матрицей.

## Promoted installer v3 — exact apply-ready runtime

Legacy Core `integrated_upgrade.py` остаётся Git blob `0f4393e656307e3b17dfab105464de551f12a05d`; исторический `run_upgrade()`/v2 остаётся inner stage и не переписывается.

Exact materializer:
- Git blob `63d8ece12c7a6671f09d8d85b56854de28ed8d6f`.

Exact outer-v3 runtime до нового identity fix:
- size `23686`;
- SHA-256 `65b4cc0476f793dd390d45cced31e01714075bf4fea628b624ccdb75e3734f65`;
- whole Git blob `2321b7033e49ea82acad1119f2485e76d66fb933`.

Exact ordered parts:
1. `0208bc87a6c47cc4d9f0adf5b771ee13de0884cc` / 6000;
2. `be8f99112772aacde090138bea76d0210fe50a29` / 6000;
3. `1be5b50e45f4d25e9db3a7f11dc5a26ab14d93d3` / 6000;
4. `53d366dc9bf90b0df48ab6df3533ad4db3364c53` / 5686.

Все четыре exact blobs теперь также существуют в `notion-agent-bridge` как content-addressed Git objects; product refs от этого не двигались.

До нового дефекта были доказаны только:
- materializer local 4/4;
- runtime selftest 7/7;
- fake targeted 8/8.
Это НЕ real-NCM28 full installer PASS.

## NEW BLOCKER — durable file identity теряется в outer-v3 journal

Exact runtime выше содержит воспроизводимый ownership-defect.

`_pack_preimage(snapshot)` сохраняет только `exists/data_b64/sha256/size`, но теряет NCM28 `parent_identity` и `file_identity`. `_restore_one(...)` после crash сравнивает текущую PRE/NEW только по bytes. Поэтому чужой файл с теми же bytes, но другим inode/FileId, может быть принят за transaction-owned и затем перезаписан/удалён rollback'ом.

Это противоречит exact Core NCM28 contract: `OwnershipSnapshot` уже содержит `parent_identity + file_identity`, а `atomic_write(...)` возвращает NEW snapshot с новой identity.

Локальное воспроизведение на реальной FS:
`PROMOTED_V3_SAME_CONTENT_FOREIGN_IDENTITY_ADOPTION_REPRODUCED`.

Durable evidence:
`autonomy/evidence/notion/20260824T1915Z_promoted_v3_durable_identity_gap.json`
(commit `e0d5646435ee6659fea6bf74f86c6427a252a6b4`).

### Minimal Core-only fix candidate

Unreferenced exact blobs в `notion-agent-bridge`:
- deterministic identity-fix materializer: `c72b82c96eca2175eb449e188cb49602a2ca1c81`;
- targeted secure regression: `43debcae4b2ef1c68d377677373c5ef9ecb2e264`.

Fix design:
1. durable PRE descriptor хранит `parent_identity/file_identity`;
2. после каждого successful `atomic_write` returned NEW identity пишется в `written_identities` и journal durable-update происходит до следующего шага/injection;
3. PRE no-op, NEW rollback, post-write verify и verified recovery требуют bytes + exact identity;
4. если процесс умер после write, но до durable NEW-identity publication, recovery fail-closed вместо adoption по bytes.

Сам transform компилируется локально, но exact reconstructed-runtime execution этого fix ещё не объявлен PASS.

## Disposable exact Linux proof

Создан отдельный diagnostic PR #35 от exact Core, product refs не двигаются:
- branch `ci/notion-promoted-v3-identity-linux-20260824`;
- current head `5c52181ecdd0fe251c30768a534e3fb690e38a76`;
- base `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- changed paths only diagnostic `.circleci/*` + `.promoted-v3/*`;
- label `run-ci` установлен.

Job должен на одних exact bytes:
1. reconstruct old runtime and verify whole size/SHA/git-blob;
2. exact-materialize legacy `integrated_upgrade.py`;
3. reproduce old identity bug;
4. apply `c72b82...` fix;
5. compile fixed runtime;
6. run `43debca...` regression: foreign NEW same bytes reject, owned NEW rollback, owned PRE no-op, foreign PRE same bytes reject.

На момент handoff GitHub combined status = `[]`: это не PASS/FAIL и не повод запускать дубликат. Circle connectivity отдельно уже PROVEN.

## Secondary boundary — не чинить раньше первого identity gate

Recovery runtime также содержит path-based проверки `payload_dir`/owner marker/listing. Отдельная локальная POSIX-модель показала, что canonical path может уже указывать на replacement directory, пока held directory handle остаётся на исходном объекте. Это следующий кандидат на real-NCM28 matrix, но по правилу первого воспроизводимого root cause сначала закрывается durable file identity.

## Final gate pins (current, до добавления новой installer identity regression)

Current control verifiers:
- final coverage: `8254f36b14fb240c7d6466c7241d2d735ea310d9`;
- Windows readiness: `0b53153f2ea424d989692bfe0f8a7b6faa36c897`.

После exact targeted PASS нового identity regression оба gate должны быть ужесточены так, чтобы финальный same-byte suite не мог забыть promoted-installer-v3 identity recovery test. До этого не менять их формально.

## Следующий обязательный порядок

1. Не создавать второй CI run, пока PR #35 не дал новый факт.
2. Если PR #35 FAIL: забрать первый exact failure, минимально исправить Core identity fix, повторить тот же Linux targeted gate.
3. Если PR #35 PASS: провести repository-local real-NCM28 installer matrix на exact fixed runtime: clean + STOPPED + crash points + rollback + same-content replacement + symlink/junction/namespace swap + interrupted legacy-v2.
4. Первый новый reproducible FAIL → минимальный Core-only fix → тот же matrix.
5. Только full local installer PASS → наложить Stage-B на fresh Agent pair `c9ca... + 273db...` → полный same-byte Agent+Core suite.
6. Wiring/readback новой installer identity regression в final coverage; coverage PASS → readiness PASS на real candidate-root.
7. Только затем ОДИН targeted native Windows Server 2022 proof на тех же bytes.
8. Targeted Windows green → полный promoted Ubuntu+Windows/exact-source/security → owner-doctor → isolated runtime restore → real Codex→bridge→Notion acceptance.

## Запреты/границы

- Windows сейчас НЕ READY и не запускался.
- PR #7/#8 refs не двигались.
- Live Notion/Codex/accounts/secrets/user data/main/merge/production не трогались.
- Не переносить исторический PASS на новый promoted/runtime composition.
