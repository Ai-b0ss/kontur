# Правила работы с проектом «Контур»

Эти правила действуют для всего репозитория.

## 1. Обязательный порядок чтения

Перед любым продуктовым выводом или изменением читать:

1. `CURRENT_PRODUCT.md`;
2. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
3. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
4. `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`;
5. `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`;
6. `docs/product/DECISION_LOG_2026-08-14.md`;
7. `IMPLEMENTATION_PRIORITY.md`;
8. `ARCHITECTURE.md`;
9. `PROJECT_STATE.yaml`;
10. `CODEBASE_MAP.md`;
11. `Ai-b0ss/kontur#9` — текущий CONTROL/owner override/CLAIM;
12. затем код/тесты конкретной задачи;
13. `docs/archive/` — только исторические доказательства.

**Никогда не выводить продуктовую механику из номера V1/V2/V3/V4/V5, имени feature flag или просто из факта существования/import/reachability кода. `IMPLEMENTED != PRODUCT APPROVED`.**

## 2. Замороженный current invariant

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed new cosmetic coloration -> equip -> reload persists`

Current first-time funnel:

`Какая ты птица в IT? -> hero egg -> 8Q -> 8 physical crack states -> hatching -> bird reveal -> /worm -> Home`

Без нового явного решения владельца не возвращать daily move/tree/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy и перегруженные старые surfaces.

## 3. Не откатывать visual/product history

Доказанный статус после 14.08:
- STEP A Hook Hybrid H3 — принят;
- STEP B one-egg continuity — принят;
- STEP C 8 deterministic crack states — принят;
- STEP D first-time flow — интегрирован в current runtime source;
- STEP E — принят owner и интегрирован;
- внутренних backend roles = 5;
- visual results = 6: magpie, woodpecker, jay, crane, owl, Kotosov;
- Kotosov — presentation-only `vibe` subtype, когда coder строго единственный сильнейший secondary score; tie/incomplete -> owl;
- backend scoring/weights/role taxonomy из-за Kotosov не расширять.

Поэтому запрещено самостоятельно возвращать проект к «сделать новый STEP A» или «теперь нужно придумать STEP E».

Exact accepted evidence лежит в `docs/product/evidence/` и защищено SHA gate.

## 4. Exact preview provenance gate

Historical owner preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказано `preview -> immutable Worker version -> exact bundle/assets -> source`:
- не утверждать, что `main`, v84, v86 или current HEAD byte-for-byte равны этому preview;
- не удалять runtime/design code по названию;
- сначала классифицировать reachability/provenance;
- UX preview можно использовать как historical visual reference, но не как Git provenance proof.

Отдельно уже доказаны v84 immutable Version ID и exact Worker-module SHA; не смешивать v84 с `5dabce57`.

## 5. Runtime reachability rule

Production bundle и current product — не одно и то же.

- `App.tsx` статически импортирует старые frontend surfaces;
- `apps/worker/src/api.ts` статически route-монтирует старые backend routers;
- следовательно, часть legacy/compatibility кода реально shipping;
- shipping/imported != current feature;
- не считать файл dead только потому, что default route до него не доходит;
- не считать файл current только потому, что bundler до него доходит.

Перед removal/refactor запускать `tools/runtime-reachability.mjs` и разбирать результат пофайлово.

`UNKNOWN` — допустимый статус. Догадки запрещены.

### ZERO_SEASON naming debt

`ZERO_SEASON_ENABLED` сейчас используется как backend gate current `/api/v4/local/*` через `zeroSeasonAllowed()`. Это историческое имя и **не означает**, что старый `ZeroSeason.tsx` UI снова current.

Guarded release configs обязаны держать current LocalKontur API включённым и старые experiment flags выключенными.

## 6. Текущий приоритет KONTUR

P0:
1. clean/reproducible handoff exact current head;
2. runtime reachability evidence + exhaustive classification;
3. exact historical preview provenance `5dabce57` насколько это доказуемо;
4. Codex lineage 14.08/evidence retention;
5. улучшение PR #11, а не новая параллельная cleanup-ветка.

Не генерировать новые A–E concepts без нового owner decision.

## 7. Автономная координация

Перед любой GitHub write по KONTUR проверить issue #9.

Owner override имеет приоритет над P1–P5 scheduling. Если KONTUR помечен `MANUAL_LOCKED`, фоновые P1–P5 не имеют права CLAIM/write/dispatch KONTUR до точного `OWNER OVERRIDE — RELEASE KONTUR`.

Один lane — один writer. Перед каждым mutable-пакетом повторно проверить CONTROL и отсутствие нового owner override/freeze.

## 8. Deployment safety

- no direct main push;
- no merge без нового явного разрешения owner;
- no production deploy/write во время обычного cleanup;
- не использовать `pnpm cf:deploy` / worker `pnpm deploy`: они намеренно fail-closed;
- production release — только reviewed `.github/workflows/release-production.yml` после owner authorization;
- staging — только isolated `.github/workflows/release-staging.yml` в разрешённом staging scope;
- production destructive reset не повторять ради retry/read-only verification;
- post-deploy proof обязан дождаться exact fresh `dist/index.html` generation и проверить assets по MIME+SHA.

## 9. Secrets/private state

Не публиковать:
- plaintext `.env`, `*.local`;
- Cloudflare/Telegram credentials;
- sessions/cookies/browser profiles;
- D1 dumps/backups;
- private research/chat exports;
- encryption keys.

`.runtime-state/` в Git — только encrypted `.gpg`.

Applied migrations не редактировать задним числом.

## 10. Cleanup policy

Historical docs — в `docs/archive/`, не удалять без необходимости.

Runtime-файлу назначать одну из категорий:

`CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`

Физическое удаление runtime допустимо только отдельным controlled diff после reachability + provenance evidence и тестов.

## 11. Проверки

Документальные изменения не требуют live deployment.

Изменения scripts/CI/runtime требуют соответствующий targeted check + полный clean-checkout gate. Не ослаблять тесты ради green и не переносить green со старого commit на новый head.

После существенной работы обновлять issue #9 точными commit/PR/tests/remaining risk; не заявлять CI PASS, пока exact head действительно не проверен.
