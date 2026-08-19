# Kontur — продукт

Этот файл принадлежит автоматизации Kontur. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Главный ориентир — реальное ТЗ + переписка с Зезокуком + замечания владельца + качество готового продукта.

## 2026-08-19 — Chromium runner теперь сам публикует доказательства в GitHub

Продуктовая линия без изменений: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `53350c929104415dd99bcfabce1f514f050caf0d`. PR open/draft/mergeable. Production/main/prod D1 не трогались. GitHub Actions не запускались.

CircleCI-исполнитель: `Ai-b0ss/qwen-free-api`, ветка `autopilot/kontur-browser-qa-v2-20260819`. Новый runner head `0b6db1d67170d8477bf010b184ddd1534e633a10`, target SHA жёстко зафиксирован на `53350c929104415dd99bcfabce1f514f050caf0d`.

Главная проблема прошлых прогонов была не только в самом тесте, но и в наблюдаемости: CircleCI artifacts недоступны текущему агенту через имеющиеся инструменты, поэтому даже запущенный Chromium нельзя было честно визуально разобрать. Runner теперь после любого полного прогона (`when: always`) сам кладёт обратно в служебную ветку `artifacts/kontur-browser-qa/latest/`: `summary.json`, отчёт каждого сценария и ключевые PNG (`hook`, `q1`, `q8`, ожидание медленного API, hatch, reveal, equipped либо `FAIL`). Коммит результатов помечается `[ci skip]`, чтобы не образовать цикл. Секрет GitHub не печатается и не кладётся в URL.

Сам браузерный путь остаётся человеческим: обычный `/ -> hook -> q1..q8 -> hatch/reveal -> /worm -> Home -> reward egg -> equip`; размеры `320x568` и `430x1000`; быстрый q8, медленный q8+skip и reduced-motion; ловятся console/page/request errors, неожиданные API, горизонтальный overflow и CLS. В старом сценарии была исправлена ошибка: `q1/q4/q8` теперь снимаются ДО клика, а default path больше не подменяется `?community=1`.

На момент завершения этого запуска GitHub ещё не получил `artifacts/kontur-browser-qa/latest/summary.json`; поэтому Chromium PASS/FAIL и визуальную часть не объявлять. Commit status GitHub для этой CircleCI-линии пустой и сам по себе ничего не доказывает. Следующий запуск первым делом проверяет появление `artifacts/kontur-browser-qa/latest/*`; если файлы появились — читает JSON и визуально просматривает PNG. Если не появились — считать, что автозапуск CircleCI по этой ветке не сработал/не дошёл до публикации, и чинить именно запуск/наблюдаемость, не плодя новые тестовые архитектуры.

Cloudflare staging: `.node-version = 22.23.2` уже в exact product head, но последний известный staging build после pin всё равно был FAIL. `tools/cloudflare/workers-build-staging.sh` сейчас выполняет install/tests/build/config-prep, а реальный рабочий deploy-контракт известен из staging workflow как `wrangler deploy --config wrangler.staging.generated.jsonc --keep-vars`. Без конкретного Cloudflare build log не менять deploy вслепую и не трогать production.

Из исходников по-прежнему виден визуальный риск hatch: три полные копии `egg-stage-08.webp` режутся крупными `clip-path: polygon(...)`. Это похоже на замечание владельца про «взрыв геометрических кусков», но финальную переделку лучше делать по реальным Chromium-кадрам, которые теперь должны стать доступны через GitHub.

Следующий шаг: 1) забрать self-published CircleCI evidence; 2) по JSON исправить фактический дефект, по PNG — явные визуальные проблемы, в первую очередь hatch; 3) повторить один exact-head Chromium прогон; 4) затем получить конкретную первую ошибку Cloudflare staging и довести isolated staging; 5) после этого Telegram WebView и продуктовая полировка по ТЗ.
