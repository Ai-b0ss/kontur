# Контур — tracked-file inventory

**Статус:** практический handoff-аудит · 2026-08-17  
**Ветка:** `cleanup/repo-hygiene-shareable-source`

Этот документ классифицирует слои передаваемой базы. Полная forensic-классификация каждого отдельного исторического runtime blob остаётся отдельной задачей и **не блокирует передачу исходников разработчику**, пока эти слои сохранены и не выдаются за текущие фичи.

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

## 2. Текущая продуктовая линия

### CURRENT / доказано в source

- `apps/miniapp/src/App.tsx` — default surface = `LocalKontur`; V5 только по explicit `?campaign=v5`.
- `apps/miniapp/src/screens/LocalKontur.tsx` — stage machine `hook -> questions -> hatching -> reveal -> worm -> home`, community сохранён отдельной не-default стадией.
- `apps/miniapp/src/components/QuizEgg.tsx` — 8 deterministic stages, 45° progress/question.
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `egg-stage-08.webp` — физические стадии яйца.
- `apps/miniapp/src/local-kontur-model.ts`, `apps/miniapp/src/local-kontur.css`, result/bird assets, используемые `LocalKontur` — current product path.
- `docs/product/PRODUCT_BRIEF_2026-08-13.md` — каноническое удобное изложение ТЗ.
- `docs/product/DECISION_LOG_2026-08-14.md` — зафиксированный прогресс H3/B/C/D после ТЗ.

### CURRENT_CANDIDATE / полный рабочий runtime

- `apps/miniapp/`
- `apps/worker/`
- `packages/core/`
- `packages/contracts/`

Причина `CURRENT_CANDIDATE`, а не byte-exact current: owner preview `5dabce57...` ещё не связан доказательной цепочкой с exact Cloudflare assets/source. При этом текущий Git export доказанно взят из изолированного `v86-local-candidate/.../verification/result/source/kontur`, а не из случайной старой Downloads/K:-папки.

Исторические routes/modules внутри этих каталогов не удаляются при обычном handoff: они могут быть нужны совместимости и воспроизводимости. Их наличие **не делает механику current**.

## 3. Compatibility / local reference

- `apps/api/` — COMPATIBILITY.
- `apps/bot/` — COMPATIBILITY.
- `packages/db/` — COMPATIBILITY.

Они входят в передаваемую полную кодовую базу, потому что используются тестами/reference-сценариями и помогают воспроизводить систему. Они не объявляются вторым production runtime.

## 4. TEST_INFRA

- `.github/`
- `tools/`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `.env.example`, `.env.telegram-test.example`
- `RESTORE_RUNTIME_STATE.ps1`, `RESTORE_RUNTIME_STATE.sh`

CI теперь отдельно запускает `tools/handoff-safety-check.mjs`: он контролирует current entrypoints/assets, отсутствие legacy authority в корне и опасных plaintext/private файлов.

## 5. PRIVATE_EXCLUDED

- `.runtime-state/` — в Git допускается только зашифрованный `.gpg`; ключ в repo отсутствует.
- реальные `.env`/секреты/Cloudflare credentials/Telegram sessions/cookies/browser profiles/D1 dumps/private research — не входят в обычный handoff.

## 6. ARCHIVE

Весь исторический продуктовый шум физически отделён от рабочего корня в `docs/archive/legacy/`.

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

Это архив, а не корзина: он сохранён для истории/recovery и не должен использоваться как текущее ТЗ.

## 7. PROVENANCE

`docs/provenance/` хранит доказательства происхождения экспортированного source:
- `SOURCE_PROVENANCE_LOCAL.json`;
- `INTEGRATION_README_2026-08-14.md`;
- `DERIVED_CANDIDATE_README.md`;
- `SNAPSHOT_INFO.txt`;
- `INITIAL_SHA256SUMS.txt`.

Первичные документы 13.08 найдены в ChatGPT File Library, но старый Library object не предоставляет нам доказанно byte-preserving raw download. Поэтому `docs/product/source/README.md` честно оставляет exact-byte import незакрытым. Это не препятствует передаче кода и канонического ТЗ, но запрещает называть производный текст byte-exact оригиналом.

## 8. Что можно сказать получателю честно

**Да:** это полная текущая рабочая Git-база, экспортированная из проверенного изолированного v86 candidate, содержащая актуальный H3/B/C/D product path, backend, migrations, reference-контур, tests и release utilities.

**Нет:** пока нельзя обещать, что HEAD этой ветки byte-for-byte равен immutable preview `5dabce57`.

## 9. Практический handoff gate

Перед передачей требуется:
1. current README/HANDOFF;
2. H3/B/C/D source + assets присутствуют;
3. clean GitHub checkout/install/tests/typecheck/build green;
4. `Handoff safety gate` green;
5. одна зафиксированная handoff branch + commit.

Exact `5dabce57` provenance и построчная forensic-классификация каждого legacy runtime blob — отдельный повышенный audit gate, не блокирующий обычную передачу разработчику.
