# Контур — как передать проект другому разработчику

## Короткий ответ

**Передавать одной ссылкой на private GitHub repository и конкретную текущую ветку/PR, а не случайным ZIP из Downloads.**

Текущая ветка для просмотра и передачи кода:

- repo: `Ai-b0ss/kontur`;
- branch: `fix/kontur-core-visual-continuity-20260818`;
- PR: `#12`;
- продуктовый код, отправленный на Chromium QA: `60d1703a958757dc27222338cc41a9349382efb5`;
- поверх него допускаются только документационные коммиты, не меняющие проверяемый runtime;
- PR остаётся draft до Chromium + isolated staging + Telegram/WebView proof;
- merge в `main` и production без отдельного явного разрешения запрещены.

База PR #12 — `cleanup/repo-hygiene-shareable-source` (PR #11). Она остаётся чистой handoff-основой, но для знакомства с **текущим** кодом следует открывать PR #12.

## Что является текущим продуктом

Первый пользовательский путь:

`Какая ты птица в IT? -> hero egg -> 8Q -> 8 crack stages -> hatching -> bird reveal -> /worm -> Home`

Игровой инвариант:

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed-new coloration -> equip -> reload persists`

Текущий visual/runtime контракт:
- STEP A H3 — accepted;
- STEP B one-egg continuity — accepted;
- STEP C 8 deterministic crack states — accepted;
- STEP D first-time flow — integrated;
- STEP E — accepted + integrated;
- 5 backend roles / 6 visual results, включая Kotosov presentation subtype;
- q1–q7 используют явный `visualQuestionIndex` для перехода N→N+1 во время ответа;
- q8 видимо переходит к hatching только после завершения жеста и готовности результата;
- hatching/reveal сохраняют одну сцену и один `QuizEgg`;
- скорлупа раскрывается двумя согласованными половинами поверх одной canonical bird сцены.

## Что ещё НЕ доказано

Для текущего продуктового SHA `60d1703a...` ещё обязательны:
1. реальный Chromium user journey в CircleCI;
2. исправление/доказательство isolated `kontur-igor-staging` Cloudflare build;
3. Telegram/WebView smoke;
4. только после этого решение о merge/release.

Пока эти пункты не закрыты, не надо заменять их новыми статическими аудитами или дополнительным визуальным полированием без воспроизведённой ошибки.

## Что читать получателю

1. `README.md`;
2. `CURRENT_PRODUCT.md`;
3. `docs/product/evidence/KONTUR_REQUIREMENT_MATRIX_2026-08-18.md`;
4. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
5. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
6. `ARCHITECTURE.md`;
7. `CODEBASE_MAP.md`;
8. затем код.

Основные current files:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- `apps/miniapp/src/components/CanonicalBirdVisual.tsx`;
- `apps/miniapp/src/q8-hatch-timeline.ts`;
- `apps/miniapp/src/quiz-egg-model.ts`;
- `apps/worker/src/local-kontur-api.ts`.

## Как проверить clone

```bash
git clone <repo>
cd kontur
pnpm install --frozen-lockfile
pnpm check
```

Но локальный `pnpm check` не заменяет текущий обязательный browser gate: финальный кандидат должен пройти настоящий Chromium user journey на зафиксированном продуктовом SHA.

## Что НЕ передавать

Не включать и не пересылать отдельно:
- `.env`;
- API tokens/secrets;
- Telegram cookies/sessions/accounts;
- Cloudflare credentials;
- production D1 dumps;
- browser profiles;
- encryption keys;
- private chat/research exports.

## Если человек просто просит «скинь код»

Если у него есть GitHub-аккаунт и он должен реально смотреть/ревьюить проект — дать ему доступ к private repo и ссылку на **PR #12 / ветку `fix/kontur-core-visual-continuity-20260818`**. Это лучше ZIP: видна история, diff и актуальная документация.

Если доступ в private GitHub давать не хочется — делать отдельный share-safe архив из этой ветки после secret/handoff gate. Не отправлять архив рабочего окружения и не включать секреты/дампы/профили.
