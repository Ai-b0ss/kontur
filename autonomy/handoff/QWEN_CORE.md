# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `0f76965dd05092bc0d035ca7cb052e44e38a9d1f`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true. В этом проходе workspace не менялся.

Сделано:
- Перед работой заново сверены живые PR и исходники обоих Qwen-репозиториев. Старый head из handoff оказался устаревшим: PR #6 уже был на `ca1803f1…`.
- Закрыт следующий реальный пробел в `src/chat-adapter.js`: адаптер дальше читает один system-блок, поэтому несколько project/AGENTS system-сообщений могли теряться до отправки в Qwen. Теперь `context-compressor` до старения истории собирает все обычные текстовые system-сообщения в один упорядоченный блок. Это делается даже в коротком диалоге.
- Для нестандартного system-контента (объекты/массивы) объединение работает fail-closed: ничего не сериализуется и не отбрасывается по догадке.
- Добавлен `scripts/system-message-fold-test.js`: проверяет короткую и длинную историю, порядок system-инструкций, fail-closed для структурированного system-контента и настоящий путь через `chatAdapter.preparePublicPayload()` с двумя `Instructions from:`. Оба project-блока обязаны реально попасть в Qwen payload.
- Новый регресс включён в общий `npm test`.

Коммиты этого прохода:
- `0896e0ab7c195d94ea3ea03679ebd98742516021` — объединение всех текстовых system-сообщений перед folding;
- `220b19f903d2030f4e38c87479f319ff3eec3d28` — базовый регресс;
- `f35684aa946eb2530b9da02c10f850168f326ee9` — включение регресса в общий `npm test`;
- `0f76965dd05092bc0d035ca7cb052e44e38a9d1f` — доказательство через реальный chat-adapter path.

Проверено:
- CAPTCHA-ротация, provider-wide circuit, привязка Qwen-треда к аккаунту, checkpoint, запрет выключенных инструментов и два режима системного промпта не менялись.
- Owner-mode остаётся отдельным lossless-путём через `qwen-v3-capabilities`; это исправление касается engineer/project instruction folding и не смешивает приватный prompt с инженерной персоной.
- Новый provider traffic не запускался; старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.
- На момент выхода GitHub combined status для exact head `0f76965d…` пуст; зелёный CircleCI не выдумывать, дождаться фактического результата.
- PR #6 сейчас `mergeable=false` относительно `main`; сведение пока не делать до живого PASS, чтобы не смешивать продуктовую отладку с инфраструктурными изменениями main.

Следующее:
1. Снять реальный результат обычного CircleCI/`npm test` на `0f76965d…`. Если новый system-fold regression красный — чинить его без отката ротации и agent/tool исправлений.
2. После зелёного офлайн-набора установить судьбу старого разрешённого live bridge `4de8bdae…`; второй provider-run запускать только если доказано, что прежний до Qwen не дошёл.
3. Затем нужен ровно один bounded живой многошаговый PASS: `read_file → tool result → следующий ход Qwen → bash → tool result → final`, после чего restart и безопасный failover незавершённой цели.
4. После live PASS аккуратно свести PR #6 с `main`, сохранив безопасный канал секретов, CAPTCHA-ротацию, provider-circuit, prompt-режимы, checkpoint и строгую привязку треда к аккаунту.
