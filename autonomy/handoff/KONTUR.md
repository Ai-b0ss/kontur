# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 — первый настоящий CircleCI Chromium запуск получен

Продуктовая линия перепроверена: PR #12 остаётся draft, `fix/kontur-core-visual-continuity-20260818`, head `41e1243b91a4b0a65989c605046d7b6d4854ac5a`. GitHub Actions не использовать.

Старый служебный исполнитель CircleCI действительно не запускался. Создан новый изолированный исполнитель в уже подключённом проекте `Ai-b0ss/qwen-free-api`, ветка `autopilot/kontur-browser-qa-v2-20260819`, основанная на заведомо работающем Qwen head. Qwen-продукт не менялся.

Первый реальный CircleCI workflow появился: `2df0cfee-223e-4f35-9356-f9b4935dea1f`, job `a66aa738-7b96-4e83-ba08-6c4acb7bd546`, status=failure на служебном head `028bc987e296846ec04083ede5ab79510fa3cec1`. Это важнее прежнего отсутствия статуса: исполнитель реально подключён. По конфигурации первого запуска наиболее ранний очевидный инфраструктурный дефект — попытка клонировать приватный `Ai-b0ss/kontur` обычным анонимным HTTPS.

Исправлен именно этот слой, без изменения Kontur/Qwen продукта: приватный fetch теперь использует уже существующий `AUTOPILOT_GITHUB_TOKEN` только как временный HTTP header, `set +x`, после fetch переменная и header-значение удаляются. Новый служебный head `9fe7c0a0136de92e8d29d0b5a68ac9932ee8f87c`; он должен дать второй bounded CircleCI run. Не печатать токен и не переносить его в URL.

В runner есть: exact-head clone `41e1243b...`, frozen install + Mini App build, локальный Vite, настоящий Chromium с Telegram WebApp-заглушкой; default `/ -> hook -> q1`; полный community -> hook -> q1..q8 -> hatching/reveal -> worm -> home -> reward egg -> equip; 320x568 fast q8, 430x1000 slow q8 + skip, 320x568 reduced-motion; console/page/network/API/overflow/CLS проверки; screenshots/video/trace/report как CircleCI artifacts.

Исходник `LocalKontur.tsx` отдельно перечитан: q8 сейчас действительно использует `visualQuestionIndex`, `eggResponding`, `hatchReady`; быстрый результат не должен визуально перескочить в hatching до окончания ответной фазы, медленный удерживает q8 до результата, reduced-motion проходит тем же условием. Это ещё не визуальный PASS.

Следующий шаг: снять status нового head `9fe7c0a...`. Если упал — определить первый реальный шаг CircleCI и исправить только его; если green — скачать и визуально просмотреть screenshots/video/trace, а не ограничиваться PASS. Затем исправить найденные UX/визуальные дефекты и повторить один прогон. После локального Chromium green — exact-head non-destructive Cloudflare staging и Telegram WebView smoke. Production/main/prod D1 не трогать без отдельного разрешения.
