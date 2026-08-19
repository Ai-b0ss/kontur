# Kontur — продукт

## 2026-08-20 — reduced-motion теперь соблюдается и у настоящего reward egg

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий exact head `60142926e84160f2df6a821c95a0dc1b6e286a73`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались. GitHub Actions не запускались.

Что сделано в этом проходе: при просмотре настоящего пользовательского пути нашёл отдельную продуктовую недоделку — режим уменьшенной анимации уже сокращал quiz/hatch motion, но реальное яйцо за 5 червяков всё равно принудительно держало пользователя минимум 920 мс. Это противоречило общему reduced-motion контракту. `openEgg()` теперь использует `20 мс` в reduced-motion и прежние `920 мс` в обычном режиме; регрессия добавлена в `kontur-response-motion.test.ts`. Коммиты продукта: `5a1cbd72f98e4b7504c8418940dc35cd06d83e27` (тест) и `60142926e84160f2df6a821c95a0dc1b6e286a73` (исправление).

Что уже доказано раньше: настоящий Playwright/Chromium-прогон через общий CircleCI-проект `Ai-b0ss/qwen-free-api` проходил весь путь `hook -> q1...q8 -> hatch -> reveal -> /worm -> Home -> egg -> новый окрас -> equip` в сценариях 320×568 быстрый q8, 430×1000 медленный q8 + skip и 320×568 reduced-motion. Ошибок консоли/страницы/запросов и горизонтального overflow не было.

Предыдущий свежий визуальный прогон для `aa9575a0...` всё ещё висит pending: workflow `311762c8-8101-410e-a31a-4c76aeb4994e`, job `feabce19-2b0f-48a4-99d3-301b66877a79`. Поскольку product head изменился, запущен новый exact-head Chromium на `60142926...`: Qwen service branch `autopilot/kontur-browser-run-20260819-2`, trigger commit `bbef723960ff341f76207bb250af1ce5c6609ecb`, workflow `a31b0c43-61e7-431e-8c7d-b86a35ad16e6`, job `c0beb27e-1d48-49f1-8c0e-de565cd93cea`; на момент передачи статус `pending`. Он снова проходит полный путь и снимает natural hatch visual frames.

Текущий hatch остаётся на одной сцене `QuizEgg`: две половины скорлупы раскрываются над той же птицей; q8 видимое вылупление ждёт и окончание реакции на ответ, и готовый результат API. Legacy-правила в `local-kontur.css` физически ещё есть, но текущий correction-layer их надёжно перекрывает без `!important`; это косметический долг, не текущий блокер поведения.

Cloudflare staging пока отдельно не доказан: прошлый CircleCI staging был `BLOCKED_NO_CLOUDFLARE_TOKEN`, а встроенная Cloudflare-сборка раньше возвращала `Deployment failed` без доступного агенту лога. Production не трогать.

Следующий шаг: 1) снять результат exact-head workflow `a31b0c43-61e7-431e-8c7d-b86a35ad16e6`; 2) если green — открыть hatch-кадры и визуально проверить раннюю/среднюю/позднюю фазу, включая 320×568 и 430×1000; 3) исправлять только фактически видимую проблему; 4) затем изолированный Cloudflare staging без production-write; 5) Telegram WebView smoke. Если CircleCI снова зависнет без результата, не плодить бесконечные trigger-коммиты — продолжить независимую продуктовую проверку/исправления.
