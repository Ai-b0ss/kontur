# Kontur — продукт

## 2026-08-20 — exact head, zero-minute режим и два готовых bounded fix

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Действует последняя граница владельца из PR: hosted CI заморожен. Не запускать/перезапускать CircleCI или GitHub Actions и не делать push в продуктовую ветку, который заведомо вызовет hosted CI/Cloudflare build. Для браузерной проверки нужен бесплатный ChatGPT/container runner после материализации точного source snapshot. В File Library точного snapshot этого head пока не найден; старые браузерные артефакты относятся к более ранним версиям и не доказывают текущий hatch.

Что перепроверено на exact head:
- default `/` ведёт сразу в hook; q8 использует отдельный `visualQuestionIndex` и входит в `hatching` только после окончания ответа-жеста и готовности результата;
- hatch/reveal остаются одной сценой `QuizEgg`; две половины stage-08 shell находятся перед bird-layer, птица сохраняет финальную позу при переходе в reveal;
- reduced-motion для hatch и reward egg сокращает обязательные задержки;
- безопасный Cloudflare staging-путь остаётся отдельным: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`; production config для staging не использовать.

Первый точный source-level FAIL: `apps/miniapp/test/local-kontur.test.ts` всё ещё требует **три** вхождения `egg-stage-08.webp`, хотя текущий `QuizEgg.tsx` намеренно содержит ровно две читаемые половины скорлупы + `egg-crack-light.webp`, а специализированный `hatch-reveal-persistence.test.ts` уже фиксирует именно этот новый контракт. Значит старый тест устарел и должен быть приведён к `2 shell + hatch light`, без возврата третьего фрагмента.

Второй продуктовый дефект: Home не показывает надетый окрас. Главный Home hero всё ещё рендерит `<ResultBird resultId={currentBird.resultId} />`, тогда как drop/collection используют canonical renderer с palette. В этом запуске уточнён правильный источник палитры: **не нужно вычислять её через `colorings[]`**. `PlayerState` уже содержит `player.palette`; серверный `buildState()` получает её из фактически выбранного `profiles.coloring`, а `/api/v4/local/coloring/equip` после UPDATE возвращает именно новый `buildState`. Поэтому после equip и после reload `state.player.palette` — авторитетная палитра выбранного окраса.

Правильный bounded fix Home: заменить Home `ResultBird` на `CanonicalBirdVisual resultId={currentBird.resultId} palette={state.player.palette}`. BirdResultId при этом не меняется: окрас остаётся только косметическим слоем поверх того же канонического персонажа. Это заодно напрямую выполняет owner-требование «один персонаж = один визуальный канон».

Локально подготовлен точный двухфайловый patch для текущего head (`LocalKontur.tsx` + `local-kontur.test.ts`). В нём:
- Home использует `CanonicalBirdVisual` и `state.player.palette`;
- устаревшая 3-shell проверка заменена на 2-shell + hatch-light;
- добавлена статическая регрессия, что Home берёт palette из серверного player state и не возвращается к голому `ResultBird`.
Лёгкая проверка формы патча и TypeScript/JSX-разбора новой строки прошла в container. В продуктовую ветку patch **не пушился** из-за zero-minute режима.

Текущий внешний blocker для полной проверки: точные текстовые файлы head читаются через GitHub connector, но полный worktree с бинарными WebP/SVG assets пока не материализуется в container/File Library. Поэтому новый exact-head Chromium/визуальный PASS честно не заявлять.

Что делать следующим:
1. Пока zero-minute режим не снят — не пушить эти два исправления в PR #12 и не запускать hosted CI.
2. Как только exact source snapshot `32034e8a...` станет доступен в container, сначала воспроизвести stale 3-shell FAIL, затем применить подготовленный patch и выполнить Mini App tests/typecheck/build локально.
3. После source green — Playwright в container: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Отдельно проверить ранний/средний/поздний hatch, стык hatch→reveal и `надеть окрас → Home → reload`: та же птица должна реально получить выбранную палитру и сохранить её.
4. По свежим кадрам продолжить именно продуктовую правку, особенно интеграцию quiz-яйца, синхронность progress/ring/crack и общий art direction шести птиц; зелёный тест сам по себе не считать готовностью.
5. После browser+visual PASS — non-destructive `kontur-igor-staging` через generated staging config, затем Telegram WebView smoke. Production не трогать.
