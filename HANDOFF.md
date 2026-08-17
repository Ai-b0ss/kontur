# Контур — как передать проект другому разработчику

## Короткий ответ

**Предпочтительный способ передачи — ссылка на private GitHub repository и конкретный handoff commit/ветку.**

Не отправлять случайный ZIP из Downloads и не просить получателя угадывать, какая из старых V1–V5 папок актуальна.

## Текущая handoff-база

Пока `main` содержит историческое смешение поколений, рабочая база передачи:

- repo: `Ai-b0ss/kontur`;
- branch: `cleanup/repo-hygiene-shareable-source`;
- PR: `#11`;
- текущий owner-visible preview: `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`.

КРИТИЧЕСКАЯ ГРАНИЦА: exact byte-for-byte mapping `5dabce57 -> Worker version -> asset hashes -> Git source` ещё не доказан. Поэтому ветку можно называть **текущей полной рабочей кодовой базой/candidate handoff**, но нельзя называть exact recovered bytes конкретного preview, пока provenance gate не закрыт.

## Что уже доказано в самом исходнике

Это не только документация. В текущей handoff-ветке реальный Mini App runtime содержит принятую 14.08 продуктовую линию:

- `App.tsx` default-route ведёт в `LocalKontur`;
- `LocalKontur.tsx` содержит funnel `hook -> questions -> hatching -> reveal -> worm -> home`;
- hook использует headline `Какая ты птица в IT?`;
- hero/quiz используют один `QuizEgg` visual object;
- `QuizEgg.tsx` детерминированно выбирает `egg-stage-01.webp` ... `egg-stage-08.webp`;
- ring progress = 45° на вопрос, полный круг на q8;
- community intro сохранён в source отдельным stage, но default stage = `hook`;
- реальный reward-egg и текущие backend/API контракты не переписывались cleanup-веткой.

То есть Hook H3 / Step B / Step C реально присутствуют в source, а не только в историческом отчёте. Step D flow также представлен в `LocalKontur` stage machine; exact equivalence конкретному review-mock/preview остаётся provenance-задачей.

## Что читать получателю

В таком порядке:

1. `README.md`;
2. `CURRENT_PRODUCT.md`;
3. `docs/product/PRODUCT_BRIEF_2026-08-13.md`;
4. `docs/product/DECISION_LOG_2026-08-14.md`;
5. `ARCHITECTURE.md`;
6. `CODEBASE_MAP.md`;
7. `IMPLEMENTATION_PRIORITY.md`;
8. затем `apps/miniapp`, `apps/worker`, `packages/core`, `packages/contracts`.

`docs/archive/` — история и provenance, не текущее ТЗ.

## Как запустить

После clone базовая проверка должна проходить без домашнего ПК владельца:

```bash
git clone <repo>
cd kontur
pnpm install
pnpm check
```

Текущий GitHub CI для PR #11 проходит успешно. Production Cloudflare/D1/Telegram для локальной разработки не нужен.

## Что НЕ отправлять отдельным сообщением/архивом

Не включать в обычный handoff:
- `.env`;
- API tokens/secrets;
- Telegram cookies/sessions/accounts;
- Cloudflare credentials;
- production D1 dumps;
- локальные browser profiles;
- ключи шифрования;
- private chat/research exports.

Зашифрованный runtime-state в repo не является заменой отдельной передачи ключа. Если получателю действительно нужны credentials, передавать их отдельно через согласованный секретный канал с минимальными правами.

## Короткое сообщение разработчику

> Это текущая рабочая база «Контура»: `Ai-b0ss/kontur`, ветка `cleanup/repo-hygiene-shareable-source` / PR #11. Начни с `README.md` и `CURRENT_PRODUCT.md`; там отделён текущий продукт от V1–V5 истории. Актуальный first-time flow уже есть в `apps/miniapp/src/screens/LocalKontur.tsx`: hook `Какая ты птица в IT?` → 8 вопросов с 8 стадиями яйца → bird reveal → `/worm` → Home. Старые механики в коде/архиве не считать утверждёнными фичами. Production без согласования не трогать. Preview `5dabce57...workers.dev` — текущий визуальный ориентир owner; exact byte provenance к Git ещё проверяется.

## Definition of handoff-ready

Для практической передачи кода достаточно:
- README объясняет продукт, запуск и структуру;
- current product отделён от history;
- кодовая линия H3/B/C/D присутствует и CI green;
- secrets/private state не требуются для build/test;
- получателю дана одна branch/commit, а не набор локальных папок.

Для **forensic/exact-preview-ready** дополнительно требуется закрыть `5dabce57` provenance и exhaustive tracked-file classification. Это повышенная планка доказательности, а не блокер обычной передачи исходников разработчику.
