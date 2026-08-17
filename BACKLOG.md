# Контур — актуальный backlog

**Обновлено:** 2026-08-17.  
Старый backlog сохранён в `docs/archive/legacy/BACKLOG_PRE_CANONICAL.md`.

## P0 — прежде чем отдавать код наружу

1. **Exact preview provenance**
   - связать `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev` с Cloudflare version metadata;
   - получить exact frontend asset hashes / Worker module identity;
   - найти matching source/worktree;
   - зафиксировать доказательство, а не сходство.

2. **Exhaustive tracked-file audit**
   Для каждого tracked file поставить ровно одну категорию:
   `CURRENT | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`.

3. **Runtime reachability audit**
   - определить, какие V1–V5 routes/screens/modules реально достижимы из current preview;
   - не удалять код только по названию;
   - product-dead + runtime-dead слои переносить/удалять отдельным контролируемым diff.

4. **Share-safe source package**
   - fresh checkout;
   - install/build/current tests PASS;
   - secret scan PASS;
   - deterministic archive + SHA manifest;
   - никаких runtime/private/history файлов.

## P1 — привести репозиторий в нормальную форму

- убрать оставшуюся историческую документацию из root в `docs/archive/`;
- сократить дублирующиеся handoff/state документы;
- сделать CI gate, который не позволяет current docs снова объявить legacy-механику текущей;
- отделить production runtime от local/reference контуров по структуре и документации;
- после exact source proof удалить доказанно мёртвые routes/components/tests/migrations only when safe.

## P2 — продукт после cleanup

Только после P0/P1:
- визуальный polish hook/quiz/cracks/reveal;
- mobile smoke;
- human smoke;
- дальнейшие фичи — только новым owner decision.

## Не делать

Не возвращать tree/daily move/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy только потому, что они встречаются в старом коде или документации.