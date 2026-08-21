# Qwen — агентное ядро

Обновлено: 2026-08-21 07:41Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, текущий head `d41bc71ac7875c8bb4a625e128f20d01c2d885c6`.

В этом проходе закрыта проверка предыдущего streaming-fix на hosted-машине без Qwen и без внешнего CI:

- exact `scripts/stream-session-lifecycle-race-test.js` материализован с Git blob SHA `52e6d8a1fc40e47b0064732198791a5c5bb8fbcc` и реально выполнен;
- результат: `QWEN_STREAM_LIFECYCLE_RACE_PASS terminal_once=1 no_write_after_end=1 late_data_ignored=1 disconnected_client_isolated=1 successful_disconnect_isolated=1 midstream_disconnect_isolated=1 primary_upstream_classified_once=1`;
- `src/stream-session-guard.js` удалось материализовать функционально для запуска, но локальный Git blob SHA не совпал с каноническим `9c2d74c425a99e544fe1ea14fd28adf69769be14` из-за неполного переноса комментариев, поэтому это не считается exact-tree доказательством всего файла. Продуктовый код по этому поводу не менялся.

При read-only разборе `server.js` + `session-store.js` найден новый воспроизводимый Core-дефект восстановления контекста:

- non-stream путь после успешного обычного текстового ответа вызывает `sessionStore.checkpointAcceptedToolProgress(restoredMessages, assistantMessage)`;
- текущая реализация `checkpointAcceptedToolProgress()` добавляет assistant-сообщение только если в нём есть `tool_calls`; обычный `assistant.content` отбрасывается и в durable checkpoint остаются только предыдущие сообщения;
- локальный воспроизводимый harness на текущей логике дал `QWEN_NONSTREAM_ASSISTANT_CHECKPOINT_BUG_REPRODUCED assistant_lost=1`;
- следствие: после падения процесса и короткого `continue` сервер может восстановить пользовательский запрос, но не последний принятый текстовый ответ модели. Это ломает точное продолжение длинной OpenCode-сессии даже без инструментов;
- streaming-путь имеет аналогичный общий пробел для чистого текстового ответа: `streamAcceptedHistory` обновляется только через `onToolCallsAccepted`, поэтому финальный успешный текст модели тоже не добавляется в checkpoint.

Исправление в продукт в этом проходе не отправлено: `session-store.js` был получен из GitHub частями, но собранный локальный файл не совпал побайтно с каноническим blob `571fc4f3f536f06066dcf623dfcb0db49c11a528`. Перезаписывать целый приватный файл из реконструкции запрещено. Следующий writer должен менять только exact bytes из GitHub, не собирать неизвестные участки из памяти.

Полный exact-tree `npm test` не объявлять зелёным. GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты и production не использовались.

## Постоянная память

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, реализация `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте прочитан `autonomy/v3/workspaces/QWEN_CORE/LATEST.json`; exact Git blob SHA `0a26b34f066d9baf08317d9ee5aa5fb82fd15a57`. Он указывает на capsule `20260821T055653Z-ce3cad6218`, archive SHA-256 `2beb0e63444f642b113dbd74d0845f0f56b7ec82189f5781eb3d50cddcb164d3`.

Manifest и обе части capsule прочитаны отдельно. Канонический `capsule_runtime_v4.py` прочитан из Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`, однако доступный перенос connector → hosted filesystem снова не дал локальный файл с тем же Git blob SHA. Ручная сокращённая реализация для restore/pack не использовалась. Поэтому новая capsule и LATEST/PREVIOUS в этом проходе не публиковались; exact GitHub source остаётся recovery floor по failure-policy протокола.

## Следующее

1. Получить exact `session-store.js` без реконструкции и добавить durable сохранение обычного принятого `assistant.content` для non-stream пути. Tool-call fail-closed семантику не ослаблять.
2. Добавить постоянный regression: `user → обычный assistant text → crash → short continue` обязан восстановить и пользовательский ход, и текст assistant; длинный assistant должен соблюдать checkpoint limits.
3. Затем провести то же для streaming: собирать принятый текст ответа и фиксировать его только после успешного завершения upstream, не смешивая downstream disconnect с provider health.
4. После этого вернуться к multi-tool disconnect/restart: уже подтверждённые tool-call ids должны оставаться pending после исчезновения клиента и сниматься только соответствующими tool results.
5. При следующем существенном checkpoint выполнять только exact v4 `restore → pack → immutable upload → reread/verify → CAS LATEST`; force-write запрещён.
