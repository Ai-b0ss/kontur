# Правила работы с проектом «Контур»

Эти правила действуют для всего репозитория.

## 1. Обязательный порядок чтения

Перед любым продуктовым выводом или изменением читать:

1. `CURRENT_PRODUCT.md`;
2. `docs/product/PRODUCT_BRIEF_2026-08-13.md`;
3. `docs/product/DECISION_LOG_2026-08-14.md`;
4. `IMPLEMENTATION_PRIORITY.md`;
5. `ARCHITECTURE.md`;
6. `PROJECT_STATE.yaml`;
7. `CODEBASE_MAP.md`;
8. `README.md`;
9. `Ai-b0ss/kontur#9` — текущие CLAIM/HEARTBEAT/RELEASE;
10. затем код/тесты конкретной задачи;
11. `docs/archive/` — только исторические доказательства.

**Никогда не выводить продуктовую механику из номера V1/V2/V3/V4/V5 или просто из факта существования кода. `IMPLEMENTED != PRODUCT APPROVED`.**

## 2. Замороженный current invariant

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed new cosmetic coloration -> equip -> reload persists`

Без нового явного решения владельца не возвращать daily move/tree/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy и перегруженные старые surfaces.

## 3. Не откатывать визуальную историю

После ТЗ 13.08 работа уже продвинулась:
- STEP A Hook Hybrid H3 — принят;
- STEP B one-egg continuity — принят;
- STEP C eight deterministic crack states — принят;
- STEP D executable flow mock — был собран/локально проверен;
- следующий предусмотренный gate — STEP E Bird Character Direction, если exact current preview/source не докажет более позднее owner-approved состояние.

Поэтому запрещено самостоятельно возвращать проект к «сделать новый STEP A / придумать три hook-концепции».

Артефакты Codex 14.08 (H3, B/C/D, screenshots 01–08, WebM, flow board, assets/source/prompts) считать `CURRENT_CANDIDATE / PROVENANCE_REQUIRED`, пока они не связаны с exact current source. Не архивировать их как legacy по одному имени папки.

## 4. Exact preview gate

Owner-current preview: `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`.

Пока не доказано `preview -> Worker version -> exact bundle/assets -> source`:
- не утверждать, что `main`, v84 или v86 равны deployed preview;
- не удалять legacy/runtime/design code по названию;
- сначала классифицировать reachability/provenance;
- UX preview можно использовать как owner-visible reference, но не как доказательство Git provenance.

## 5. Текущий приоритет KONTUR

P0:
1. exact provenance `5dabce57`;
2. recovery Codex lineage 14.08;
3. exhaustive tracked-file classification;
4. продолжение и улучшение PR #11, а не новая cleanup-ветка.

Staging PR #10 сохранять как отдельную инженерную линию, но owner cleanup/provenance priority сейчас выше, если issue #9 не содержит более свежего owner override.

## 6. Автономная координация

Перед любой GitHub write по KONTUR проверить issue #9 и действующий lane CLAIM. Один lane — один writer. Перед каждым пакетом mutable-операций повторно проверить CONTROL и победивший CLAIM. Не создавать параллельную cleanup/runtime ветку поверх активного writer.

## 7. Безопасность

- no force-push/reset чужой работы;
- no direct main push;
- no merge без нового явного разрешения owner;
- no production deploy/write во время обычного cleanup;
- Kontur staging writes только по отдельному staging scope;
- не публиковать `.env`, `*.local`, `.runtime-state/`, backups/data/research-private, Telegram IDs или другие secrets/personal data;
- applied migrations не редактировать задним числом.

## 8. Cleanup policy

Исторические docs перемещать в `docs/archive/`, а не удалять без доказательства. Runtime-код удалять только после exact-preview + reachability gate.

Для каждого tracked file итоговая категория:

`CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`

`UNKNOWN` — честный допустимый статус; догадки запрещены.

## 9. Проверки

Документальные cleanup-изменения не требуют live deployment. Кодовые изменения требуют targeted tests + соответствующий полный gate. Не ослаблять тесты ради green.

После существенной работы обновить issue #9 через HEARTBEAT/RELEASE с точными commit/PR/tests/next step.
