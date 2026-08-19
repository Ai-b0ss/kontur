# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 09:25Z — exact-head Chromium QA принудительно перезапущен

Продуктовая линия: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `53350c929104415dd99bcfabce1f514f050caf0d`. PR open/draft/mergeable. Production/main/prod D1 не трогались. GitHub Actions не запускались.

Проверил служебную ветку `Ai-b0ss/qwen-free-api:autopilot/kontur-browser-qa-v2-20260819`: self-published evidence всё ещё отсутствовал (`artifacts/kontur-browser-qa/latest` = 404), поэтому предыдущий запуск нельзя считать состоявшимся. Чтобы не ждать молча, сделал явный новый trigger-коммит `2bab4d1df81ff748b0f068f69755cdd2b3d47c31`. Он не меняет Qwen-продукт и по-прежнему жёстко клонирует exact Kontur SHA `53350c9…`.

Runner поднимает Mini App локально, эмулирует Telegram WebApp и проходит обычный пользовательский путь `/ -> hook -> q1..q8 -> hatch/reveal -> /worm -> Home -> reward egg -> equip`. Сценарии: 320×568 быстрый q8; 430×1000 медленный q8 + skip; 320×568 reduced-motion. Проверяются console/page/request errors, неожиданные API, горизонтальный overflow, CLS и преждевременное вылупление при медленном q8. Кадры вопросов снимаются до клика. Default path не подменяется `?community=1`.

После прогона runner обязан сам положить в `artifacts/kontur-browser-qa/latest/` `summary.json`, три `report.json` и ключевые PNG, включая hook/q1/q8/waiting/hatching/reveal/equipped либо FAIL. Коммит доказательств идёт с `[ci skip]`, чтобы не образовать цикл.

Пока новых evidence-файлов ещё нет, Chromium PASS/FAIL и визуальную часть не объявлять. Следующий запуск первым делом читает `artifacts/kontur-browser-qa/latest/*`. Если появились — разобрать JSON и визуально просмотреть PNG; фактические дефекты чинить в PR #12 и повторить один exact-head прогон. Если снова 404 — проблема уже в запуске CircleCI/публикации, а не в продукте; чинить именно этот путь.

Cloudflare staging: `.node-version = 22.23.2` уже в product head, но последний известный staging build после pin был FAIL. Не трогать production вслепую. После браузерного прогона получить конкретную первую staging-ошибку и довести isolated staging.

Из исходников остаётся визуальный риск hatch: три полные копии `egg-stage-08.webp` режутся крупными `clip-path: polygon(...)`. Это похоже на замечание владельца про «взрыв геометрических кусков». Решение принимать по реальным Chromium-кадрам; если кадры подтверждают проблему — заменить на читаемые куски скорлупы/более цельную сцену, сохранив непрерывность одной птицы.

Следующий шаг: 1) забрать evidence после trigger `2bab4d1…`; 2) исправить фактический дефект/визуал; 3) повторить exact-head Chromium; 4) isolated Cloudflare staging; 5) Telegram WebView и финальная продуктовая полировка по ТЗ.
