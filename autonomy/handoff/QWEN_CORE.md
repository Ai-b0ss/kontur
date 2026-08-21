# Qwen — агентное ядро

Обновлено: 2026-08-21 10:06Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий наблюдавшийся head `9c7ea9b876eb139cb8d7c141f62326893f52544a`. Содержательно Core-дерево соответствует результату `43416f6fb1c25409251cb1ae8480068e2d1c44ce`: три последующих коммита были исследовательской попыткой передать preamble вместе с tool-call и её полным откатом; `src/stream-session-guard.js` после отката снова имеет тот же blob `e26d5107…`, что на `43416f6…`.

В этом проходе закрыт streaming-аналог уже исправленного non-stream дефекта восстановления обычного ответа:

- раньше чистый успешный streaming-ответ Qwen уходил клиенту, но `streamAcceptedHistory` оставался состоянием до ответа; после падения процесса короткое `continue` могло потерять последний принятый текст модели;
- `src/stream-session-guard.js` теперь собирает `delta.content` и сообщает о принятом assistant-тексте только после безошибочного завершения upstream;
- частичный текст при upstream/parser error не считается принятым и не попадает в checkpoint;
- отключение клиента не мешает дочитать успешный upstream и зафиксировать принятый текст, а локальный сбой записи checkpoint не классифицируется как ошибка здорового Qwen-аккаунта;
- `server.js` сохраняет чистый streaming assistant-текст через существующий ограниченный `checkpointAcceptedToolProgress()` с фактическими `chatId/accountId` текущего маршрута; финальная запись использует уже обновлённый `streamAcceptedHistory` и не откатывает его;
- добавлен постоянный `scripts/stream-assistant-text-restart-test.js`: успешный поток из нескольких чанков → сохранение → перезапуск → короткое `continue`; отдельно проверяются downstream disconnect и запрет сохранять частичный ответ после upstream error;
- `scripts/server-stream-session-guard-wiring-test.js` теперь требует это подключение и порядок записи; новый restart-тест включён в обычный `npm test`.

Коммиты результата:
- `97f90284e4aa5cc3c0aca163f85d78388ce40093` — принимать streaming assistant text только после успешного upstream completion;
- `d2730375b78e191419c9d25eccd495ea4030e1d6` — durable wiring в `server.js`;
- `f4b3870f29212dfd7d9851f2ac11c6f2a2a0dc45` — restart regression;
- `906be51721bccdd15e12ed24bfb2d07e2ad094e9` — постоянная проверка wiring;
- `43416f6fb1c25409251cb1ae8480068e2d1c44ce` — включение regression в `npm test`.

Сравнение с head в начале продуктовой работы (`17a71b9636eeead5873a0bd716e27a6bf073c913`) показывает только ожидаемые Core-файлы: `server.js` +20/-0, `src/stream-session-guard.js` +15/-2, новый тест, wiring-test и одна строка `package.json`. До этого `0b95364… → 17a71b…` был единственный соседний reliability-коммит только в `src/qwen-client.js`, поэтому Core-изменения не затёрли чужую работу.

На ChatGPT hosted-машине без внешнего CI и без Qwen целевая логика прошла:
`QWEN_STREAM_ASSISTANT_TEXT_TARGETED_PASS success_only=1 downstream_disconnect=1 upstream_error_rejected=1 local_persist_fail_closed=1 provider_health_untouched=1`.

Полный exact-tree `npm test` пока не объявлять зелёным: весь приватный репозиторий не материализован на hosted-машине. GitHub Actions, CircleCI, живой Qwen, реальные аккаунты, Cloudflare и production не использовались.

После первого результата проверен следующий участок и найден отдельный воспроизводимый по коду пробел: если streaming-ответ содержит текстовый preamble, а затем `tool_calls`, guard текст собирает, но `checkpointStreamingToolCalls()` сейчас создаёт assistant-сообщение с `content: null`; `acceptAssistantTextAfterSuccess()` при наличии tool-call намеренно не вызывается. Значит текст, который клиент видел непосредственно перед принятым tool-call, после restart может исчезнуть из durable history. Простого второго callback недостаточно: оба серверных callback сейчас строят историю от одного `restoredMessages` и могут перезаписать друг друга. Нужна одна атомарная запись assistant `{content, tool_calls}`. Попытка однострочного изменения guard была полностью откатана, чтобы не оставлять полурешение.

## Постоянная память

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, реализация `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте этого прохода прочитан `LATEST` с Git blob SHA `ef4e7d5d57e8be1fe3b0c172250f051ea3d77d36`, capsule `20260821T085022Z-02f231a98c`, archive SHA-256 `82e29b812210b4f817fd72b9791540f9f6096901b7aa16fa3afdd416bb02413d`. Канонический runtime материализован exact; локальный Git blob SHA совпал с нормативным `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Стартовая capsule прошла exact v4 `verify + restore`.

После основной работы exact v4 runtime собрал capsule `20260821T095925Z-0f76028b9a`, archive SHA-256 `28cb6bc1610b3d215ede512e85062280175bf59391df4dc4ad942a5eea8b8ce5`, source ref `43416f6fb1c25409251cb1ae8480068e2d1c44ce`. Обе части и manifest загружены неизменяемо и перечитаны из GitHub. Перечитанные части имеют точные длины 2048/752 и SHA-256 текста `0ae26956…` / `4973b91f…`; их объединённый base64 декодируется в архив 2099 байт с точным SHA-256 `28cb6bc1…`, совпадающим с manifest.

Непосредственно перед публикацией `LATEST` был перечитан и сохранил исходный parent blob SHA `ef4e7d5d…`, поэтому CAS разрешён. Старый LATEST сохранён как `PREVIOUS`, новый LATEST опубликован через `update_file` именно с исходным parent SHA. Текущий `LATEST` указывает на `20260821T095925Z-0f76028b9a`, его новый Git blob SHA `09ab75c010d46ed857865cae9bd12be642227808`.

Новая находка про смешанный `content + tool_calls` появилась уже после этой CAS-публикации. Повторно переписывать LATEST от старого стартового parent SHA нельзя; факт сохранён в этом handoff, а следующая нормативная capsule должна включить его после нового restore/CAS-цикла.

## Следующее

1. Материализовать достаточный exact-tree на hosted-машине и реально выполнить `stream-assistant-text-restart-test.js` вместе с ближайшим session/stream кластером; внешние CI не нужны.
2. Исправить смешанный streaming-ответ атомарно: guard должен передать полный принятый assistant `{content, tool_calls}` в одну durable callback, а `server.js` должен одним `checkpointAcceptedToolProgress()` сохранить эту пару до выпуска tool-call клиенту. Добавить restart-regression `preamble → tool_call → crash → continue/tool-result` и запрет двойного assistant-сообщения.
3. Затем проверить multi-tool disconnect/restart: несколько уже подтверждённых `tool_call.id` должны пережить исчезновение клиента и перезапуск, а каждый pending снимается только своим `tool result`; не дублировать уже имеющиеся тесты, сначала прочитать текущий coverage.
4. После следующей существенной работы повторить только нормативный v4 `restore → pack → immutable upload → reread/verify → CAS LATEST`; force-write запрещён.
