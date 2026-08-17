# Контур — архитектура текущего проекта

## 1. Продуктовые контуры

### Mini App

`apps/miniapp`

Ответственность:
- hook;
- 8Q quiz UI;
- egg motion/cracks;
- bird reveal;
- Home;
- collection/equip UI;
- contextual community onboarding branch.

### Cloudflare runtime

`apps/worker`

Считать основным server/runtime candidate до завершения exact-preview provenance.

Ответственность:
- Mini App API;
- Telegram webhook/runtime;
- D1 access/migrations;
- current `/worm`/egg/coloration semantics;
- staging/deployment utilities вокруг Worker.

### Shared product logic

`packages/core`

Игровые правила и логика, которые должны быть независимо проверяемыми и не зависеть от визуальной оболочки.

### Contracts

`packages/contracts`

Общие типы/контракты между клиентом и runtime.

## 2. Локальный/reference контур

`apps/api`, `apps/bot`, `packages/db`

Сейчас НЕ удалять автоматически. Эти компоненты использовались как локальный/reference/test-контур и могут оставаться частью тестового/миграционного пути.

До reachability-аудита их статус: `COMPATIBILITY / TEST_INFRA / UNKNOWN`, а не «мусор».

## 3. Две семьи миграций

В репозитории исторически присутствуют миграции вокруг `packages/db` и `apps/worker`.

Правило cleanup:
- production/runtime D1 history не переписывать задним числом;
- сначала установить, какие миграции реально относятся к текущему Worker/runtime;
- локальные/reference migrations не смешивать с production lineage;
- дубли по названию не удалять без semantic/reachability proof.

## 4. Runtime product boundaries

Current frozen product contract:

`8Q once → bird → reply /worm → +1 → 5 worms = egg → guaranteed-new coloration → equip → persistence`

В runtime могут существовать routes/modules V2/V3/V4/V5. Их наличие означает только IMPLEMENTED/HISTORICAL, а не CURRENT PRODUCT.

## 5. Default routing

Целевой default flow:

`HOOK → 8Q → BIRD REVEAL → /worm → HOME`

Community onboarding сохраняется как отдельная contextual branch.

V4/V5/campaign-heavy surfaces не должны становиться default route без нового owner decision.

## 6. Deployment / provenance

Owner-visible current preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказана цепочка:

`preview hostname → immutable Cloudflare version → exact Worker bundle → exact Mini App assets → source commit/worktree`

нельзя утверждать, что `main`, v84 или найденный v86 candidate являются exact source этого preview.

Эта provenance-задача имеет P0 во время cleanup.

## 7. Environment boundary

В Git должны входить:
- source;
- manifests/lockfiles;
- migrations;
- tests;
- reproducible tooling;
- docs;
- config templates.

Не отдавать внешнему разработчику автоматически:
- `.env`;
- secrets/tokens;
- Telegram session/account data;
- production snapshots/data;
- local runtime state;
- private research/chat exports;
- encrypted runtime-state keys.

## 8. Safety

- no direct main push;
- no production deploy/write во время cleanup;
- no migration rewrite;
- no destructive reset;
- legacy runtime удалять только после provenance + reachability proof;
- один KONTUR writer по lane-lock protocol из issue #9.
