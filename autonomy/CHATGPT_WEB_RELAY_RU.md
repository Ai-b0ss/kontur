# Обычный ChatGPT web relay — состояние

Обновлено: 2026-08-19.

Идея владельца: использовать не Work/Codex API, а обычный ChatGPT web-чат как ещё один сильный автономный рабочий слой. Внешний CircleCI-компьютер должен открыть уже авторизованный обычный чат владельца и написать туда короткую команду продолжения, как раньше браузерная инфраструктура работала с Qwen.

## Что уже сделано

Служебная ветка: `Ai-b0ss/qwen-free-api:autopilot/chatgpt-web-relay-20260819`.

Готово:
- `scripts/chatgpt-relay-capture.js` — один раз открывает обычный ChatGPT, владелец логинится и открывает конкретный целевой чат; сохраняется переносимый Playwright storage state (cookies/localStorage/IndexedDB) + URL этого чата;
- `scripts/chatgpt-relay-prepare.js` — шифрует session bundle GPG/AES256, удаляет plaintext и умеет найти старый Qwen `DO_NOT_COMMIT_RUNTIME_STATE_KEY.txt`, включая прежнюю папку `GITHUB_READY_WITH_STATE_20260816-191821` на Desktop/OneDrive;
- `scripts/chatgpt-relay-send.js` — в CircleCI расшифрованная сессия открывает ровно сохранённый `chatgpt.com/c/...`, находит composer, отправляет сообщение и не печатает токены/текст;
- `.circleci/config.yml` на relay-ветке — лёгкий отдельный runner. Пока `relay/outbox.json.enabled=false`, job сразу заканчивается. При включении доставляет одно сообщение;
- `Ai-b0ss/qwen-free-api#11` — простой журнал ID доставок, чтобы повторный CircleCI-run не отправил одно сообщение дважды;
- последний проверенный выключенный CircleCI-run был зелёным: wiring GitHub → CircleCI работает.

## Где хранится доступ

В GitHub не должно быть открытого `CHATGPT_TOKEN`.

Авторизованное состояние хранится только зашифрованным:
`.runtime-state/chatgpt-web-session-v1.json.gpg`

Это уже покрывается существующим Git LFS правилом `.runtime-state/*.gpg`.

CircleCI сначала пробует уже существующий Qwen secret `RUNTIME_STATE_KEY`. Если локально старый Qwen key не удастся найти, prepare-script создаёт отдельный `DO_NOT_COMMIT_CHATGPT_RUNTIME_STATE_KEY.txt`, и только тогда потребуется новый CircleCI secret `CHATGPT_RUNTIME_STATE_KEY`.

## Что ещё НЕ сделано

Не захвачена реальная авторизованная ChatGPT-сессия владельца: для этого нужен один короткий запуск на его ПК/браузере, когда будет доступ.

Поэтому relay пока НЕ активировать в пяти автоматизациях и не считать доказанным. `relay/outbox.json` должен оставаться `enabled=false` до первого реального теста.

## Первый реальный тест

На ПК в relay-ветке достаточно запустить:
`npm ci`
`node scripts/chatgpt-relay-prepare.js --publish-test`

После логина и открытия нужного обычного чата скрипт, если найдёт существующий Qwen runtime key, сам создаст encrypted bundle, закоммитит его вместе с безопасным тестом и отправит ветку. CircleCI должен написать в этот обычный ChatGPT-чат `CHATGPT_RELAY_TEST_...`.

Только после реального появления этого сообщения в нужном чате отметить relay как READY и разрешить пяти автоматизациям использовать его для коротких команд продолжения.

## Зачем это нужно

Scheduled Tasks остаются периодическими «будильниками». Relay позволяет одному короткому запуску разбудить обычный сильный ChatGPT-чат, который уже имеет большой контекст и доступные инструменты. Это потенциально уменьшает простой между часовыми запусками, не требует держать приватный системный промпт в GitHub и не зависит от OpenAI API conversations.
