# Qwen — агентное ядро

Обновлено: 2026-08-21 08:52Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, текущий head после Core-изменений `0b95364f01662c4496877126dd28c1e6099ea3aa`.

В этом проходе закрыт воспроизводимый дефект восстановления обычного текстового ответа OpenCode:

- до исправления `checkpointAcceptedToolProgress()` сохранял новое assistant-сообщение только при наличии `tool_calls`; обычный принятый `assistant.content` выпадал из durable history;
- после падения процесса короткое `continue` могло восстановить пользовательский запрос, но не последний текстовый ответ Qwen;
- `src/session-store.js` теперь пропускает принятый assistant-текст через тот же ограниченный checkpoint, не ослабляя fail-closed проверки для tool-call;
- длинный текст по-прежнему проходит через существующий лимит содержимого; точная проверка id/содержимого принятого tool-call и `QWEN_TOOL_CHECKPOINT_REJECTED` сохранены;
- добавлен постоянный `scripts/session-assistant-text-checkpoint-test.js`: `user → assistant text → restart → short continue`, ограничение длинного ответа и сохранение прежней tool-call семантики;
- новый тест включён в обычный `npm test`.

Коммиты:
- `87f8106ff72fd93face6bbe23dbb36a1966810db` — исправление session-store;
- `f7bd6554eb85fa06e0aa34d76d698a5c1b27b7a9` — постоянный regression;
- `0b95364f01662c4496877126dd28c1e6099ea3aa` — включение regression в `npm test`.

Полный exact-tree `npm test` пока не объявлять зелёным: весь приватный репозиторий не материализован на hosted-машине, внешние CI намеренно не запускались. Живой Qwen, реальные аккаунты, Cloudflare и production не использовались.

## Постоянная память

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, реализация `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте прочитан `LATEST` с Git blob SHA `0a26b34f066d9baf08317d9ee5aa5fb82fd15a57`, capsule `20260821T055653Z-ce3cad6218`, archive SHA-256 `2beb0e63444f642b113dbd74d0845f0f56b7ec82189f5781eb3d50cddcb164d3`.

Канонический `capsule_runtime_v4.py` материализован побайтно: локальный Git blob SHA совпал с нормативным `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Стартовая capsule прошла exact `verify + restore`.

После работы создана новая v4 capsule `20260821T085022Z-02f231a98c`, archive SHA-256 `82e29b812210b4f817fd72b9791540f9f6096901b7aa16fa3afdd416bb02413d`. Обе части и manifest загружены неизменяемо и перечитаны из GitHub. Перед публикацией `LATEST` был перечитан и всё ещё имел исходный parent blob SHA, поэтому CAS прошёл штатно. Старый LATEST сохранён как `PREVIOUS`. Текущий `LATEST` указывает на новую capsule и имеет Git blob SHA `ef4e7d5d57e8be1fe3b0c172250f051ea3d77d36`.

## Следующее

1. На hosted-машине материализовать достаточный exact-tree и реально выполнить новый `session-assistant-text-checkpoint-test.js`; не использовать CircleCI/GitHub Actions ради обычной проверки.
2. Закрыть аналогичный streaming-пробел: собирать принятый assistant-текст и фиксировать его только после успешного завершения upstream. Downstream disconnect не должен влиять на здоровье Qwen-аккаунта.
3. Добавить restart regression для чистого streaming text: `user → streamed assistant text → crash → short continue`.
4. Затем вернуться к multi-tool disconnect/restart: подтверждённые tool-call ids остаются pending после исчезновения клиента и снимаются только соответствующими tool results.
5. После следующей существенной работы повторить только нормативный v4 `restore → pack → immutable upload → reread/verify → CAS LATEST`; force-write запрещён.
