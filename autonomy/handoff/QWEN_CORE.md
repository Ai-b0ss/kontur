# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `75b0548967a4fca1ee7507ba04db788774dfc38a`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true. В этом проходе workspace не менялся.

Сделано:
- Перед работой заново сверены живые PR и исходники обоих Qwen-репозиториев; старый head из handoff был устаревшим.
- Закрыт реальный пробел engineer/OpenCode-пути: `chat-adapter` дальше читает один system-блок, поэтому несколько project/AGENTS system-сообщений могли теряться до отправки в Qwen. Теперь `context-compressor` перед старением истории собирает все system-инструкции в один упорядоченный блок.
- Поддержаны не только обычные строки, но и стандартный текстовый структурированный OpenAI-контент (`[{text: ...}]`, `{text: ...}`, `{content: ...}`). Неизвестный структурный тип остаётся fail-closed: исходная история не переписывается по догадке.
- Добавлен `scripts/system-message-fold-test.js`: короткая и длинная история, порядок инструкций, структурированный system-контент, fail-closed для неизвестного типа и настоящий путь через `chatAdapter.preparePublicPayload()` с двумя `Instructions from:`. Оба project-блока обязаны реально попасть в Qwen payload.
- Новый регресс включён в общий `npm test`.

Коммиты этого прохода:
- `0896e0ab7c195d94ea3ea03679ebd98742516021` — объединение текстовых system-сообщений;
- `220b19f903d2030f4e38c87479f319ff3eec3d28` — базовый регресс;
- `f35684aa946eb2530b9da02c10f850168f326ee9` — включение регресса в `npm test`;
- `0f76965dd05092bc0d035ca7cb052e44e38a9d1f` — проверка через реальный chat-adapter path;
- `920404e602ef344e5c629cd543dcb9656e528623` — поддержка стандартного структурированного system-контента;
- `75b0548967a4fca1ee7507ba04db788774dfc38a` — расширенный регресс на structured/fail-closed случаи.

Проверено:
- CAPTCHA-ротация, provider-wide circuit, привязка Qwen-треда к аккаунту, checkpoint, запрет выключенных инструментов и два режима системного промпта не менялись.
- Owner-mode остаётся отдельным lossless-путём через `qwen-v3-capabilities`; это исправление касается engineer/project instruction folding и не смешивает приватный prompt с инженерной персоной.
- Новый provider traffic не запускался; старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- На момент выхода GitHub combined status для exact head `75b05489…` пуст; зелёный CircleCI не объявлять без фактического результата.
- PR #6 сейчас `mergeable=false` относительно `main`; сведение пока не делать до живого PASS.

Следующее:
1. Снять реальный результат обычного CircleCI/`npm test` на `75b05489…`. Если новый regression красный — чинить его без отката ротации и agent/tool исправлений.
2. После зелёного офлайн-набора установить судьбу старого разрешённого live bridge `4de8bdae…`; второй provider-run запускать только если доказано, что прежний до Qwen не дошёл.
3. Затем нужен ровно один bounded живой многошаговый PASS: `read_file → tool result → следующий ход Qwen → bash → tool result → final`, после чего restart и безопасный failover незавершённой цели.
4. После live PASS аккуратно свести PR #6 с `main`, сохранив безопасный канал секретов, CAPTCHA-ротацию, provider-circuit, prompt-режимы, checkpoint и строгую привязку треда к аккаунту.
