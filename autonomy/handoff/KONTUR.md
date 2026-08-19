# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта. Если один способ проверки недоступен, искать другой и продолжать работу.

## 2026-08-19 — браузерный исполнитель перенесён на заведомо подключённую CircleCI-базу

Продуктовая линия перепроверена заново: PR #12 по-прежнему открыт/draft, `fix/kontur-core-visual-continuity-20260818`, head `41e1243b91a4b0a65989c605046d7b6d4854ac5a`. GitHub Actions не использовать.

Предыдущая служебная ветка `Ai-b0ss/qwen-free-api:autopilot/kontur-browser-qa-20260819` не получила ни CircleCI status, ни callback в PR #12; значит считать тот прогон запущенным/успешным нельзя.

Чтобы убрать сомнение, создан новый изолированный исполнитель `Ai-b0ss/qwen-free-api:autopilot/kontur-browser-qa-v2-20260819` от заведомо работающего CircleCI head Qwen `9ffd5c366ee159a4c08bb6ed43a6ab26f5e8d5bc`. Qwen-продукт не менялся: в новой служебной ветке добавлены только два Kontur Playwright-скрипта и отдельный CircleCI config. Текущий head исполнителя `028bc987e296846ec04083ede5ab79510fa3cec1`.

Исполнитель клонирует точный Kontur head `41e1243b...`, делает frozen install + Mini App build, поднимает локальный Vite, запускает реальный Chromium с Telegram WebApp-заглушкой и сохраняет артефакты. Есть отдельный default-entry smoke `/ -> hook -> q1` и полный путь community -> hook -> q1..q8 -> hatching/reveal -> worm -> home -> reward egg -> equip. Сценарии: 320x568 fast q8, 430x1000 slow q8 + skip, 320x568 reduced-motion. Ловятся console/page/network ошибки, неожиданные API, горизонтальный overflow и CLS; сохраняются screenshots/video/trace/report.

На момент этой записи новый head ещё не получил CircleCI status. Это внешний факт, не продуктовый FAIL и не PASS. Не создавать веер повторных веток/запусков вслепую. Сначала проверить status `028bc987...`; если CircleCI снова не подхватил ветку, использовать уже активную CircleCI pipeline-конфигурацию через безопасный одноразовый параметр/служебный commit, не GitHub Actions.

Дополнительно перечитан текущий `LocalKontur.tsx`: q8 действительно имеет явные `visualQuestionIndex`, `eggResponding`, `hatchReady`; быстрый API не может показать hatching до завершения ответной фазы, медленный API удерживает q8 до результата, reduced-motion проходит тем же условием. Это подтверждение исходника, но не замена браузерному доказательству.

Следующий шаг: получить первый настоящий CircleCI Chromium result и скачать/просмотреть его screenshots/video/trace. По первому реальному сбою — минимальное исправление продукта или harness и один повтор. После зелёного локального браузера — exact-head non-destructive Cloudflare staging, затем Telegram WebView smoke. Production/main/prod D1 не трогать без отдельного разрешения.
