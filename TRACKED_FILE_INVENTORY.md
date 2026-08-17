# Контур — tracked-file inventory

**Статус:** handoff + forensic inventory · 2026-08-17  
**Ветка:** `cleanup/repo-hygiene-shareable-source`

Этот документ классифицирует слои передаваемой базы. Он различает два уровня:

1. **рабочий source handoff** — одна воспроизводимая GitHub-база, из которой другой разработчик может продолжить проект;
2. **forensic-complete handoff** — дополнительно закрыты exact historical preview provenance и per-blob reachability/classification старого runtime.

До завершения второго уровня PR #11 остаётся draft/current-candidate и не должен называться `byte-for-byte equals 5dabce57` или «полностью forensic closed».

Категории: `CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`.

## 1. Текущий управляющий слой — CURRENT

- `README.md`
- `CURRENT_PRODUCT.md`
- `PROJECT_STATE.yaml`
- `AGENTS.md`
- `AI_PROJECT_NAVIGATOR.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PRIORITY.md`
- `CODEBASE_MAP.md`
- `HANDOFF.md`
- `BACKLOG.md`
- `SHARE_SAFE_SOURCE.md`
- `TRACKED_FILE_INVENTORY.md`

Эти файлы — входная точка. Старые V1–V5 документы не имеют над ними продуктового приоритета.

## 2. Exact product authority/evidence — CURRENT

### Primary source 13.08 — RECOVERED EXACT

- `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`
  - SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`
  - SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`;
- `docs/product/source/README.md` — proof исходного context-kit, размеров, Git blobs и hash policy.

Эти файлы больше НЕ являются recovery blocker: raw bytes восстановлены и защищены CI.

### Accepted execution evidence 14.08 — RECOVERED EXACT

- `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`
  - SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`
  - SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`.

Они доказывают accepted STEP E и официальный переход к historical STEP F.

Derived/canonical navigation:
- `docs/product/PRODUCT_BRIEF_2026-08-13.md` — human-readable каноническое изложение ТЗ;
- `docs/product/DECISION_LOG_2026-08-14.md` — A–E execution state поверх ТЗ.

## 3. Текущая продуктовая линия

### CURRENT / доказано в source

- `apps/miniapp/src/App.tsx` — default surface = `LocalKontur`; V5 только по explicit `?campaign=v5`.
- `apps/miniapp/src/screens/LocalKontur.tsx` — stage machine `hook -> questions -> hatching -> reveal -> worm -> home`, community сохранён отдельной non-default стадией.
- `apps/miniapp/src/components/QuizEgg.tsx` — 8 deterministic stages, 45° progress/question.
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `egg-stage-08.webp` — физические стадии яйца.
- `apps/miniapp/src/result-taxonomy.ts` — пять backend roles / шесть visual results, включая accepted Kotosov presentation-only subtype.
- `apps/miniapp/src/local-kontur-model.ts`, `apps/miniapp/src/local-kontur.css` и bird/result assets, реально используемые `LocalKontur` — current product path.

### CURRENT_CANDIDATE / полный production-capable runtime

- `apps/miniapp/`
- `apps/worker/`
- `packages/core/`
- `packages/contracts/`

Причина `CURRENT_CANDIDATE`, а не `FORENSIC_EXACT_CURRENT`: historical owner preview `5dabce57...` ещё не связан доказательной цепочкой с immutable Cloudflare version/assets/source.

При этом:
- текущий Git export доказанно взят из изолированного Codex `v86-local-candidate/.../verification/result/source/kontur`;
- frozen handoff source `85290a821bdd1a5ceb170480eccdba4243bea997` прошёл guarded production release 17.08;
- release создал Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`;
- старый красный final smoke классифицирован как stale public asset generation, а не source absence.

Исторические routes/modules внутри runtime-каталогов не удаляются автоматически: они могут быть compatibility/recovery source. Их наличие **не делает механику current**.

## 4. COMPATIBILITY / local reference

- `apps/api/` — COMPATIBILITY.
- `apps/bot/` — COMPATIBILITY.
- `packages/db/` — COMPATIBILITY.

Они входят в передаваемую полную кодовую базу, потому что используются тестами/reference-сценариями и помогают воспроизводить систему. Они не объявляются вторым production runtime.

## 5. TEST_INFRA

- `.github/workflows/ci.yml` — clean-checkout verification.
- `.github/workflows/release-staging.yml` — isolated staging release proof.
- `.github/workflows/release-production.yml` — guarded production release; destructive reset path, не запускать для обычного read-only verification.
- `tools/cloudflare/make-staging-config.mjs` — staging isolation config.
- `tools/cloudflare/live-release-staging-smoke.mjs` — remote current-MVP smoke.
- `tools/cloudflare/wait-for-deployed-assets.mjs` — exact post-deploy generation convergence gate.
- `tools/cloudflare/wait-for-deployed-assets.test.mjs` — stale-generation/SPA-fallback regression.
- остальные `tools/` — TEST_INFRA или handoff/release utilities до более узкой классификации.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` — TEST_INFRA/build contract.
- `.env.example`, `.env.telegram-test.example` — TEST_INFRA/documentation only.
- `RESTORE_RUNTIME_STATE.ps1`, `RESTORE_RUNTIME_STATE.sh` — TEST_INFRA/recovery utilities.

`tools/handoff-safety-check.mjs` fail-closed контролирует current entrypoints/assets, exact product evidence hashes, отсутствие legacy authority в root и опасных plaintext/private tracked files.

## 6. PRIVATE_EXCLUDED

- `.runtime-state/` — в Git допускается только зашифрованный `.gpg`; ключ в repo отсутствует.
- реальные `.env`/секреты/Cloudflare credentials/Telegram sessions/cookies/browser profiles/D1 dumps/private research — не входят в обычный handoff.

## 7. ARCHIVE

Весь доказанно исторический продуктовый слой отделён в `docs/archive/legacy/`.

Туда перенесены без переписывания содержимого:
- прежние README/state/navigator/backlog/product direction/V5 specs;
- Stage 1/5/6/7 документы;
- старые handoff/design/research документы;
- большой исторический `WORKLOG.md`;
- `art-direction/`;
- `stage5-prototype/`;
- `direction-candidates-2026-08-07/`;
- `mvp-core-2026-08-08/`;
- старый `kontur-brief.html`.

Это архив, а не корзина: он сохранён для истории/recovery и не является текущим ТЗ.

## 8. PROVENANCE

`docs/provenance/` содержит:
- `SOURCE_PROVENANCE_LOCAL.json`;
- `INTEGRATION_README_2026-08-14.md`;
- `DERIVED_CANDIDATE_README.md`;
- `SNAPSHOT_INFO.txt`;
- `INITIAL_SHA256SUMS.txt`;
- `PRODUCTION_RELEASE_2026-08-17.md`.

Доказано отдельно:
- v84 immutable Version ID `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker module SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- current Git export origin = Codex v86 candidate source;
- `5dabce57` нельзя автоматически приравнивать ни к v84, ни к текущему Git head.

## 9. UNKNOWN / forensic follow-up

Пока остаётся UNKNOWN:
- exact immutable version/source mapping historical preview `5dabce57`;
- per-blob reachability части старого runtime внутри `apps/worker`/`apps/miniapp`, если она не покрыта current source/test paths;
- отдельные неиндексированные Codex review artifacts/WebM, которые полезны для provenance, но не отменяют доказанный A–E current state.

UNKNOWN означает «не удалять и не повышать до current без доказательства».

## 10. Что можно сказать получателю честно

**Можно:** это единая воспроизводимая Git-база, экспортированная из изолированного v86 candidate, содержащая exact product authority/evidence, current A–E UX, production-capable Worker/source, migrations, reference-контур, tests и release utilities.

**Нельзя:** пока нельзя обещать, что HEAD byte-for-byte равен historical preview `5dabce57` или что каждый legacy runtime blob forensic-classified.

## 11. Handoff gates

### Рабочий source handoff

Требуется:
1. current README/HANDOFF/authority docs;
2. exact primary + accepted evidence hashes green;
3. A–E source/assets присутствуют;
4. clean checkout/install/tests/typecheck/build green;
5. secret scan + reproducible share-safe archive green;
6. одна зафиксированная branch + commit.

### Forensic-complete handoff

Дополнительно:
1. закрыть `5dabce57 -> immutable CF version -> exact assets/source` настолько, насколько доказуемо доступными артефактами, с честным STOP если raw evidence отсутствует;
2. закончить exhaustive classification/reachability спорных tracked runtime blobs;
3. сохранить/проиндексировать найденную Codex lineage 14.08;
4. не оставлять формулировок, которые выдают UNKNOWN за PROVEN.

PR #11 остаётся draft до owner decision; merge в `main` только отдельно.
