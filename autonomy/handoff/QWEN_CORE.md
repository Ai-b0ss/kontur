# Qwen — агентное ядро

Обновлено: 2026-08-21 11:06Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head `fe22f6f3b76c92cb28dd5145356e193010a1ccfb`.

Закрыт отдельный restart-дефект смешанного streaming-ответа `текстовый preamble → tool_calls`.

Раньше guard уже удерживал текст и tool-call до успешного завершения upstream, но `server.js` сохранял streaming tool-call как assistant с `content: null`, а отдельный callback чистого текста при наличии tool-call не вызывался. Клиент видел поясняющий текст перед инструментом, но после restart durable history могла помнить только pending tool-call.

Теперь смешанный assistant-turn сохраняется атомарно без изменения внешнего OpenCode/provider формата:

- добавлен `src/assistant-turn-meta.js` с внутренним `Symbol.for('qwen.streamingAssistantContent')`;
- `src/stream-session-guard.js` перед durable callback прикрепляет собранный preamble к полным tool-call объектам как non-enumerable Symbol metadata; до успешного callback ни текст, ни tool-call клиенту не выпускаются;
- существующий `server.js` callback остаётся прежним и передаёт те же объекты в `sessionStore.checkpointAcceptedToolProgress()`;
- `src/session-store.js` извлекает hidden preamble только для смешанного assistant-turn и формирует один durable `{role:'assistant', content:preamble, tool_calls:[...]}`; при копировании tool-calls Symbol metadata удаляется и в JSON/checkpoint не попадает;
- pure-text streaming путь и строгий fail-closed для слишком большого/невалидного tool-call не ослаблены.

Добавлен постоянный `scripts/stream-preamble-tool-restart-test.js`, включённый в `npm test`. Он проверяет: durable save до первой выдачи клиенту; ровно один assistant-turn с `content + tool_calls`; restart; pending tool-call; короткое `continue`; отсутствие утечки внутренней metadata.

На ChatGPT hosted-машине без сети к Qwen выполнена целевая проверка механизма:
`QWEN_STREAM_PREAMBLE_META_TARGET_PASS atomic_content=1 metadata_hidden=1`.

Дополнительно найден старый противоречивый regression в `scripts/stream-session-guard-test.js`: тест всё ещё ожидал, что локальный сбой checkpoint пойдёт в provider `onError` и guard сам завершит ответ. Это противоречит уже принятому контракту `stream-session-local-persist-failure-test.js`: локальная durability-ошибка не должна портить здоровье Qwen-аккаунта, а должна reject-нуться в route catch, не выпуская withheld tool output. Тест приведён к действующему контракту; продуктовую семантику ради старого теста не откатывали.

Коммиты этого результата:
- `7f315877e7e485ed9693d06a14b90175f68520eb` — внутренний assistant-turn metadata key;
- `9595397211764c3b8a675d4a8c7307bdf7c34a92` — перенос streaming preamble через guard до durable boundary;
- `f3016fe36ea47cdec9f5d1c10e8c27c6d7ebdd1b` — атомарное сохранение mixed assistant turn в session-store;
- `ac24ba3094e1ffd6fa165e2783815acab92141fc` — restart regression;
- `200d8386f425412d0b1b334aa03c172d2bd74e39` — включение regression в `npm test`;
- `fe22f6f3b76c92cb28dd5145356e193010a1ccfb` — синхронизация старого guard-regression с текущей семантикой локальных durability failures.

Полный exact-tree `npm test` пока не объявлять зелёным: весь приватный репозиторий не материализован на hosted-машине. GitHub Actions, CircleCI, живой Qwen, реальные аккаунты, Cloudflare и production не использовались.

## Проверенное покрытие

`session-pending-tool-call-restart-test.js` уже покрывает multi-tool pending state: два accepted tool-call переживают restart, частичный набор tool-result снимает только свой id, unresolved sibling остаётся pending и короткое продолжение остаётся fail-closed. Не добавлять дубликат этого теста без нового поведения.

`stream-session-restart-integration-test.js` уже генерирует preamble перед tool-call, но исторически проверял только tool-call/pending. Новый отдельный regression закрывает именно сохранность preamble + tool-call как одного assistant turn.

## Постоянная память

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, реализация `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте запуска прочитан `LATEST` с Git blob SHA `09ab75c010d46ed857865cae9bd12be642227808`, capsule `20260821T095925Z-0f76028b9a`, archive SHA-256 `28cb6bc1610b3d215ede512e85062280175bf59391df4dc4ad942a5eea8b8ce5`. Exact runtime имел нормативный Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; стартовая capsule прошла exact v4 `verify + restore`.

После работы exact v4 собрал capsule `20260821T110504Z-07ee4e43f2`, archive SHA-256 `18252b0e31ed6524cef949f96ec2c6e374d61b8f53d77cfd7390510c37eac317`, source ref `fe22f6f3b76c92cb28dd5145356e193010a1ccfb`. Обе части и manifest загружены immutable и перечитаны. Git blob SHA загруженных частей совпали с локальными (`39529ec9…`, `156cf833…`), manifest совпал (`1494a8bf…`); exact v4 локально снова дал `verify PASS`.

Непосредственно перед публикацией `LATEST` был перечитан и сохранил исходный parent blob SHA `09ab75c0…`. Старый LATEST сохранён как PREVIOUS; новый LATEST опубликован через `update_file` ровно с этим parent SHA. Текущий LATEST указывает на `20260821T110504Z-07ee4e43f2`, blob SHA `8365a3d68023fd0e5638de913cdfb0ad2d951d3e`.

Есть один невалидный immutable orphan `20260821T110307Z-ab60767898`: при ручной передаче `part-0001.b64` был случайно добавлен лишний `=`. Git blob SHA не совпал с локальным до публикации указателя, поэтому capsule не ремонтировалась поверх байтов и никогда не становилась LATEST. Использовать её нельзя.

## Следующее

1. Материализовать достаточный exact-tree на hosted-машине и реально выполнить новый `stream-preamble-tool-restart-test.js` вместе с ближайшим stream/session кластером; внешние CI не нужны.
2. Если этот кластер зелёный, проверить следующий недублирующийся Core-дефект. В первую очередь — границы сохранения mixed assistant turn при `retryEmpty`/смене фактического route, но сначала прочитать существующее покрытие.
3. Узкую механику cooldown/account selection не расширять без пересечения с Core.
4. После следующей существенной работы снова только нормативный v4 `restore → pack → immutable upload → reread/verify → CAS LATEST`; force-write запрещён.
