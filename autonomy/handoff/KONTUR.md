# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 14:22Z — внешний Chromium всё ещё не стартует; закрыт ложный evidence-пробел

PR #12 заново проверен: открыт, draft, mergeable; ветка `fix/kontur-core-visual-continuity-20260818`, exact head по-прежнему `60d1703a958757dc27222338cc41a9349382efb5`. Production/main/prod D1 не трогались. GitHub Actions не запускались.

Проверен общий CircleCI-исполнитель через `Ai-b0ss/qwen-free-api`. Его ветка уже ушла вперёд до `7c188e6995e6f6eaeddf0286db5011c6f9cdb06e`, но GitHub по-прежнему видит пустой combined status, а `artifacts/kontur-browser-qa/latest/summary.json` в evidence-ветке отсутствует. Значит реального Chromium-прогона и визуального PASS всё ещё нет; новые пустые trigger-коммиты не создавать.

Перепроверен обязательный FINAL_TZ §10/§16 артефакт `docs/product/evidence/BIRD_CHARACTER_DIRECTION.md`. Он уже существует на exact product head и содержит для всех шести результатов именно требуемые поля: IT-архетип, 2–3 черты характера, уровень мемности, что уже работает и чего избегать. Поэтому строка `BIRD_CHARACTER_DIRECTION.md = VERIFY_PENDING` в старой requirement matrix устарела как минимум в части наличия/полноты документа; новый документ создавать не надо.

По исходникам повторно проверен q8: после восьмого ответа визуальная стадия яйца меняется сразу, но `hatching` ждёт одновременно окончания реакции интерфейса и готовности результата API; при ошибке API `hatchReady` остаётся false и пользователь остаётся на q8 с возможностью повторить ответ. Reveal остаётся в том же `QuizEgg`, птица не перемонтируется отдельным вторым объектом. Нового дефекта по этой логике в этом проходе не найдено.

Следующий полезный шаг: не ждать CircleCI бесконечно. Перенести уже готовый безопасный `release-staging.yml` deploy+remote smoke в реально исполняемый бесплатный путь либо использовать Cloudflare staging как удалённую точку, затем получить браузерные PNG/video/trace любым доступным Chromium-исполнителем. До реальных кадров не объявлять визуальную готовность. После кадров — чинить конкретные дефекты и только затем Telegram WebView smoke.

## 2026-08-19 13:22Z — exact head подтверждён; перепроверен реальный вход и q8 по исходникам

PR #12 заново проверен через GitHub: открыт, draft; ветка `fix/kontur-core-visual-continuity-20260818`, exact head `60d1703a958757dc27222338cc41a9349382efb5`. Старый head `41e1243b...` в `CURRENT_RU.md` устарел. Production/main/prod D1 не трогались. GitHub Actions не запускались.

Перепроверен фактический вход приложения на exact head. Обычный `/` сейчас действительно идёт в `LocalKontur`, а не в legacy `GameApp`; legacy доступен только в dev через `?legacy=1`. Для нового пользователя `initialLocalStage()` по умолчанию возвращает `hook`; трёхэкранное вступление сообщества появляется только при явном `?community=1`. Значит браузерный QA обязан открывать обычный `/` и отдельно не должен считать служебный community-флаг нормальным пользовательским входом.

Перепроверена q8-логика на exact head: после ответа визуальная стадия яйца двигается сразу, ответ блокируется `answerLock`, а переход в `hatching` происходит только когда одновременно закончилась короткая реакция интерфейса (`eggResponding=false`) и реально готов результат (`hatchReady=true`). Для медленного API это означает, что вылупление не должно начинаться раньше ответа сервера. Для reduced-motion реакция сокращается до 0 мс, а hatch-reveal до 20 мс. Это правильная логика по исходникам, но браузерный PASS всё ещё не объявлять без реального Chromium-прогона.

CircleCI Chromium evidence по-прежнему не появился в доступной GitHub evidence-ветке; новых пустых trigger-коммитов в этом запуске не создавал. Следующий шаг: при появлении рабочего CircleCI pipeline — один exact-head Chromium run на `/` с 320×568 и 430×1000, быстрым/медленным q8, skip/reduced-motion, затем забрать и глазами проверить PNG/video/trace. Если CircleCI всё ещё не создаёт pipeline, следующий полезный ход — перенести безопасный staging deploy+remote smoke из существующего `release-staging.yml` в реально исполняемый бесплатный путь и продолжить продуктовую сверку, не трогая production.

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