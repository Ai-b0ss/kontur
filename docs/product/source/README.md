# Первичные продуктовые источники

Этот каталог предназначен только для неизменяемых первичных материалов, из которых выведены текущие продуктовые документы «Контура».

## Обязательные exact-source файлы

В каталог импортированы **точные исходные байты**, без переписывания, сокращения, исправления орфографии или реконструкции:

1. `PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — первичный источник: Gemini-транскрипция разговора Игорь ↔ zezokuk 13 августа 2026 и связанные письменные уточнения.
2. `FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — полное итоговое ТЗ после разговора, включая обязательный порядок STEP A–F, review-артефакты, тесты и release contract.

## Exact recovery proof — 2026-08-17

Исходным контейнером доказанно является `KONTUR_NEXT_CHAT_CONTEXT_KIT_2026-08-13.zip`, сохранённый в ChatGPT File Library 13 августа 2026.

Контейнер:
- size: `1251216` bytes;
- SHA-256: `6c06502a54e19a57c27031fe0cd3a73cb44e19a75d8676887f29baa335033577`.

`PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`:
- size: `19713` bytes;
- SHA-256 exact bytes: `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- Git blob SHA: `563bc6bc88796e1d93ff1182a13aab40b03bd7bf`;
- source encoding/newlines: UTF-8, no BOM, LF, `CRLF=0`.

`FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`:
- size: `11023` bytes;
- SHA-256 exact bytes: `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`;
- Git blob SHA: `6915cd09ba603ecdd32cc886de776d1f485d6bd6`;
- source encoding/newlines: UTF-8, no BOM, LF, `CRLF=0`.

Git blob SHA для каждого файла был независимо вычислен из recovered raw bytes как `sha1("blob <size>\\0" + bytes)` и совпал с blob SHA, возвращённым GitHub после записи. Это доказывает отсутствие изменения байтов при импорте в Git object database.

CI/handoff gate дополнительно обязан проверять SHA-256 этих файлов из clean checkout, чтобы будущая нормализация/редактирование fail-closed ломали проверку.

## Fail-closed правило импорта

Exact-source считается доказанным только когда для каждого файла зафиксированы:

- исходный объект/архив, из которого получены байты;
- размер в байтах;
- SHA-256 exact bytes;
- отсутствие нормализации CRLF/LF при переносе;
- Git blob SHA после записи;
- clean-checkout SHA-256 verification.

Для двух обязательных файлов выше первые пять пунктов закрыты. Clean-checkout verification является постоянным CI-инвариантом, а не разовой ручной отметкой.

Производные `PRODUCT_BRIEF_2026-08-13.md` и `DECISION_LOG_2026-08-14.md` — удобная каноническая интерпретация, но **не заменяют первичник**.

## Иерархия

При споре о смысле требований:

1. новое явное решение владельца;
2. exact primary source из этого каталога;
3. `../PRODUCT_BRIEF_2026-08-13.md`;
4. `../DECISION_LOG_2026-08-14.md`;
5. `CURRENT_PRODUCT.md` как краткая текущая конституция;
6. исторические V1–V5 документы — только свидетельства прошлого.

## Отдельно: работа 14 августа через Codex

Материалы H3 / STEP B / STEP C / STEP D, review screens `01–08`, WebM, flow board, assets/source/prompts — это `CURRENT_CANDIDATE / PROVENANCE_REQUIRED`, а не legacy. Их нельзя удалять или архивировать только по имени старой папки. После восстановления их происхождение должно быть связано с `docs/product/DECISION_LOG_2026-08-14.md` и, если возможно, с exact preview/source lineage.

## Что запрещено

- редактировать первичники «для красоты»;
- заменять их пересказом;
- коммитить дополнительные приватные чаты, которые не входят в утверждённые два первичных документа;
- публиковать секреты, Telegram ID, токены, production data;
- менять exact source без одновременного осознанного обновления закреплённых хэшей и нового owner-approved provenance decision.
