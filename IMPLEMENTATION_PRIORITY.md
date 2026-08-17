# Контур — приоритеты реализации

## P0 — закрыть доказательные хвосты без отката продукта

1. **Exact preview provenance `5dabce57`** — отдельная forensic-задача:
   `hostname -> immutable Cloudflare version -> exact bundle/assets -> exact source/worktree`.
   Пока цепочка не доказана, запрещена только формулировка `byte-for-byte equals 5dabce57`; обычный handoff это не блокирует.
2. **Exhaustive tracked-file classification / legacy reachability**:
   каждый спорный runtime-файл получает одну категорию
   `CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`.
   Удалять старый runtime только после доказанного reachability/provenance.
3. **Текущий deployed generation proof**:
   после incident 17.08 следующий live proof должен быть read-only/non-destructive и сначала доказать exact convergence свежего `dist/index.html` и двух approved egg assets. Не повторять production reset ради smoke.

## P1 — довести одну handoff-базу до зелёного состояния

В PR #11 должны одновременно жить:

1. `README.md` — входная точка для человека;
2. `CURRENT_PRODUCT.md` — короткая продуктовая конституция;
3. exact primary sources 13.08 в `docs/product/source/`;
4. exact accepted execution evidence 14.08 в `docs/product/evidence/`;
5. `PRODUCT_BRIEF_2026-08-13.md` + `DECISION_LOG_2026-08-14.md`;
6. `ARCHITECTURE.md` / `CODEBASE_MAP.md` / `HANDOFF.md`;
7. current runtime source A–E;
8. staging/production release infrastructure с post-deploy convergence guard;
9. clean-checkout CI + reproducible share-safe ZIP.

Merge в `main` — только по отдельному явному разрешению owner.

## P2 — текущая продуктовая линия

Не начинать заново A/B/C/D/E.

Доказанный статус:

- STEP A H3 — принят;
- STEP B continuity одного hero egg — принят;
- STEP C 8 physical crack states — принят;
- STEP D first-time flow — интегрирован в current runtime source;
- STEP E — принят и интегрирован: 5 backend roles / 6 visual results, отдельные owl и Kotosov, Kotosov только как presentation-only `vibe` subtype при strict unique coder secondary score;
- исторический следующий STEP F после E был safe Worker Version без traffic switch;
- 17.08 проект уже прошёл дальше исторического STEP F и был выложен guarded production workflow.

Поэтому следующий продуктовый шаг сейчас — **не новые bird concepts**, а корректный read-only/public verification текущей версии и затем человеческий smoke. Любой новый visual polish или переработка птиц — отдельное owner decision.

## P3 — инженерная чистота

После определения reachability спорных модулей:
- удалить/изолировать только доказанный dead legacy;
- разделить production/runtime migrations и local/reference migrations там, где это действительно нужно;
- устранить доказанные дубли/неиспользуемые entrypoints;
- сохранять clean-clone reproducibility;
- поддерживать share-safe source package;
- CI должен проверять именно current MVP invariant и exact product evidence.

## P4 — staging / deployment

Release verification теперь обязана:
- после deploy ждать exact SHA свежего `dist/index.html`, а не считать команду `wrangler deploy` достаточным доказательством propagation;
- проверять egg assets по MIME `image/webp` + exact SHA, чтобы SPA fallback не маскировался под картинку;
- использовать одинаковый convergence gate для staging и production;
- не запускать destructive production reset ради повторной read-only проверки;
- не переключать/не менять production без соответствующего owner разрешения.

Incident и доказательство: `docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`.

## Запрещённый scope creep

Не тратить время на tree/daily move/raid/forecast/Form II/inventory/storm/leaderboard/AI narrator и другие V4/V5 механики без нового явного решения owner.

Не откатывать продукт на STEP E только потому, что более старый `FINAL_TZ` описывает E как следующий gate: exact accepted evidence 14.08 и current runtime source доказывают, что E уже прошёл.

## Главное правило

Каждая следующая работа должна либо:
1. снимать реальную неопределённость о source/deployment;
2. улучшать уже принятый current funnel по отдельному owner decision;
3. повышать воспроизводимость/безопасность передачи;
4. доказывать тестом, что current invariant и exact evidence не сломаны.

Всё остальное ниже по приоритету.
