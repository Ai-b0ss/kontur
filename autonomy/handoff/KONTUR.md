# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 — Chromium-инфраструктура локализована, hatch улучшен

Продуктовая линия: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий head `28272f30468b53b6698a64615283c8f7c6d110a7`. PR остаётся draft. Production/main/prod D1 не трогались. GitHub Actions не запускались.

CircleCI через `Ai-b0ss/qwen-free-api` реально работает как удалённый исполнитель: exact private clone Kontur проходит, Node/pnpm toolchain проходит, отдельная установка Playwright package проходит. В workflow `f88a0b7c-838f-4f31-9350-762e3746df60` обычный `pnpm add react` в чистом каталоге PASS, но любая установка самого Kontur (`frozen`, `unfrozen`, `lockfile-only`, `ignore-scripts`) падает. Значит сеть/registry/pnpm исправны; проблема привязана к конфигурации/manifest самого репозитория. Ранее также доказано, что `force`, filter, release-age override и supportedArchitectures override это не лечат. Не продолжать веер одинаковых pnpm-проб.

Для браузерного прогона подготовлен обход только на стороне runner: точный Kontur source клонируется по SHA, а затем для Linux-исполнителя Mini App ставится через npm с локальными `file:` зависимостями `@kontur/core`/`@kontur/contracts`; продуктовые файлы в Git от этого не меняются. Служебная ветка: `Ai-b0ss/qwen-free-api:autopilot/kontur-browser-qa-v2-20260819`, последний runner head `f4e22a0b5cf8a9160186da5cd153040889564a46`. На момент handoff новый CircleCI status для последних runner commits ещё не появился; не считать браузерный прогон состоявшимся.

Параллельно исправлен конкретный дефект из owner live review §4. Раньше птица была невидима до 63% hatch, а три крупные части `egg-stage-08.webp` далеко разлетались, что давало тот самый эффект «взорвали PNG полигоном». В `57c2f338...` птица начинает читаться через узкое окно трещины до полного раскрытия; shell motion сделан заметно спокойнее и ближе к раскрытию, а не взрыву. В `28272f304...` добавлен регрессионный контракт, запрещающий вернуть старую wide-flying animation. Это ещё не визуальный PASS: обязательно посмотреть реальный Chromium/WebView.

Cloudflare staging auto-build для exact head `28272f30...` реально стартовал: build `25d3a050-4cdf-4dcd-8fef-38e7c87a83e9`, `kontur-igor-staging`; на момент записи статус был `in progress`. Production не затронут.

Следующий шаг: сначала снять итог Cloudflare build и статус runner `f4e22a0b...`. Если CircleCI ожил — получить настоящий Chromium путь и artifacts: default `/ -> hook -> q1`, затем community -> hook -> q1..q8 -> hatch/reveal -> worm -> home -> reward egg -> equip, fast/slow q8, skip/reduced-motion, 320x568/430x1000. После технического результата обязательно визуально просмотреть screenshots/video; только затем корректировать UX. Если runner по-прежнему не планируется, не плодить pnpm-диагностику: использовать staging и заняться независимым product polish/точечной переносимостью install.
