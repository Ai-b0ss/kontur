# Контур — актуальный backlog

**Обновлено:** 2026-08-17.  
Старый backlog: `docs/archive/legacy/BACKLOG_PRE_CANONICAL.md`.

## HANDOFF — текущая задача

Цель: одна ссылка/commit с полной рабочей кодовой базой и доказанным product state.

Сделано в PR #11:
- exact primary source 13.08 восстановлен из исходного context-kit и импортирован byte-for-byte;
- exact SHA-256 primary source закреплены в fail-closed CI;
- accepted STEP E evidence 14.08 восстановлен и также закреплён exact SHA-256;
- current product/TZ/decision log отделены от истории;
- H3/B/C/D/E path подтверждён в current source;
- текущая таксономия = 5 backend roles / 6 visual results, включая отдельного Котосова как presentation-only `vibe` subtype;
- старые product docs/art/prototypes отделены в `docs/archive/legacy/`;
- происхождение Git-export вынесено в `docs/provenance/`;
- README/HANDOFF/ARCHITECTURE/CODEBASE_MAP/AGENTS/NAVIGATOR синхронизированы с recovered A–E;
- `tools/package-handoff.ps1` строит share-safe ZIP из фактического `git ls-files`, secret-scan и SHA-256 manifest;
- staging/production release workflows находятся в handoff-базе;
- post-deploy verifier ждёт exact SHA свежего `dist/index.html` и проверяет critical egg assets по MIME + exact SHA;
- regression воспроизводит stale-generation race и SPA fallback;
- direct `pnpm cf:deploy` / worker `pnpm deploy` теперь fail-closed до любого Cloudflare request;
- regression закрепляет direct-deploy refusal;
- `tools/runtime-reachability.mjs` v2 разделяет runtime-import graph и source-dependency graph, исключая type-only imports из runtime;
- reachability regression проверяет `import type`, runtime legacy candidates и dynamic egg-template assets;
- `tools/miniapp-bundle-evidence.mjs` добавлен для более сильного Vite/Rollup evidence: `chunk.modules` + `renderedLength`, `build.write=false`;
- production incident run `32030041504` классифицирован без повторного destructive reset.

Практический handoff считается готовым после зелёного CI **exact текущего head**, чтения reachability/bundle evidence и фиксации стабильного commit. Merge в `main` требует отдельного явного owner-разрешения.

## ЗАКРЫТО — exact primary source 13.08

`KONTUR_NEXT_CHAT_CONTEXT_KIT_2026-08-13.zip` доказан как исходный контейнер.

Импортированы exact bytes:
- `PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- `FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`.

Не возвращать этот пункт в unresolved/recovery без нового противоречащего evidence.

## ЗАКРЫТО — STEP E / bird taxonomy

Exact 14.08 evidence доказывает owner acceptance:
- `PREVIEW_INTEGRATION_GATE_2026-08-14.md` — SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`.

Current source реализует эту схему через `result-taxonomy.ts` и `LocalKontur.tsx`.

Не генерировать новые STEP E concepts как будто этот gate не проходили.

## ЗАКРЫТО — production propagation / stale-asset incident

Исходный production run `32030041504`:
- rollback evidence сохранён;
- D1 reset + migrations завершены;
- deploy завершён;
- Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1` создан;
- health PASS;
- immediate post-deploy asset smoke попал в старое public generation и вернул SPA fallback вместо `egg-stage-01.webp`.

После исправления verifier workflow `.github/workflows/production-readonly-verify.yml` многократно дал `PRODUCTION_READONLY_EXACT_PASS`, **без Cloudflare/D1 writes**, каждый раз с `attempts=1` на последовательных PR merge-builds.

Последняя подтверждённая стабильная серия в control issue использует exact public hashes:
- root SHA-256 `175b2900bbf05cf4426dce272043b2f3dee591d96054881d1d95f8fd1dccbead`;
- egg 01 SHA-256 `ac5a7a4205b3cf55b8cea477b49794b48ded19cf084973fd87a642f56277b199`;
- egg 08 SHA-256 `6a0da2124b06d7c6440cd236024c017e36776007c0a1f0d903b74c977802bdc7`.

Следствие: старый propagation race больше не является открытым release blocker. **Не повторять destructive production reset.**

## FORENSIC P0 — остаётся открытым

### 1. Historical preview `5dabce57`

Цель:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev -> immutable Cloudflare Version ID -> exact Worker/assets -> exact source/worktree`

Уже есть:
- v84 immutable Version и exact Worker-module SHA — отдельная доказанная линия;
- current Git export origin из Codex v86 candidate — отдельная доказанная линия;
- production 17.08 Version ID — отдельная доказанная линия;
- read-only public provenance probe, который снимает root/referenced JS/CSS/egg 01/08 hashes у `5dabce57` и current production.

Сейчас автоматически идёт обновлённый read-only workflow, который должен вывести безопасную сводку `PUBLIC_PROVENANCE_READONLY` прямо в issue #9. До появления этой сводки не делать вывод о совпадении frontend bytes.

Даже если измеренные frontend assets `5dabce57` совпадут с current build, всё равно отдельно останется `hostname -> immutable Cloudflare Version ID` и Worker identity.

### 2. Legacy runtime / build classification

Два уровня evidence:

1. `runtime-reachability-v2`:
   - static runtime-import graph без type-only imports;
   - source-dependency graph с type-only deps;
   - narrow LocalKontur graphs;
   - public asset refs.
2. `miniapp-bundle-evidence-v1`:
   - Vite production build с `write=false`;
   - Rollup `chunk.modules`;
   - `renderedLength > 0` как evidence, что модуль реально внёс код в generated chunk для exact build.

Не путать:
- static runtime reachable ≠ emitted bundle bytes;
- emitted bundle bytes ≠ current product approval;
- static unreachability ≠ deletion permission.

Удаление legacy — только отдельным controlled diff после exact artifacts + semantic review.

### 3. Codex artifact retention

По возможности дособрать H3/B/C/D/E review boards/WebM/assets из Library/Codex lineage в provenance/evidence индекс. Отсутствие отдельного декоративного артефакта не отменяет уже доказанный current source и exact accepted text evidence.

## CI / handoff gate — текущий инфраструктурный хвост

GitHub Actions connector сейчас отвечает `403 Resource not accessible by integration` на `runs/jobs/check-runs`.

Поэтому:
- exact текущий head **не объявлять CI-green**;
- green со старого commit не переносить;
- production read-only bot comments можно использовать как доказательство публичных frontend bytes, но не как замену полного CI;
- когда Actions API снова станет доступен, первым делом получить exact-head CI и artifacts:
  - runtime reachability;
  - Mini App Rollup bundle evidence;
  - public provenance;
  - share-safe packaging result.

## Не делать

Не возвращать tree/daily move/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy только потому, что они встречаются в старом runtime/archive.

Не повторять D1 reset или полный production release ради verification.

Не использовать direct production deploy commands — они намеренно fail-closed.

Не удалять legacy на основании одного static-import графа.

Не merge PR #11 без отдельного явного разрешения owner.
