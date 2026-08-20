# Kontur — продукт

## 2026-08-20 — exact head, zero-minute режим и четыре готовых bounded fix

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Действует последняя граница владельца из PR: hosted CI заморожен. Не запускать/перезапускать CircleCI или GitHub Actions и не делать push в продуктовую ветку, который заведомо вызовет hosted CI/Cloudflare build. Для браузерной проверки нужен бесплатный ChatGPT/container runner после материализации точного source snapshot. В File Library точного snapshot этого head пока не найден; старые браузерные артефакты относятся к более ранним версиям и не доказывают текущий hatch.

Что перепроверено на exact head:
- default `/` ведёт сразу в hook; q8 использует отдельный `visualQuestionIndex` и входит в `hatching` только после окончания ответа-жеста и готовности результата;
- hatch/reveal остаются одной сценой `QuizEgg`; две половины stage-08 shell находятся перед bird-layer, птица сохраняет финальную позу при переходе в reveal;
- reduced-motion для hatch и reward egg сокращает обязательные задержки;
- безопасный Cloudflare staging-путь остаётся отдельным: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`; production config для staging не использовать.

Первый точный source-level FAIL: `apps/miniapp/test/local-kontur.test.ts` всё ещё требует **три** вхождения `egg-stage-08.webp`, хотя текущий `QuizEgg.tsx` намеренно содержит ровно две читаемые половины скорлупы + `egg-crack-light.webp`, а специализированный `hatch-reveal-persistence.test.ts` уже фиксирует новый контракт. Старый тест надо привести к `2 shell + hatch light`, не возвращая третий фрагмент.

Второй продуктовый дефект: Home не показывает надетый окрас. Главный Home hero всё ещё рендерит `<ResultBird resultId={currentBird.resultId} />`, тогда как drop/collection используют canonical renderer с palette. Авторитетный источник уже есть в `GameState`: `state.player.palette`; серверный `buildState()` получает её из фактически выбранного `profiles.coloring`, а `/api/v4/local/coloring/equip` возвращает обновлённый state. Правильный bounded fix: заменить Home `ResultBird` на `CanonicalBirdVisual resultId={currentBird.resultId} palette={state.player.palette}`. BirdResultId не меняется: окрас остаётся косметическим слоем поверх того же персонажа.

Третий найденный дефект непрерывности: сам `QuizEgg` уже поддерживает prop `palette` и передаёт его `CanonicalBirdVisual`, но текущий вызов из `LocalKontur.tsx` передаёт только `stage`, `hatching` и `resultId`. Поэтому после успешного hatch сервер уже возвращает и экипирует начальный окрас, `state.player.palette` обновляется, но птица во время hatching/reveal остаётся в базовых цветах; после перехода на Home (когда второй fix будет применён) она внезапно сменит палитру. Это ломает ту самую непрерывную сцену. Правильный bounded fix: передать в текущий persistent `QuizEgg` авторитетную палитру результата, предпочтительно `palette={reveal?.state.player.palette ?? state?.player.palette ?? null}`. Это также корректно для replay: если новая серверная выдача не делается, используется уже надетая палитра текущего state.

Четвёртый точный дефект состояния: во время 260 мс реакции на ответ q2..q7 кнопка `← назад` остаётся кликабельной. `pick()` ставит `answerLock.current = true`, но условие показа back-кнопки проверяет только `index > 0 && !busy`, а обработчик back вообще не проверяет `answerLock`. В этот момент пользователь может вернуть `index/visualQuestionIndex` назад, после чего уже запланированный таймер из `pick()` всё равно выполнит `setIndex(index + 1)` со старым замыканием. Получается скачок назад-вперёд и рассинхрон визуального ответа. Bounded fix: скрывать/disable back при `answerLock.current || eggResponding` и дополнительно закрыть сам handler тем же guard; добавить timeline-регрессию `pick qN -> back ignored until response timer ends`. Для q8 `busy=true` уже скрывает back, дефект касается q2..q7.

Итого подготовленный продуктовый patch теперь четырёхчастный:
- `LocalKontur.tsx`: Home -> `CanonicalBirdVisual(... palette={state.player.palette})`;
- `LocalKontur.tsx`: persistent hatch/reveal `QuizEgg` получает `reveal?.state.player.palette ?? state?.player.palette ?? null`, чтобы цвет не прыгал между reveal и Home;
- `LocalKontur.tsx`: back-кнопка и её handler блокируются на время `answerLock/eggResponding`;
- `local-kontur.test.ts`: устаревшая 3-shell проверка -> 2-shell + hatch-light; добавить статическую/таймлайн-регрессию на palette-связи и back-during-response, чтобы эти дефекты не вернулись.

В продуктовую ветку patch **не пушился** из-за zero-minute режима. Это сознательная граница, а не отсутствие исправления.

Текущий внешний blocker для полной проверки: точные текстовые файлы head читаются через GitHub connector, но полный worktree с бинарными WebP/SVG assets пока не материализуется в container/File Library. Поэтому новый exact-head Chromium/визуальный PASS честно не заявлять.

Что делать следующим:
1. Пока zero-minute режим не снят — не пушить эти исправления в PR #12 и не запускать hosted CI.
2. Как только exact source snapshot `32034e8a...` станет доступен в container, сначала воспроизвести stale 3-shell FAIL, затем применить подготовленный patch и выполнить Mini App tests/typecheck/build локально.
3. После source green — Playwright в container: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Отдельно проверить ранний/средний/поздний hatch, стык hatch→reveal, `back during response` и `надеть окрас → Home → reload`: одна и та же птица должна сохранять выбранную палитру с момента вылупления до Home и после reload.
4. По свежим кадрам продолжить именно продуктовую правку, особенно интеграцию quiz-яйца, синхронность progress/ring/crack и общий art direction шести птиц; зелёный тест сам по себе не считать готовностью.
5. После browser+visual PASS — non-destructive `kontur-igor-staging` через generated staging config, затем Telegram WebView smoke. Production не трогать.
