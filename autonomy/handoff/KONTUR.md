# Kontur — продукт

## 2026-08-19 — настоящий Chromium-прогон текущего PR #12 прошёл

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `f1c518c632b1637a672923a1a359f6746fabdb6b`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались. GitHub Actions не запускались.

Через общий бесплатный CircleCI-проект `Ai-b0ss/qwen-free-api` проведён реальный Playwright/Chromium-прогон exact head. Итоговый доказанный прогон: workflow `cbabbb12-6270-4521-9f0f-e987a1db66b8`, job `77943862-f27d-410e-9659-edc2610d1838`, SUCCESS. В опубликованном `summary.json` PASS во всех трёх сценариях:

- `320×568`, быстрый q8: `hook -> q1...q8 -> hatch -> reveal -> /worm -> Home -> egg -> новый окрас -> equip`;
- `430×1000`, ответ `/hatch` искусственно задержан на 1500 мс: q8 остаётся на месте до ответа API, затем hatch; `skip animation` приводит в тот же результат;
- `320×568`, reduced-motion: тот же путь до equip без поломки состояния.

Во всех трёх сценариях: `0` horizontal overflow, `0` console errors, `0` page errors, `0` failed requests, `0` unexpected API. После явного ожидания окончания перехода `hook -> quiz` bounding box яйца на q1/q4/q8 совпадает точно (`maxQuizEggDriftPx=0`) на обоих размерах. То есть старый FAIL по «прыгающему яйцу» оказался ошибкой самого теста: q1 снимался во время штатного уменьшения большого hero egg.

Визуальную часть не объявлять полностью закрытой только по зелёному тесту. Низкосжатый кадр q8 реально просмотрен: маленькое фиолетовое яйцо и кольцо находятся в верхней композиции, явного горизонтального выезда нет. Ранний кадр hatch слишком близок к началу анимации и не доказывает читаемость птицы внутри; для этого запущен отдельный bounded capture раннего/среднего/позднего hatch через тот же Chromium. Следующий проход должен первым делом забрать его кадры и посмотреть их глазами.

Отдельно попытались перенести безопасный non-destructive Cloudflare staging smoke в CircleCI. Workflow `d6a55fb0-f7e5-4539-a8aa-c545ff126223`, job `31531281-6c3a-4635-bdb5-4d8871709b0a` завершился безопасным `BLOCKED_NO_CLOUDFLARE_TOKEN`: в CircleCI-проекте нет `CLOUDFLARE_API_TOKEN`. Скрипт остановился ДО Cloudflare mutation; `productionWrite=false`, `d1Write=false`. Staging Worker: `kontur-igor-staging`, staging D1 `22786b4b-99cc-4ca5-a18b-932e8781021b`, production D1 `91e39e7e-70fc-4551-8d3e-48235e70f985` не затронута.

Следующий шаг: 1) визуально проверить средний и поздний hatch exact head; если птица/скорлупа выглядят плохо — исправить именно сцену и один раз повторить Chromium; 2) после визуального PASS решить staging через уже существующую Cloudflare-инфраструктуру без GitHub Actions и без production-write; 3) затем Telegram WebView smoke. Не плодить новые формальные тесты без конкретного продуктового вопроса.
