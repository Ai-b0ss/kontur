# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `68c5896b5b85ab0aa7df5c87a1d0448f8bacb1e2`.

Сделано за этот запуск:
- Заново проверены текущие PR/исходники обоих Qwen-репозиториев. `qwen-workspace` PR #5 не менялся: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.
- Подготовлен бесплатный one-shot мост через CircleCI: Circle поднимает одноразовый self-hosted GitHub runner, а тот запускает существующий provider-safe `qwen-long-soak.yml` на точном commit. Токен GitHub передаётся curl через приватный header-файл, а не открытым аргументом. Автозапуск после попытки снова выключен (`run_qwen_live_bridge=false`), чтобы следующие commit не размножали provider traffic.
- Во время проверки soak-harness найден конкретный дефект: `WAF_CAPTCHA_CHALLENGE` в `remote-live-agent-canary.js` ошибочно классифицировался как provider-wide `waf`, хотя основной `qwen-client` правильно считает его локальной CAPTCHA аккаунта. Исправлено на `captcha_challenge`; добавлен регресс, запрещающий снова повышать обычную CAPTCHA до глобальной WAF-проблемы. Это сохраняет 10-минутный cooldown конкретного аккаунта и разрешённый bounded failover на соседний аккаунт.
- Обновлена проверка секретных каналов CircleCI под фактически используемую схему: она теперь проверяет отсутствие GitHub-токена в argv, приватный header-файл и ранний `unset AUTOPILOT_GITHUB_TOKEN`, вместо устаревшего требования к уже отсутствующему callback-коду.

Проверки:
- Последний ранее доказанный полный офлайн PASS остаётся `8c77bc97…`, CircleCI workflow `874faef7-99c6-4165-97b0-1bd74e87d43d`, job `f89d5ee7-5cea-4e4c-b468-05aa7e096241`.
- После новых изменений полный CircleCI regression на head `68c5896b…` уже запущен: workflow `ee64a31a-c0d8-4cfe-b666-706f13a83247`, job `57b8d621-6d06-415d-8a48-f646000a2eb1`; на момент передачи статус `pending`.
- Live-soak пока НЕ считать доказанным: быстрые последовательные commit могли не дать CircleCI закрепить one-shot pipeline на промежуточном trigger-commit. Не запускать второй provider soak, пока сначала не проверен фактический CircleCI/GitHub run этого моста.

Важное новое архитектурное наблюдение:
- `qwen-client` умеет переключиться на соседний аккаунт внутри `sendChatRequest`, но агент хранит только `chat.qwenChatId`, без привязки upstream-thread к аккаунту. При failover новый аккаунт может получить новый `chatId`, тогда как `requestRound` сейчас продолжает хранить старый `prepared.chatId`; кроме того, incremental `currentOnly` payload не содержит полной истории для нового треда. Это потенциально ломает незавершённый многошаговый tool-loop именно в момент межаккаунтного failover. Пока не чинить вслепую поверх текущего live-run, но это следующий продуктовый приоритет после получения его результата: сделать явный безопасный thread rebase с полной историей при смене аккаунта и покрыть офлайн-тестом.

Следующее:
1. Сначала забрать результат CircleCI regression `ee64a31a…`; если красный — исправить воспроизводимый офлайн-дефект до любого нового provider traffic.
2. Проверить, был ли реально создан один live `qwen-long-soak` через one-shot bridge. Если он существует — ждать/разобрать его и НЕ дублировать.
3. После этого исправить межаккаунтный thread rebase: при смене аккаунта переносить полную историю в новый upstream-thread, сохранять фактический новый `chatId` и доказать `read_file → result → новый round → bash → result → final` через failover.
4. Только после живого PASS сводить PR #6 с актуальным `main`, не теряя CAPTCHA-ротацию и два режима system prompt.
