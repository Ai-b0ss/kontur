# Kontur — продукт

## 2026-08-19 — hatch CSS упрощён; свежий Chromium идёт на exact head

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий exact head `aa9575a0a568bc4ed63e791664d979044a8deaf6`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались. GitHub Actions не запускались.

Что уже доказано раньше: настоящий Playwright/Chromium-прогон через общий CircleCI-проект `Ai-b0ss/qwen-free-api` проходил весь путь `hook -> q1...q8 -> hatch -> reveal -> /worm -> Home -> egg -> новый окрас -> equip` в сценариях 320×568 быстрый q8, 430×1000 медленный q8 + skip и 320×568 reduced-motion. Ошибок консоли/страницы/запросов и горизонтального overflow не было.

В этом проходе убрана ещё одна хрупкость hatch-слоя. Раньше `kontur-core-corrections.css` вынужден был держать `opacity: 1 !important` и `filter: none !important`, потому что legacy `local-kontur.css` всё ещё содержит старое правило, скрывающее яйцо во время hatch. Теперь correction-selector специально более специфичен: `.lk-first-time.lk-first-time--hatching .lk-quiz-egg-stage` и аналог для reveal. Он побеждает старое двухклассовое правило независимо от порядка CSS, поэтому `!important` для видимости больше не нужен. Регрессия обновлена и запрещает возврат этих `!important`.

Коммиты продукта в этом проходе:
- `a05ae9d7248ae1cd0d42c767e26095e13d4a5815` — selector-specificity вместо `!important` для hatch visibility;
- `aa9575a0a568bc4ed63e791664d979044a8deaf6` — тест на независимость от порядка CSS и отсутствие `!important` для opacity/filter.

На общий CircleCI-исполнитель отправлен свежий exact head `aa9575a0...`: Qwen service branch `autopilot/kontur-browser-run-20260819-2`, trigger commit `8cdbd976e3b4201ebd1782c7cc719df09485e215`, workflow `311762c8-8101-410e-a31a-4c76aeb4994e`, job `feabce19-2b0f-48a4-99d3-301b66877a79`. На момент передачи статус `pending`. Этот прогон снова делает полный Chromium-путь и natural hatch visual capture.

Оставшийся технический долг: в `local-kontur.css` ещё физически лежат старое правило `.lk-first-time--hatching .lk-quiz-egg-stage { opacity: 0; filter: brightness(1.8); }` и базовый `.lk-quiz-hatch { z-index: 40; ... }`. Текущий продукт их надёжно перебивает более специфичными правилами, поэтому это уже не блокер поведения. Удалить их стоит обычным локальным patch-коммитом, когда есть нормальный checkout; не переписывать весь большой CSS через Contents API ради косметической чистки.

Cloudflare staging пока отдельно не доказан: CircleCI staging ранее остановился как `BLOCKED_NO_CLOUDFLARE_TOKEN`, а встроенная GitHub→Cloudflare сборка exact head раньше возвращала `Deployment failed` без доступного агенту лога. Production не трогать.

Следующий шаг: 1) снять результат workflow `311762c8-8101-410e-a31a-4c76aeb4994e`; 2) если green — открыть свежие hatch-кадры и глазами проверить раннюю/среднюю/позднюю фазу; 3) чинить только конкретную видимую проблему, если она есть; 4) затем изолированный Cloudflare staging без production-write; 5) Telegram WebView smoke. Не плодить новые тесты без конкретного продуктового вопроса.
