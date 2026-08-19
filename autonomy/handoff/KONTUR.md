# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 — Chromium runner v3 + новый exact head + staging build diagnosis

Продуктовая линия: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, текущий head `53350c929104415dd99bcfabce1f514f050caf0d`. PR остаётся draft и mergeable. Production/main/prod D1 не трогались. GitHub Actions не запускались.

CircleCI-исполнитель живёт отдельно в `Ai-b0ss/qwen-free-api`, ветка `autopilot/kontur-browser-qa-v2-20260819`. Текущий runner head: `c5033e9fc28caf7469600136526d4a2f5e2a56d8`, target SHA = `53350c929104415dd99bcfabce1f514f050caf0d`. Он клонирует exact private Kontur SHA через временный HTTP auth header, не печатая токен и не меняя Qwen-продукт.

В старом браузерном сценарии была ошибка самого теста: кадры `q1/q4/q8` снимались после клика и могли показывать уже следующий вопрос; полный путь также всегда шёл через `?community=1`, поэтому не доказывал реальный default entry. Новый `scripts/kontur-browser-qa-v3.mjs` проходит настоящий `/ -> hook -> q1..q8 -> hatch/reveal -> /worm -> Home -> reward egg -> equip` и снимает обязательные кадры до ответа на нужном вопросе.

Новый прогон проверяет:
- `320x568` с быстрым q8;
- `430x1000` с искусственно медленным q8 и `skip animation`;
- `320x568` с `reduced-motion`;
- на медленном q8 — что hatch не стартует до готовности API;
- console/page/request errors, неожиданные API, горизонтальный overflow, CLS/layout shift;
- exact-review кадры `01-hook`, `02-hook-start-before`, `03-quiz-q1`, `04-quiz-q4`, `05-quiz-q8`, slow-wait, hatching, `06-bird-reveal`, `07-worm-loop`, `08-home`, reward/equip; плюс video, trace и JSON.

CircleCI-конфиг запускает полный journey даже если отдельный default-hook smoke упал, чтобы дефект не лишал нас остальных артефактов. В доступном GitHub status API CircleCI-статус не отображается, поэтому PASS/FAIL не выдумывать; сначала получить фактический CircleCI result/artifacts.

Параллельно найден актуальный staging-инфраструктурный риск. Cloudflare Workers Builds с 30 июля 2026 использует Node 24 по умолчанию, а `tools/cloudflare/workers-build-staging.sh` жёстко требует Node 22. В продуктовую ветку добавлен `.node-version = 22.23.2` (это версия, уже предустановленная в Workers Builds). Это вызвало новый exact-head staging build `e9e861b9-826d-48fb-a955-b29156aeaa27`, но он всё равно завершился FAIL. Значит несоответствие Node было реальным дефектом воспроизводимости, но не единственной причиной нынешнего staging failure. Следующий шаг по staging — получить конкретную первую ошибку build/deploy (вероятный следующий слой: deploy command/config path), не трогая production.

Отдельно при чтении owner live-review подтверждён важный визуальный риск: текущий hatch CSS всё ещё режет три полные копии `egg-stage-08.webp` через крупные `clip-path: polygon(...)`. Это очень похоже на запрещённый владельцем «взрыв геометрических кусков». Не править вслепую до Chromium-кадров; если кадры подтверждают проблему — сделать скорлупу естественными читаемыми кусками и показать птицу раньше, сохранив одну сцену.

Следующий полезный шаг: 1) снять фактический CircleCI результат runner `c5033e9f...` и визуально просмотреть screenshots/video/trace; 2) диагностировать первую конкретную ошибку Cloudflare staging build после Node pin; 3) после green browser + staging — Telegram WebView и только затем продуктовая полировка/релизный кандидат.
