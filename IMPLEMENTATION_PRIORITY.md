# Контур — приоритеты реализации

## P0 — закрыть доказательные хвосты без отката продукта

1. **Exact preview provenance `5dabce57`**
   - дождаться/зафиксировать read-only `PUBLIC_PROVENANCE_READONLY` по root/referenced JS/CSS/egg 01/08;
   - сопоставить measured frontend bytes с current build;
   - отдельно восстановить `5dabce57 hostname -> immutable Cloudflare Version ID -> Worker identity`;
   - только после полной доказательной цепочки использовать формулировку `byte-for-byte equals 5dabce57`.

2. **Runtime/build classification**
   - `tools/runtime-reachability.mjs` v2: runtime-import graph отдельно от type-only source graph;
   - `tools/miniapp-bundle-evidence.mjs`: Vite/Rollup `chunk.modules` + `renderedLength`, `build.write=false`;
   - получить exact-head artifacts и классифицировать спорные frontend/Worker modules;
   - удалять legacy только отдельным controlled diff после semantic/build/provenance proof.

3. **Exact-head clean handoff CI**
   - получить зелёный полный CI именно на финальном handoff commit;
   - прочитать reachability/bundle/public-provenance artifacts;
   - проверить share-safe ZIP + internal SHA manifest;
   - зафиксировать один стабильный handoff commit.

GitHub Actions connector сейчас отвечает 403 на runs/jobs, поэтому старый green не переносить на новый head.

## P1 — единая handoff-база

В PR #11 должны одновременно жить:

1. current README/HANDOFF/authority docs;
2. exact primary sources 13.08;
3. exact accepted STEP E evidence 14.08;
4. current A–E source;
5. Worker/D1/core/contracts + compatibility/reference code;
6. separated archive/provenance;
7. clean-checkout CI;
8. runtime/source reachability regression;
9. emitted-module build evidence;
10. read-only public provenance;
11. reproducible share-safe packaging;
12. guarded staging/production release infrastructure;
13. fail-closed direct production deploy.

Merge в `main` — только по отдельному явному разрешению owner.

## P2 — текущая продуктовая линия

Не начинать заново A/B/C/D/E.

Доказано:
- STEP A H3 — принят;
- STEP B one-egg continuity — принят;
- STEP C 8 physical crack states — принят;
- STEP D first-time flow — интегрирован;
- STEP E — принят и интегрирован: 5 backend roles / 6 visual results; owl и Kotosov раздельны; Kotosov только presentation-only `vibe` subtype при strict unique coder secondary score;
- 17.08 frozen handoff source прошёл guarded production deploy.

Следующий **продуктовый** шаг после инженерного handoff — человеческий smoke текущего продукта. Новые bird concepts/visual redesign — только отдельное owner decision.

## P3 — production/public verification

### ЗАКРЫТО: propagation race

После incident run `32030041504` новый verifier многократно дал `PRODUCTION_READONLY_EXACT_PASS` без Cloudflare/D1 writes и с `attempts=1`.

Подтверждённая стабильная серия public hashes:
- root: `175b2900bbf05cf4426dce272043b2f3dee591d96054881d1d95f8fd1dccbead`;
- egg 01: `ac5a7a4205b3cf55b8cea477b49794b48ded19cf084973fd87a642f56277b199`;
- egg 08: `6a0da2124b06d7c6440cd236024c017e36776007c0a1f0d903b74c977802bdc7`.

Не повторять destructive production reset для проверки.

### Текущий read-only proof

`.github/workflows/production-readonly-verify.yml` теперь дополнительно снимает безопасную public provenance сводку для:
- historical `5dabce57`;
- current production.

Она публикует только paths/status/bytes/SHA/exactCurrentDist/MIME-classification, без секретов/Cloudflare API/health payload.

## P4 — инженерная чистота

После exact reachability/build evidence:
- отделить CURRENT / COMPATIBILITY / genuinely removable code;
- не считать `import` доказательством product approval;
- не считать static runtime reachability доказательством emitted bytes;
- не считать static unreachability deletion permission;
- разделить migration lineages только там, где это доказанно нужно;
- сохранять clean-clone reproducibility и share-safe source package.

Особый naming debt: `ZERO_SEASON_ENABLED` сейчас технически включает current `/api/v4/local/*`; не путать это с возвращением старого `ZeroSeason.tsx` продукта.

## P5 — deployment safety

- `pnpm cf:deploy` / worker `pnpm deploy` должны оставаться fail-closed до сети;
- production — только guarded `.github/workflows/release-production.yml` после explicit owner authorization;
- staging — только isolated staging workflow;
- post-deploy verifier всегда ждёт exact fresh root generation и проверяет critical assets по MIME + SHA;
- production destructive path не использовать как read-only verification mechanism.

## Запрещённый scope creep

Не тратить время на tree/daily move/raid/forecast/Form II/inventory/storm/leaderboard/AI narrator и другие V4/V5 механики без нового явного решения owner.

Не откатывать продукт на STEP E: exact accepted evidence 14.08 + current source доказывают, что E уже пройден.

## Главное правило

Следующая работа должна либо:
1. снимать реальную неопределённость source/provenance/build;
2. повышать воспроизводимость/безопасность handoff;
3. доказывать current invariant тестом;
4. выполнять отдельное новое owner-approved product decision.

Всё остальное ниже по приоритету.
