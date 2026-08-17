# Контур — как передать проект другому разработчику

## Короткий ответ

**Передавать одной ссылкой на private GitHub repository и конкретный проверенный handoff commit/ветку.**

Не отправлять случайный ZIP из Downloads и не просить получателя угадывать, какая из старых V1–V5 папок актуальна.

## Текущая handoff-база

- repo: `Ai-b0ss/kontur`;
- branch: `cleanup/repo-hygiene-shareable-source`;
- PR: `#11`;
- PR остаётся draft до финального owner decision;
- merge в `main` без отдельного явного разрешения запрещён.

Исторический owner-visible preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Критическая forensic-граница: exact byte-for-byte mapping `5dabce57 -> immutable Worker version -> exact asset hashes -> Git source` ещё не закрыт. Поэтому ветку можно называть **единой текущей рабочей source-базой/candidate handoff**, но нельзя называть exact recovered bytes этого конкретного preview.

## Что является продуктовой истиной

В порядке приоритета:

1. новое явное решение owner;
2. exact primary source 13.08 из `docs/product/source/`;
3. exact accepted execution evidence 14.08 из `docs/product/evidence/`;
4. `CURRENT_PRODUCT.md`;
5. производные `PRODUCT_BRIEF` / `DECISION_LOG`;
6. воспроизводимое current-source/deployment evidence;
7. архив V1–V5 — только история.

Exact primary files уже восстановлены byte-for-byte и закреплены SHA-256 в `tools/handoff-safety-check.mjs`.

## Что уже доказано в source

Current first-time flow:

`Какая ты птица в IT? -> hero egg -> 8Q -> 8 crack stages -> hatching -> bird reveal -> /worm -> Home`

Игровой инвариант:

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed-new coloration -> equip -> reload persists`

Статус visual gates:
- STEP A H3 — accepted;
- STEP B one-egg continuity — accepted;
- STEP C 8 deterministic crack states — accepted;
- STEP D first-time flow — integrated in current runtime source;
- STEP E — accepted + integrated;
- 5 canonical backend roles / 6 visual results;
- Kotosov — presentation-only `vibe` subtype при strict unique coder secondary score; tie/incomplete -> owl.

Основные current files:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/worker/src/local-kontur-api.ts`;
- `packages/core/src/index.ts`;
- `packages/contracts/src/index.ts`.

## Важная runtime-граница

Старый runtime **ещё не физически вычищен**.

`App.tsx` статически импортирует старые screens, а `apps/worker/src/api.ts` подключает старые routers. Поэтому часть V1–V5 кода реально входит в production bundle, хотя default UX/feature flags его не делают текущим продуктом.

Это означает:
- bundle reachability != product approval;
- старые modules нельзя удалять только по названию;
- сначала нужен reachability/provenance proof;
- `tools/runtime-reachability.mjs` строит воспроизводимый граф actual entrypoints и narrow LocalKontur feature closure.

Особый исторический naming debt: `ZERO_SEASON_ENABLED` сейчас используется как backend gate для `/api/v4/local/*`, хотя отдельный старый `ZeroSeason.tsx` surface не является current product. Не путать feature-flag name с продуктовой властью старого ZeroSeason UI.

## Что читать получателю

1. `README.md`;
2. `CURRENT_PRODUCT.md`;
3. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
4. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
5. `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`;
6. `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`;
7. `docs/product/DECISION_LOG_2026-08-14.md`;
8. `ARCHITECTURE.md`;
9. `CODEBASE_MAP.md`;
10. `IMPLEMENTATION_PRIORITY.md`;
11. затем код.

`docs/archive/` — история/provenance, не текущее ТЗ.

## Как проверить clone

```bash
git clone <repo>
cd kontur
pnpm install --frozen-lockfile
pnpm check
```

Для handoff-commit дополнительно нужен зелёный clean-checkout GitHub CI именно на зафиксированном head. Не переносить зелёный статус со старого commit на более новый.

CI также проверяет:
- exact primary/evidence hashes;
- current A–E source invariants;
- direct production deploy refusal;
- runtime reachability graph;
- deployment propagation regression;
- share-safe reproducible archive;
- isolated staging Wrangler dry-run.

## Deployment: что делать нельзя

**Не запускать `pnpm cf:deploy` и `pnpm -F @kontur/worker deploy`.**

Они намеренно завершаются fail-closed до Cloudflare request. Старый прямой путь обходил:
- rollback capture;
- exact production D1 identity check;
- explicit current runtime vars (`ZERO_SEASON_ENABLED=true`, old experiments off);
- post-deploy exact asset convergence proof.

Production release — только через `.github/workflows/release-production.yml` после отдельного owner authorization. Staging — через `.github/workflows/release-staging.yml`.

## Production incident 17.08

Run `32030041504` уже выполнил production D1 reset/migrations и deploy frozen source, создав Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

Последний red asset smoke получил старый public `index.html` после успешного deploy; `egg-stage-01.webp` вернулся как SPA fallback HTML. Это классифицировано как stale/public-generation race, а не отсутствие файла в source.

`docs/provenance/PRODUCTION_RELEASE_2026-08-17.md` содержит evidence и durable fix.

**Не повторять destructive production reset ради retry этого smoke.** Следующий live proof должен быть read-only/non-destructive.

## Что НЕ передавать

Не включать в обычный handoff:
- `.env`;
- API tokens/secrets;
- Telegram cookies/sessions/accounts;
- Cloudflare credentials;
- production D1 dumps;
- browser profiles;
- encryption keys;
- private chat/research exports.

Зашифрованный `.runtime-state/*.gpg` не является заменой безопасной отдельной передачи ключа.

## Сообщение разработчику

> Рабочая база «Контура»: `Ai-b0ss/kontur`, ветка `cleanup/repo-hygiene-shareable-source`, PR #11. Начни с `README.md`, `CURRENT_PRODUCT.md` и exact sources/evidence в `docs/product/source` + `docs/product/evidence`. Current flow A–E уже интегрирован: hook → 8Q/8 egg stages → bird reveal → `/worm` → Home; 5 backend roles дают 6 visual results, включая Kotosov presentation subtype. Старый V1–V5 runtime частично всё ещё shipping/reachable, но не является product authority. Не удаляй его без reachability proof. Не используй прямой `pnpm cf:deploy`; production только через guarded workflow после owner authorization. `5dabce57` остаётся historical forensic target, exact mapping к Git ещё не закрыт.

## Definition of handoff-ready

### Рабочий source handoff

Нужны одновременно:
- exact primary/evidence присутствуют и SHA gate green;
- current A–E source/assets присутствуют;
- clean clone install/check/tests/typecheck/build green на exact head;
- runtime reachability evidence сохранён;
- secret/private-state scan green;
- reproducible share-safe archive green;
- одна branch + один зафиксированный commit;
- прямой production deploy fail-closed.

### Forensic-complete handoff

Дополнительно:
- закрыть `5dabce57 -> immutable Cloudflare version -> exact assets/source` настолько, насколько позволяют raw evidence;
- закончить per-blob reachability/classification спорного runtime;
- проиндексировать восстановленную Codex lineage 14.08;
- не выдавать `UNKNOWN` за `PROVEN`.

До этого PR остаётся draft/current-candidate. Merge — только по отдельному owner-разрешению.
