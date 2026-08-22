# Контур — приоритеты после CORE revalidation

## P0 — сохранить доказанный кандидат

- PR #12 остаётся draft/open/unmerged.
- Не менять runtime/product baseline без нового требования или воспроизведённой mandatory regression.
- Любая новая runtime-правка требует нового exact-head test/typecheck/build/browser/staging binding.
- Не использовать старые provisional DONE comments вместо финальной матрицы и owner-package manifest.

## P1 — owner decision по выпуску

Отдельного явного разрешения требуют:

- merge PR #12 / merge или push в `main`;
- production promotion / traffic switch;
- любая запись в production Worker/D1;
- destructive D1 reset;
- изменение production secrets/Telegram configuration.

До такого решения техническая release readiness считается доказанной isolated staging, а не production-действием.

## P2 — optional forensic/maintenance

Эти работы не блокируют KONTUR_CORE_DONE:

- восстановление полной byte-chain исторического preview `5dabce57`;
- дальнейшая классификация legacy V1–V5 reachability/emitted bytes;
- удаление genuinely unreachable legacy только отдельным доказательным diff;
- необязательное визуальное полирование по новому owner request.

## P3 — обязательная дисциплина изменений

При новой mandatory regression:

1. привязать ошибку к exact head;
2. воспроизвести;
3. исправить минимально;
4. добавить regression;
5. повторить затронутую matrix;
6. повторить общие release gates, если изменился runtime/build/staging contract;
7. обновить exact manifest/evidence, не переписывая историю.

## Запрещённый scope creep

Без нового owner decision не возвращать tree/daily move/raid/forecast/Form II/inventory/storm/leaderboard/AI narrator и другие V4/V5 механики в default product.

## Главное правило

`KONTUR_CORE_DONE` привязан к exact release-record commit из owner-package `MANIFEST.json`. Он не переносится автоматически на будущий runtime commit.
