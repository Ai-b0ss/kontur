# Kontur — продукт

## 2026-08-20 — ZERO-MINUTE: exact head разобран, bounded patch закрывает 5 дефектов

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

### Главное правило продолжения

Не запускать CircleCI, GitHub Actions и любой hosted CI с минутами/кредитами. Не использовать `qwen-free-api` как внешний runner и не делать trigger-коммиты. Для build/test/Chromium/Playwright сначала использовать контейнер ChatGPT. GitHub — источник exact source и место для уже локально проверенных продуктовых изменений.

Важная деталь: `.github/workflows/ci.yml` запускается на `pull_request`. Поэтому любой push в head PR #12 автоматически создаст GitHub Actions run. Пока действует ZERO-MINUTE, продуктовую ветку не пушить даже с правильным патчем: сначала локальная проверка, затем отдельное решение, как не запустить запрещённый hosted CI.

### Что реально проверено на exact head

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

Patch подготовлен против exact head и основан на фактических текущих строках `LocalKontur.tsx`, `QuizEgg.tsx`, `CanonicalBirdVisual.tsx`, `state.ts` и `local-kontur.test.ts`. Продуктовый push сознательно не сделан из-за pull_request-trigger GitHub Actions.

### Что получилось и что не получилось в локальной среде ChatGPT

Контейнер доступен: Node 22, Chromium и Python Playwright установлены. Но сам контейнер не имеет внешнего DNS и не может клонировать приватный GitHub. GitHub connector читает exact text blobs, но бинарные WebP через него не материализуются в файловую систему (binary fetch упирается в UTF-8 decode). Поэтому честный exact-head визуальный Playwright с настоящими `egg-stage-*`/`results/*` в этом проходе пока заблокирован не кодом приложения, а переносом полного приватного source+assets в контейнер.

Не подменять это placeholders: такой прогон не даёт пригодного визуального evidence.

### Неблокирующий долг

В `local-kontur.css` всё ещё лежит старый hatch-слой. Новый `kontur-core-corrections.css` его перекрывает и текущий `QuizEgg` старые shell-классы уже не рендерит. Большую CSS-чистку делать только после свежего exact-browser PASS, не вслепую.

### Следующий шаг

1. Материализовать в ChatGPT container полный exact source PR #12 вместе с настоящими бинарными assets без hosted CI. Предпочтительно готовым source archive/Library artifact; не восстанавливать картинки заглушками.
2. Применить `KONTUR_PR12_BOUNDED_FIX_20260820.patch` локально.
3. Локально: Mini App tests → typecheck → build.
4. Playwright на 320×568 и 430×1000: default hook, q1…q8, быстрый/медленный q8, skip, reduced-motion, console/network/layout, screenshots/video/trace; отдельно `back during response`, одинаковая птица+palette hatch→reveal→Home, `надеть окрас → Home → reload`, `replay → reveal → Home` без смены личности.
5. Глазами просмотреть ранний/средний/поздний hatch и стык hatch→reveal; чинить только воспроизводимые визуальные дефекты.
6. После browser+visual PASS — безопасный non-destructive `kontur-igor-staging` только способом, не требующим запрещённого hosted CI, затем Telegram WebView smoke. Production не трогать.
