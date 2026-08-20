# Kontur — продукт

## 2026-08-20 — exact head, zero-minute режим и два конкретных дефекта

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Действует последняя граница владельца из PR: hosted CI заморожен. Не запускать/перезапускать CircleCI или GitHub Actions и не делать push в продуктовую ветку, который заведомо вызовет hosted CI/Cloudflare build. Для браузерной проверки нужен бесплатный ChatGPT/container runner после материализации точного source snapshot. В File Library точного snapshot этого head пока не найден; доступен старый `kontur_chromium_walkthrough.html`, но он относится к более ранней версии и не доказывает текущий hatch.

Что перепроверено на exact head:
- default `/` ведёт сразу в hook; q8 использует отдельный `visualQuestionIndex` и входит в `hatching` только после окончания ответа-жеста и готовности результата;
- hatch/reveal остаются одной сценой `QuizEgg`; две половины stage-08 shell находятся перед bird-layer, птица сохраняет финальную позу при переходе в reveal;
- reduced-motion для hatch и reward egg сокращает обязательные задержки;
- безопасный Cloudflare staging-путь остаётся отдельным: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`; production config для staging не использовать.

Найден первый точный source-level FAIL, который не требует браузера: `apps/miniapp/test/local-kontur.test.ts` всё ещё утверждает, что в `QuizEgg.tsx` должно быть **три** `egg-stage-08.webp`. Текущий продукт намеренно перешёл на две читаемые половины, и отдельный `hatch-reveal-persistence.test.ts` уже правильно требует ровно две. Значит exact head детерминированно содержит устаревший тест и полный Mini App test-run должен падать на этом противоречии. Исправление простое: старую проверку привести к контракту `2 stage-08 shell + egg-crack-light`, не возвращая третий фрагмент.

Найден второй продуктовый дефект: Home не показывает надетый окрас. `equip()` и серверное состояние меняют `colorings[].equipped`, коллекция/drop используют `LocalBirdVisual`/`CanonicalBirdVisual` с `palette`, но главный Home hero рендерит голый `<ResultBird resultId={currentBird.resultId} />` без палитры. В итоге пользователь нажимает «надеть окрас», состояние сохраняется и карточка помечается активной, а основная птица визуально остаётся базовой. Это противоречит смыслу механики «новый косметический окрас → надеть → reload сохраняет состояние». Бounded fix: вычислять `equippedColoring` из `colorings`, рендерить Home тем же canonical renderer с `equippedColoring.palette` (с безопасным fallback на базового `ResultBird`) и добавить регрессию, что Home использует equipped palette, не меняя BirdResultId.

Что делать следующим:
1. Пока zero-minute режим не снят — не пушить два исправления в PR #12 и не запускать hosted CI. Держать их как точные bounded patches.
2. Как только точный source snapshot `32034e8a...` материализуется в ChatGPT/container, первым делом запустить локально `pnpm` Mini App tests/typecheck/build: stale 3-shell test должен воспроизвестись; затем применить оба bounded fixes локально и повторить.
3. После source green — Playwright в container: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Отдельно проверить ранний/средний/поздний hatch, стык hatch→reveal и что после «надеть окрас» Home-птица реально меняет косметическую палитру и сохраняет её после reload.
4. После browser+visual PASS — non-destructive `kontur-igor-staging` через generated staging config, затем Telegram WebView smoke. Production не трогать.
