# Kontur — продукт

## 2026-08-19 — Chromium зелёный; найден и исправлен реальный дефект hatch

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий exact head `6e599b8b43cf6793b452acfc8fe7a25e94897553`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались. GitHub Actions не запускались.

Базовый настоящий Playwright/Chromium-прогон exact head ранее прошёл через общий бесплатный CircleCI-проект `Ai-b0ss/qwen-free-api`: workflow `cbabbb12-6270-4521-9f0f-e987a1db66b8`, job `77943862-f27d-410e-9659-edc2610d1838`, SUCCESS. Три сценария: 320×568 быстрый q8; 430×1000 с `/hatch` +1500 мс и skip; 320×568 reduced-motion. Путь доходит `hook -> q1...q8 -> hatch -> reveal -> /worm -> Home -> egg -> новый окрас -> equip`; ошибок консоли/страницы/запросов и горизонтального overflow не было.

После этого визуальная проверка hatch выявила не формальную, а настоящую проблему: в `local-kontur.css` остался старый селектор `.lk-first-time--hatching .lk-quiz-egg-stage { opacity: 0; filter: brightness(1.8); }`. Из-за порядка CSS он мог скрывать единую сцену яйца именно во время вылупления, несмотря на новую архитектуру. На продуктовой ветке это исправлено в commit `1bbb957abe2a36ecf8fa50f33abb1dd053560ddf`: текущий correction-layer принудительно сохраняет `opacity:1` и `filter:none` независимо от порядка Vite CSS. Следующий commit `6e599b8b...` добавил регрессионную защиту от возврата этой проблемы.

Это временно надёжная защита, но технический долг очевиден: старое правило скрытия яйца надо удалить из `local-kontur.css`, после чего убрать `!important` и переделать тест так, чтобы он требовал отсутствия legacy-правила. Не делать это вслепую без полного содержимого файла/нормального рабочего checkout.

Cloudflare staging smoke через CircleCI ранее безопасно остановился как `BLOCKED_NO_CLOUDFLARE_TOKEN`: в CircleCI-проекте нет `CLOUDFLARE_API_TOKEN`; Cloudflare mutation не было, production D1 не затронута.

Следующий шаг: 1) забрать/просмотреть свежий bounded capture раннего/среднего/позднего hatch уже после `1bbb957a...`; если птица и скорлупа читаются хорошо — визуальную сцену считать принятой, иначе править только конкретный дефект и повторить один Chromium-прогон; 2) удалить legacy hide-rule при доступном checkout; 3) staging проводить через уже существующую Cloudflare-инфраструктуру без GitHub Actions и без production-write; 4) затем Telegram WebView smoke. Не плодить новые тесты без конкретного продуктового вопроса.
