# Kontur — продукт

## 2026-08-20 — exact head перепроверен, bounded patch сверён с исходниками

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Действует последняя граница владельца: hosted CI заморожен. Не запускать/перезапускать CircleCI или GitHub Actions и не пушить продуктовые изменения, которые заведомо вызовут hosted CI/Cloudflare build. Поэтому этот проход был source-level и не выдаёт отсутствие браузерного прогона за PASS.

Что заново проверено на exact head:
- default `/` ведёт сразу в hook; q8 использует отдельный `visualQuestionIndex` и входит в `hatching` только после окончания реакции на ответ и готовности результата;
- hatch/reveal остаются одной сценой `QuizEgg`; две половины stage-08 shell находятся перед bird-layer, птица сохраняет финальную позу при переходе hatch→reveal;
- reduced-motion для hatch и reward egg сокращает обязательные задержки;
- безопасный Cloudflare staging-путь остаётся отдельным: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`; production config для staging не использовать.

На exact head подтверждены четыре конкретные проблемы:
1. `apps/miniapp/test/local-kontur.test.ts` гарантированно устарел относительно текущего hatch сразу в трёх местах: требует 3 копии `egg-stage-08.webp` вместо 2 половин + `egg-crack-light.webp`, ищет старый CSS `animation-delay: 260ms`, которого больше нет, и старый комментарий про legacy hatch sibling, которого тоже больше нет. Старый тест source-level красный даже без запуска.
2. Home hero рендерит голый `ResultBird`, поэтому после `надеть окрас` состояние меняется, а большая птица на Home визуально не получает `state.player.palette`.
3. Сам `QuizEgg` уже умеет `palette`, но текущий persistent hatch/reveal вызов её не передаёт. После исправления Home это дало бы заметный скачок цвета между reveal и Home.
4. На q2..q7 во время ~260 мс реакции на ответ `answerLock.current=true`, но `← назад` остаётся доступной. Можно прыгнуть назад, после чего старый таймер ответа всё равно переводит вопрос вперёд.

Готовое исправление сохранено в управляющей ветке:
`autonomy/patches/KONTUR_PR12_BOUNDED_FIX_20260820.patch`
commit `af4219381d560c1e69f15d9840262a366179283a`.

В этом проходе patch заново сверен с фактическими файлами exact head `32034e8a…`: все целевые строки и импорты по-прежнему совпадают, то есть patch не протух из-за скрытого движения PR. Он делает только bounded изменения:
- Home -> `CanonicalBirdVisual(... palette={state.player.palette})`;
- persistent `QuizEgg` получает `reveal?.state.player.palette ?? state?.player.palette ?? null`;
- back-кнопка и handler закрыты на `busy/eggResponding/answerLock`;
- stale hatch-test приведён к 2 shell + hatch light и проверяет реальный React-gate `!eggResponding && hatchReady`, а не удалённый CSS-delay/legacy-комментарий;
- добавлены статические регрессии на palette continuity и back-during-response.

Дополнительный неблокирующий долг, который подтверждён по CSS: в `local-kontur.css` всё ещё лежит старый hatch-слой (включая правило, скрывающее quiz egg, старые три shell-фрагмента и старые keyframes). Новый `kontur-core-corrections.css` его перекрывает и текущий `QuizEgg` старые shell-классы уже не рендерит, поэтому это сейчас не отдельный пользовательский баг. Удалять большой legacy-блок вслепую до свежего локального/browser PASS не нужно; после применения bounded patch его можно подчистить отдельным маленьким diff, если не заденет glow/label/skip стили, которые всё ещё используются.

Что делать следующим:
1. При снятии zero-minute режима или появлении точного local snapshot применить `autonomy/patches/KONTUR_PR12_BOUNDED_FIX_20260820.patch` к exact head и сначала выполнить Mini App tests/typecheck/build локально.
2. Затем Playwright: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Отдельно проверить `back during response` и `надеть окрас → Home → reload`, а также одинаковую палитру от hatch/reveal до Home.
3. По свежим кадрам продолжить продуктовую правку: ранний/средний/поздний hatch, стык hatch→reveal, интеграция quiz-яйца, синхронность progress/ring/crack и общий вид шести птиц. Зелёный тест сам по себе не считать готовностью.
4. После browser+visual PASS — non-destructive `kontur-igor-staging` через generated staging config, затем Telegram WebView smoke. Production не трогать.
