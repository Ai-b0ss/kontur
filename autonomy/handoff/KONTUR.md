# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 12:25Z — перепроверен exact head и найден конкретный пробел Cloudflare staging

PR #12 заново проверен через GitHub: открыт, draft, mergeable; ветка `fix/kontur-core-visual-continuity-20260818`, exact head `60d1703a958757dc27222338cc41a9349382efb5`. Production/main/prod D1 не трогались. GitHub Actions не запускались.

CircleCI Chromium evidence всё ещё отсутствует, поэтому браузерный и визуальный PASS не объявлять. Не делать новые пустые trigger-коммиты без признака, что CircleCI снова создаёт pipeline.

Параллельно разобран текущий Cloudflare staging путь. `tools/cloudflare/workers-build-staging.sh` на exact head только: проверяет Node 22, ставит зависимости, запускает handoff-safety, Mini App tests/build и генерирует/проверяет `wrangler.staging.generated.jsonc`. Сам `wrangler deploy` этот скрипт НЕ вызывает. Значит bot `Deployment failed` нельзя автоматически трактовать как падение продукта/сборки: реальный deploy-шаг Workers Builds находится во внешней настройке Cloudflare и сейчас не зафиксирован в репозитории. Репозиторный `.github/workflows/release-staging.yml` содержит полный безопасный deploy+remote verification, но GitHub Actions использовать нельзя из-за исчерпанных minutes. Следующий полезный инфраструктурный шаг — перенести этот уже написанный deploy/remote-smoke в CircleCI либо другой уже подключённый бесплатный исполнитель, а не гадать по одному Cloudflare bot status.

По продукту подтверждён текущий hatch-код: две половины `egg-stage-08.webp` раскрываются над одной `CanonicalBirdVisual`; птица остаётся в том же `QuizEgg` и поднимается из-за скорлупы. Это лучше старого «взрыва», но без реального Chromium-кадра визуальная оценка всё ещё не доказана.

Следующий шаг: 1) при первом признаке ожившего CircleCI — один exact-head Chromium run и забрать PNG/video/trace; 2) если CircleCI browser всё ещё не стартует, использовать его же как staging executor: tests/build -> generate staging config -> `wrangler deploy` только в `kontur-igor-staging`/`kontur-staging` -> remote asset/auth smoke; 3) после доступных кадров чинить конкретные визуальные дефекты; 4) Telegram WebView smoke; 5) только затем готовить сдачу. Production/main/prod D1 без нового разрешения не трогать.

## 2026-08-19 11:25Z — CircleCI trigger подтверждён как внешний стопор; продуктовый head не менялся

Продуктовая линия перепроверена заново: PR #12 открыт/draft/mergeable, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `60d1703a958757dc27222338cc41a9349382efb5`. Production/main/prod D1 не трогались. GitHub Actions не запускались.

Проверен именно уже подключённый CircleCI-путь через `Ai-b0ss/qwen-free-api:autopilot/qwen-runtime-preflight-20260818`. В текущем `.circleci/config.yml` job `kontur-browser-qa` действительно присутствует в обычном workflow и жёстко нацелен на exact Kontur head `60d1703a...`; он собирает Mini App, ставит Chromium, проходит default hook и полный пользовательский путь, затем должен публиковать summary/PNG обратно в `autopilot/kontur-browser-qa-mainbase-20260819`.

Но внешний запуск не состоялся: у прежнего trigger `d4a7890f...` combined status пустой, у текущего head Qwen PR #6 `943460d67251c021e0d6f1cf8370dd1c4da4ace0` combined status тоже пустой, а `artifacts/kontur-browser-qa/latest/summary.json` в evidence-ветке по-прежнему 404. Это уже третий независимый признак, что проблема не в Playwright/Kontur-коде, а в том, что CircleCI сейчас вообще не создаёт pipeline/status для этой ветки. Не плодить новые пустые trigger-коммиты без нового evidence.

Визуальная правка прошлого запуска остаётся текущей: hatch больше не использует три широко разлетающиеся геометрические копии яйца; две половинки скорлупы раскрываются поверх одной птицы. Но визуальный PASS не объявлен — реальных Chromium-кадров после этой правки всё ещё нет.

Следующий шаг по Kontur: получить новый признак ожившего CircleCI (pipeline/status) либо другой уже доступный удалённый Chromium-исполнитель без GitHub Actions; затем один exact-head прогон и визуальный просмотр артефактов. Параллельно можно разбирать isolated Cloudflare staging build `b012700f-63b2-4117-bdb3-31e698cbd07f`, но production не трогать. Если удалённый браузер всё ещё недоступен, продолжать продуктовую сверку исходников с ТЗ/Зезокуком, а не объявлять готовность.
