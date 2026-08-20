# Kontur — продукт

## 2026-08-20 — exact head перепроверен, найден ещё один пользовательский дефект

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Текущий Chromium runner в `Ai-b0ss/qwen-free-api` PR #15 всё ещё привязан ровно к этому Kontur SHA. Последний известный статус commit `4292fd48a7498fd4038c5b7dfb14a42bcaeaccd7`: CircleCI context `kontur-browser-and-hatch-visual` остаётся `pending`, workflow `3bed8080-c63a-4d68-95d6-b0e51aa7575b`, job `8427de7b-8171-4ee0-8598-76d85bf64eb7`. Дубликат вслепую не запускать, пока этот статус не изменился или не доказано, что pipeline умер.

Что заново проверено на exact head:
- default `/` ведёт сразу в hook; q8 использует отдельный `visualQuestionIndex` и входит в `hatching` только после окончания реакции на ответ и готовности результата;
- hatch/reveal остаются одной сценой `QuizEgg`; две половины stage-08 shell находятся перед bird-layer, птица сохраняет финальную позу при переходе hatch→reveal;
- reduced-motion для hatch и reward egg сокращает обязательные задержки;
- безопасный Cloudflare staging-путь остаётся отдельным: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`; production config для staging не использовать.

На exact head подтверждены пять конкретных проблем:
1. `apps/miniapp/test/local-kontur.test.ts` гарантированно устарел относительно текущего hatch сразу в трёх местах: требует 3 копии `egg-stage-08.webp` вместо 2 половин + `egg-crack-light.webp`, ищет старый CSS `animation-delay: 260ms`, которого больше нет, и старый комментарий про legacy hatch sibling, которого тоже больше нет. Старый тест source-level красный даже без запуска.
2. Home hero рендерит голый `ResultBird`, поэтому после `надеть окрас` состояние меняется, а большая птица на Home визуально не получает `state.player.palette`.
3. Сам `QuizEgg` уже умеет `palette`, но текущий persistent hatch/reveal вызов её не передаёт. После исправления Home это дало бы заметный скачок цвета между reveal и Home.
4. На q2..q7 во время ~260 мс реакции на ответ `answerLock.current=true`, но `← назад` остаётся доступной. Можно прыгнуть назад, после чего старый таймер ответа всё равно переводит вопрос вперёд.
5. Повтор теста противоречит собственному тексту интерфейса. Кнопка прямо обещает `профиль и птица не изменятся`, но replay-ветка `hatch()` заново делает `resolveRole(finalAnswers)` и `selectBirdResult(...)`, затем reveal показывает этот новый локальный результат как `это твоя птица`. Если при повторе ответы дают другую роль/птицу, пользователь увидит новую птицу на reveal, а после перехода Home вернётся старая серверная птица. Это не серверная порча профиля, но явный UX-скачок и противоречие обещанию. Исправлять нужно fail-closed: replay не должен выдавать новый результат за новую «твою птицу»; либо показывать сохранённую птицу, либо явно маркировать повтор как пробный результат, не меняющий профиль. По текущему тексту безопаснее сохранять каноническую птицу профиля.

Готовое ранее исправление сохранено в управляющей ветке:
`autonomy/patches/KONTUR_PR12_BOUNDED_FIX_20260820.patch`
commit `af4219381d560c1e69f15d9840262a366179283a`.

Этот patch по-прежнему делает четыре уже доказанные bounded-правки:
- Home -> `CanonicalBirdVisual(... palette={state.player.palette})`;
- persistent `QuizEgg` получает `reveal?.state.player.palette ?? state?.player.palette ?? null`;
- back-кнопка и handler закрыты на `busy/eggResponding/answerLock`;
- stale hatch-test приведён к 2 shell + hatch light и проверяет реальный React-gate `!eggResponding && hatchReady`, а не удалённый CSS-delay/legacy-комментарий;
- добавлены статические регрессии на palette continuity и back-during-response.

Новая replay-проблема в этом patch ещё не закрыта. Её надо добавить отдельным маленьким изменением и тестом перед окончательным браузерным прогоном.

Дополнительный неблокирующий долг: в `local-kontur.css` всё ещё лежит старый hatch-слой (включая правило, скрывающее quiz egg, старые три shell-фрагмента и старые keyframes). Новый `kontur-core-corrections.css` его перекрывает и текущий `QuizEgg` старые shell-классы уже не рендерит, поэтому это сейчас не отдельный пользовательский баг. Удалять большой legacy-блок вслепую до свежего local/browser PASS не нужно.

Что делать следующим:
1. Не дублировать уже pending CircleCI browser workflow без нового evidence. Если он ожил — снять результат и артефакты. Если доказанно умер — запускать один новый exact-head прогон через тот же служебный Qwen runner.
2. Перед следующим полноценным прогоном применить bounded patch и добавить маленькое исправление replay-режима: повтор теста не должен показывать новую птицу как сохранённую личность, если профиль остаётся неизменным.
3. Mini App tests/typecheck/build локально или в разрешённом удалённом исполнителе.
4. Playwright: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Отдельно проверить `back during response`, `надеть окрас → Home → reload`, одинаковую палитру от hatch/reveal до Home и `replay → reveal → Home` без смены птицы/скачка идентичности.
5. По свежим кадрам продолжить продуктовую правку: ранний/средний/поздний hatch, стык hatch→reveal, интеграция quiz-яйца, синхронность progress/ring/crack и общий вид шести птиц. Зелёный тест сам по себе не считать готовностью.
6. После browser+visual PASS — non-destructive `kontur-igor-staging` через generated staging config, затем Telegram WebView smoke. Production не трогать.
