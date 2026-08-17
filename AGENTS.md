# Правила работы с проектом «Контур»

Эти правила действуют для всего репозитория.

## 1. Источник истины

Перед любым выводом или изменением читать в таком порядке:

1. `CURRENT_PRODUCT.md`;
2. `PROJECT_STATE.yaml`;
3. `CODEBASE_MAP.md`;
4. `README.md`;
5. `Ai-b0ss/kontur#9` — текущие CLAIM/HEARTBEAT/RELEASE и автономный handoff;
6. только затем код/тесты конкретной задачи;
7. `docs/archive/` — лишь исторические доказательства.

**Никогда не выводить продуктовую механику из номера V1/V2/V3/V4/V5 или из факта, что код существует. `IMPLEMENTED != PRODUCT APPROVED`.**

## 2. Замороженный current invariant

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed new cosmetic coloration -> equip -> reload persists`

Без нового явного решения владельца не возвращать daily move/tree/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy и перегруженные старые surfaces.

## 3. Exact preview gate

Owner-current preview: `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`.

Пока не доказано `preview -> Worker version -> exact assets/source`:
- не утверждать, что `main` равен deployed preview;
- не удалять legacy runtime по названию;
- сначала классифицировать reachability/provenance;
- UX preview можно использовать как фактический owner-visible reference, но не как доказательство Git provenance.

## 4. Автономная координация

Перед любой GitHub write по KONTUR проверить issue #9 и действующий lane CLAIM. Один lane — один writer. Перед каждым пакетом mutable-операций повторно проверить CONTROL и победивший CLAIM. Не создавать параллельную cleanup/runtime ветку поверх активного writer.

## 5. Безопасность

- no force-push/reset чужой работы;
- no direct main push;
- no merge без нового явного разрешения owner;
- no production deploy/write во время обычного cleanup;
- Kontur staging writes только по отдельному staging scope;
- не публиковать `.env`, `*.local`, `.runtime-state/`, backups/data/research-private, Telegram IDs или другие secrets/personal data;
- applied migrations не редактировать задним числом.

## 6. Cleanup policy

Исторические docs перемещать в `docs/archive/`, а не удалять без доказательства. Runtime-код удалять только после exact-preview + reachability gate. Для каждого tracked file итоговая категория должна быть одна из:

`CURRENT | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`

`UNKNOWN` — допустимый честный статус; догадки запрещены.

## 7. Проверки

Документальные cleanup-изменения не требуют live deployment. Кодовые изменения требуют targeted tests + соответствующий полный gate. Не ослаблять тесты ради green.

После существенной работы обновить issue #9 через HEARTBEAT/RELEASE с точными commit/PR/tests/next step.