# Контур — журнал решений 14.08.2026

**Назначение:** зафиксировать, что произошло ПОСЛЕ исходного ТЗ 13.08, чтобы новый агент не откатывал проект к состоянию «STEP A/STEP E ещё не сделаны».

**Exact source layer 13.08:** [`PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`](source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md) + [`FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`](source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md).  
**Byte-recovery proof / hashes:** [`source/README.md`](source/README.md).  
**Exact accepted evidence 14.08:** [`evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`](evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md) + [`evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`](evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md).

Этот журнал — более свежий execution-state поверх исходного FINAL_TZ; он не переписывает первичник задним числом.

## 1. Контекст

После разговора 13.08 и письменного alignment был запущен визуальный проход через Codex. Были подготовлены три hook-направления с большим фиолетовым яйцом:

- **A — «Объект желания»**: тактильный, более безопасный/симметричный;
- **B — «Гравитация»**: самый сильный масштаб, напряжение, рекламный первый кадр;
- **C — «Контурное гнездо»**: сильнее связь с визуальным языком Контур, но яйцо становится частью схемы.

Owner первоначально выбрал B и обсуждал смешивание достоинств B+C.

## 2. Feedback zezokuk

На comparison-board zezokuk сначала визуально «клюнул» на вариант A из-за читаемости целого яйца с расстояния, затем обсуждался масштаб и характер B/C.

После следующей итерации с очень крупным hero egg реакция была явно эмоционально положительной/мемной (включая сравнения с «яйцом страуса» и идею комичного hatch). Owner решил сохранить текущий вариант как baseline и позже ещё поиграться с ним.

**Важно:** это сильный положительный сигнал и выбранный baseline, но не запрет на дальнейший polish.

## 3. Фактически утверждённые visual gates

### STEP A — ПРИНЯТО

**Hook Hybrid H3** принят owner как базовое hook-направление.

Следствие:
- задача «придумать STEP A с нуля» закрыта;
- новые агенты не должны генерировать новые A/B/C без отдельного запроса;
- H3 и связанные с ним assets/mocks не являются legacy-мусором.

### STEP B — ПРИНЯТО

Один hero egg уменьшается/перемещается в позицию яйца первого вопроса.

Следствие:
- нельзя заменять это hard cut / исчезновением и появлением нового яйца;
- continuity одного объекта — часть принятого UX.

### STEP C — ПРИНЯТО

- 8 детерминированных стадий физического растрескивания;
- верхняя progress-strip и egg-ring выражают один и тот же прогресс;
- `1/8` соответствует первому вопросу;
- полный круг достигается на q8;
- ответы A–D оформлены единым editorial list.

### STEP D — СОБРАНО И ИНТЕГРИРОВАНО В CURRENT SOURCE

Исторически был собран единый исполняемый UI mock:

`approved hook → 8 вопросов → fixed demo result «сова» → отдельный /worm screen → фактический Home v84`

Также существовали:
- q8 → bird reveal WebM;
- render `430×1000`;
- render `320×568`;
- review screens `01–08`;
- общая flow board;
- проверенные HTML IDs/assets.

Полноценный browser smoke в той конкретной исторической QA-среде не был доказан из-за отсутствия Chromium executable. Это нельзя задним числом повышать до browser PASS.

При этом текущий runtime source уже содержит stage machine `hook -> questions -> hatching -> reveal -> worm -> home`, поэтому STEP D нельзя считать только потерянным мокапом.

### STEP E — ПРИНЯТО OWNER И ИНТЕГРИРОВАНО

Это более поздний слой, который прежняя краткая документация потеряла, но exact evidence 14.08 его восстанавливает.

Зафиксировано:
- внутренних backend-ролей по-прежнему **5**;
- визуальных результатов **6**: сорока, дятел, сойка, журавль, сова, Котосов;
- Котосов — отдельный **вайбкодер**, а не замена совы и не шестая backend-role;
- прямые роли остаются без изменений;
- для canonical `vibe` Котосов выбирается только когда `coder` строго выше `designer`, `creative` и `manager` как единственный сильнейший secondary score;
- ничья, неполные scores или любой сомнительный случай дают сову;
- backend `resolveRole`, веса вопросов, API и D1 не меняются;
- presentation-вариант `owl/kotosov` сохраняется локально для `player.userId`, чтобы reload не менял визуальный результат.

Exact evidence:
- `PREVIEW_INTEGRATION_GATE_2026-08-14.md` — SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`;
- в taxonomy evidence прямо записано owner approval `Утверждаю, работай дальше`;
- current `apps/miniapp/src/result-taxonomy.ts` реализует ту же схему, а `LocalKontur.tsx` использует её после canonical scoring.

Следствие: **STEP E закрыт. Не начинать новый Bird Character Direction как будто он ещё впереди.**

## 4. Исторический следующий gate после STEP E

После принятия STEP E официальным следующим этапом был:

**STEP F — одна безопасная Worker Version без переключения production traffic.**

Это историческая граница 14 августа. К 17 августа проект уже продвинулся дальше неё: frozen handoff source был выпущен guarded production workflow. Поэтому новый агент не должен снова начинать STEP F с нуля только из-за старого ТЗ.

Текущий release incident и безопасная следующая проверка зафиксированы в `docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`.

## 5. Provenance / recovery priority

Артефакты Codex 14.08 — часть current product lineage и должны быть найдены/классифицированы до физической очистки старых workspace:

- Hook A/B/C comparison board;
- H3 / hybrid hook assets;
- STEP B motion prototype;
- STEP C 8 crack states;
- STEP D executable mock;
- review screens 01–08;
- q8→bird WebM;
- flow board;
- STEP E character/result assets;
- связанные исходники/HTML/CSS/assets/prompts.

Но отсутствие отдельного декоративного артефакта больше не отменяет уже доказанные A–E: exact accepted text evidence и current runtime source имеют более сильный вес.

Пока exact связь исторического preview `5dabce57-...` с immutable Worker version/source не доказана, не использовать формулировку `byte-for-byte equals 5dabce57` и не удалять спорный runtime только по имени старой версии.
