# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 — точный текущий head отправлен в Chromium runner

Продуктовая линия: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий head `28272f30468b53b6698a64615283c8f7c6d110a7`. PR остаётся draft и mergeable. Production/main/prod D1 не трогались. GitHub Actions не запускались.

CircleCI-исполнитель через `Ai-b0ss/qwen-free-api` сохранён как отдельная служебная ветка `autopilot/kontur-browser-qa-v2-20260819`. Ранее найденный обход установки остаётся runner-only: точный private Kontur source клонируется по SHA, а Mini App для Linux ставится через npm с локальными `file:` зависимостями `@kontur/core`/`@kontur/contracts`; продуктовые manifests в Git не меняются.

В этом запуске runner переведён с промежуточного `57c2f338...` на точный текущий продуктовый head `28272f304...`. Новый runner commit: `53bbf3fb9f670d40b02697e51476fb2f79ff0588`. Его workflow должен поднять Mini App локально, установить Chromium и пройти default `/ -> hook -> q1`, затем полный community-путь `hook -> q1..q8 -> hatch/reveal -> worm -> home -> reward egg -> equip` в трёх сценариях: 320x568 fast q8, 430x1000 slow q8 + skip, 320x568 reduced-motion. Сохраняются screenshots, video, trace и JSON; ловятся console/page/request errors, неожиданные API, horizontal overflow и layout shift.

На момент этой записи GitHub commit-status для `53bbf3fb...` ещё пуст, поэтому Chromium PASS/FAIL не выдумывать: сначала снять фактический CircleCI результат и артефакты. Если прогон зелёный — обязательно визуально просмотреть ключевые кадры/видео, особенно q8 crack-window, спокойное раскрытие скорлупы, непрерывность той же птицы и маленький экран. Если падает — чинить конкретный первый продуктовый/runner defect, а не возвращаться к вееру pnpm-диагностики.

Cloudflare staging ранее автоматически начал сборку exact head `28272f30...` (`25d3a050-4cdf-4dcd-8fef-38e7c87a83e9`, `kontur-igor-staging`); итог в доступном GitHub-интерфейсе этого запуска не виден. Production не затронут.

Следующий шаг: снять CircleCI для runner `53bbf3fb...`; получить и визуально проверить artifacts. Затем проверить staging/Telegram WebView и только после этого продолжать продуктовую полировку по реальному ТЗ и замечаниям владельца.
