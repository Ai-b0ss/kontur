# Kontur — продукт

## 2026-08-20 — ZERO-MINUTE: exact head разобран, bounded patch закрывает 5 дефектов

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

### Главное правило продолжения

Не запускать CircleCI, GitHub Actions и любой hosted CI с минутами/кредитами. Не использовать `qwen-free-api` как внешний runner и не делать trigger-коммиты. Для build/test/Chromium/Playwright сначала использовать контейнер ChatGPT. GitHub — источник exact source и место для уже локально проверенных продуктовых изменений.

Важная деталь: `.github/workflows/ci.yml` запускается на `pull_request`, а push — только в `main`. Поэтому любой push в head PR #12 автоматически создаст GitHub Actions run через событие PR. Пока действует ZERO-MINUTE, продуктовую ветку не пушить даже с правильным патчем. Обновление отдельной control-ветки само по себе этот CI не запускает.

### Что реально проверено на exact head

- Свежий PR #12 всё ещё на exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`.
- Рекурсивное дерево этого SHA получено целиком, включая точные blob SHA и размеры quiz/result assets. Например: `egg-stage-01.webp` = blob `e6967fe28ee612499963b4a699941407181b76f9`, 144698 B; `egg-stage-08.webp` = blob `3aadfb8de93766418515c8ee88a9403dd2f150a5`, 216484 B; `egg-crack-light.webp` = blob `d29382ebfc934b2b0b31c98fecd4c95c44ce1292`, 43262 B.
- `GitHub.fetch_file(..., encoding=base64)` действительно читает бинарный WebP и поддерживает диапазоны base64-строк. Значит прежняя формулировка «бинарные assets через connector не материализуются вообще» слишком сильная: exact bytes можно восстановить порциями без hosted CI. Прямой `fetch_blob` всё ещё падает на UTF-8 decode, а прямой сетевой download из контейнера не работает из-за отсутствия DNS/границы скачивания.
- В контейнере заново проверен локальный Chromium: `/usr/bin/chromium` запускается через Python Playwright на viewport 320×568. Значит после материализации source/assets браузерный прогон можно делать здесь без внешнего CI.
- В File Library найден старый сохранённый `kontur_chromium_walkthrough.html` с реальным проходом hook→q1→q4→q8→hatch→reveal→worm→Home→egg→equip. Это полезный исторический ориентир, но не evidence текущего head и не считается свежим PASS.
- `QuizEgg.tsx` сейчас содержит ровно две половины `egg-stage-08.webp` и один `egg-crack-light.webp`; старый тест, ожидающий три копии stage-08, объективно устарел.
- `kontur-core-corrections.css` больше не содержит старый `animation-delay: 260ms` для hatch и старый комментарий про `legacy hatch sibling`; вместо этого q8-gate живёт в React через `eggResponding + hatchReady`.
- q8 входит в `hatching` только после окончания реакции на ответ и готовности результата.
- `QuizEgg` уже умеет принимать `palette`, а `CanonicalBirdVisual` умеет применять её к канонической птице.
- `state.player.palette` — каноническая палитра текущего надетого окраса и приходит в `GameState`.

### Пять подтверждённых дефектов текущего head

1. `apps/miniapp/test/local-kontur.test.ts` source-level красный: ждёт 3 shell-копии, старый CSS-delay и удалённый legacy-комментарий.
2. Home hero рендерит голый `ResultBird`, поэтому после `надеть окрас` большая птица не получает `state.player.palette`.
3. Persistent `QuizEgg` при hatch/reveal не получает palette; после исправления Home это создало бы скачок цвета reveal → Home.
4. На q2..q7 во время ~260 мс реакции на ответ `answerLock.current=true`, но `← назад` остаётся доступной; старый таймер затем двигает вопрос вперёд.
5. Replay обещает `профиль и птица не изменятся`, но replay-ветка заново считает `resolveRole(finalAnswers)` / `selectBirdResult(...)` и показывает временно новую птицу как `это твоя птица`; Home затем возвращает сохранённую птицу.

### Готовый bounded patch

`autonomy/patches/KONTUR_PR12_BOUNDED_FIX_20260820.patch`

Текущая версия патча закрывает все пять пунктов:
- Home → `CanonicalBirdVisual(... palette={state.player.palette})`;
- persistent `QuizEgg` получает `reveal?.state.player.palette ?? state?.player.palette ?? null`;
- back-кнопка и handler закрыты на `busy/eggResponding/answerLock`;
- stale hatch-test приведён к 2 shell + hatch light и реальному React-gate;
- replay использует `birdPresentation(state.player.role, ..., state.player.userId)` и показывает ту же сохранённую птицу, что Home; временный `resolveRole/selectBirdResult` из replay-ветки удаляется;
- добавлены статические регрессии на palette continuity, back-during-response и replay identity continuity.

Patch повторно сверен с exact `LocalKontur.tsx` текущего SHA и не протух. Продуктовый push сознательно не сделан из-за pull_request-trigger GitHub Actions.

### Что получилось и что пока не получилось в локальной среде ChatGPT

Контейнер доступен: Node 22, Chromium и Python Playwright установлены; Chromium реально запускается. Но контейнер не имеет внешнего DNS и не может клонировать приватный GitHub.

Новый факт этого прохода: бинарные GitHub assets можно получать base64-порциями через connector с `start_line/end_line`. Это даёт путь к полному exact source без CircleCI/GitHub Actions и без заглушек. Ограничение теперь не принципиальное, а техническое: нужно порционно материализовать все нужные WebP и текстовые исходники в контейнер, проверить их blob SHA, затем собирать приложение.

Не считать старый browser walkthrough свежим PASS и не подменять текущие картинки placeholders.

### Неблокирующий долг

В `local-kontur.css` всё ещё лежит старый hatch-слой. Новый `kontur-core-corrections.css` его перекрывает и текущий `QuizEgg` старые shell-классы уже не рендерит. Большую CSS-чистку делать только после свежего exact-browser PASS, не вслепую.

### Следующий шаг

1. Доматериализовать в ChatGPT container exact source PR #12: text blobs через GitHub connector, WebP — base64-порциями с проверкой Git blob SHA. Никаких hosted CI и заглушек.
2. Применить `KONTUR_PR12_BOUNDED_FIX_20260820.patch` локально.
3. Локально: Mini App tests → typecheck → build.
4. Playwright на 320×568 и 430×1000: default hook, q1…q8, быстрый/медленный q8, skip, reduced-motion, console/network/layout, screenshots/video/trace; отдельно `back during response`, одинаковая птица+palette hatch→reveal→Home, `надеть окрас → Home → reload`, `replay → reveal → Home` без смены личности.
5. Глазами просмотреть ранний/средний/поздний hatch и стык hatch→reveal; чинить только воспроизводимые визуальные дефекты.
6. После browser+visual PASS — безопасный non-destructive `kontur-igor-staging` только способом, не требующим запрещённого hosted CI, затем Telegram WebView smoke. Production не трогать.
