# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `aaa8c11a32c8b4a88d31c48cddde178b4677addf`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Qwen Core — свежий результат

- Закрыт подтверждённый streaming restart-gap OpenCode: раньше клиент мог уже увидеть новый `assistant.tool_calls`, а durable checkpoint всё ещё содержал только прежние `restoredMessages`. После аварии короткое продолжение могло потерять незавершённый вызов инструмента.
- Добавлен `src/stream-session-guard.js`. Он использует точный существующий `parseQwenSSE`, собирает полный OpenAI tool-call из потоковых дельт и не выпускает вызов инструмента клиенту, пока сервер синхронно не подтвердил его запись в постоянное состояние. В режиме `requireToolCall` до этой границы удерживается и накопленный обычный вывод.
- Ошибка записи checkpoint теперь закрывается безопасно: удержанный текст/tool-call не выпускается, клиент получает штатную ошибку потока, а исключение durable-write не выбрасывается наружу через обработчик событий Node.
- `server.js` теперь передаёт `onToolCallsAccepted` в guarded streaming path и сохраняет `{role:'assistant', content:null, tool_calls:[...]}` через `checkpointAcceptedToolProgress(...)`. Callback читает текущие `streamRouteResponse/streamRoutePrepared`, поэтому после `retryEmpty` сохраняются фактические новые `chatId/accountId`, а не исходный маршрут.
- Финальная запись streaming-сессии больше не затирает принятый pending tool-call обратно на `checkpointMessages(restoredMessages)`: используется `streamAcceptedHistory`.
- Добавлены постоянные проверки `scripts/stream-session-guard-test.js` и `scripts/server-stream-session-guard-wiring-test.js`, обе включены в `npm test`. Первая проверяет принятие до client output, fail-closed при ошибке persist и replacement-stream после `retryEmpty`; вторая фиксирует серверную связку callback → guarded pipe → финальный checkpoint и запрещает возврат к старому незащищённому `chatAdapter.pipeThroughOpenAI` в OpenCode route.
- На машине ChatGPT без Qwen/provider traffic и без внешнего CI целевая логика прошла: `QWEN_STREAM_SESSION_GUARD_PASS accepted_before_output=1 persist_fail_closed=1 retry=1`.
- Коммиты текущего прохода: `6abbffc9…` (guard), `5f99c2de…` (server wiring), `0ee1fc05…` (behavior regression), `addf5719…` (npm wiring), `7ba25fe6…` (server wiring regression), `aaa8c11a…` (npm wiring regression).
- Полный `npm test` на целиком материализованном exact private tree в этом проходе **не заявлен**. Текущая доказанная граница — целевой локальный regression + GitHub readback/diff точных изменённых файлов. Hosted CI ради обычной проверки не запускался.

### Capsule runtime — текущее состояние

- В начале запуска `LATEST.json` имел Git blob SHA `6a51b27608df34b32a604dda7df0546ccb6125b9` и указывал на старую capsule `20260820T1505Z-pending-tool-restart` формата `free_fabric_capsule_v3_b64`. Нормативный `capsule_runtime_v4.py` принимает только `free_fabric_worker_capsule_v4`; `PREVIOUS.json` отсутствовал. Поэтому восстановление по protocol v2 честно упало на recovery floor — exact GitHub source `896dea54…`, без реконструкции неизвестных байтов.
- Нормативный `autonomy/v3/tools/capsule_runtime_v4.py` материализован локально и побайтно проверен по Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; использован именно его `pack/verify/restore`, без ручного сокращения протокола.
- Создана и локально `verify + restore` проверена настоящая v4 capsule `20260820T175327Z-578be7c1a9`, archive SHA-256 `0af751ebf914585825c712325cbd76ccb1eefe5c0f7354d42e341da687197f0e`, source ref `aaa8c11a…`.
- На GitHub неизменно загружены оба part и manifest. Readback Git blob SHA совпал с локальными байтами: `part-0000.b64` → `3f77320396ddd0a67ab12e38f868f676c2989286`, `part-0001.b64` → `376277d91e698b3b0794b4e1bf15023006600c8f`, `manifest.json` → `1d3992ef7e5a44d045d81c7869c01b3fba3326b5`.
- Перед публикацией LATEST перечитан повторно: parent SHA всё ещё был точным `6a51b276…`. Старый LATEST сохранён как `PREVIOUS.json`, затем новый LATEST опубликован через `update_file` именно с этим parent SHA. Новый LATEST blob SHA: `2a8fe1c5827e36ecbea4591af6a49a1d9b9a21a8`.
- Следующий worker обязан начинать уже с этого нового LATEST и восстанавливать capsule через v4. Старый v3 теперь остаётся только rollback/reference через PREVIOUS и не должен объявляться валидным v4.

### Что уже доказано на Core-линии

- Non-stream accepted `assistant.tool_calls` сохраняются до возврата клиенту; короткое продолжение при незавершённом вызове останавливается с `409 QWEN_PENDING_TOOL_RESULT`.
- Новый подтверждённый `role=tool` сохраняется до следующего upstream-запроса, поэтому restart не теряет уже выполненный результат инструмента.
- Streaming tool-call теперь тоже имеет fail-closed durable boundary до его выдачи клиенту.
- Persisted coding-subagents после потенциально изменяющего инструмента (`bash`, `write_file`, `edit_file`, `append_file`) переходят в `uncertain`; автоматический повтор после restart блокируется до явного `retryUncertain=true`.
- Наблюдатель `onEvent` изолирован от исполнения подагента.
- Crash-safe `opencode-sessions.json`: primary — граница подтверждения; backup обновляется после подтверждённого primary; неудачная запись откатывает память и канонический файл.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Многошаговый tool-loop продолжает после tool result, возвращает модели malformed JSON/executor ошибки как tool result, не исполняет незакрытый `<tool_call>`, хранит все tool calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- Два режима system prompt сохраняются: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Qwen pool / reliability — соседняя линия

Не перехватывать узкую механику cooldown/account selection без пересекающегося Core-дефекта. Reliability-worker может писать в ту же PR-ветку: перед каждой записью заново читать PR head и blob изменяемого файла, не откатывать его изменения.

### Текущие ограничения

- Обычные Node/Python/offline/tool-loop/restart/browser проверки — на ChatGPT hosted машине.
- GitHub Actions/CircleCI не запускать ради обычной проверки и не делать trigger-push ради CI.
- Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
- Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. В начале следующего прохода восстановить новый LATEST `20260820T175327Z-578be7c1a9` нормативным v4 и заново прочитать свежий PR head.
2. Материализовать достаточный exact source PR #6 на ChatGPT hosted машине и прогнать новые streaming tests вместе с session/restart/tool-loop регрессиями; если получится полное дерево — полный `npm test`, всё без hosted CI и без provider traffic.
3. Проверить следующий Core-риск: не остаётся ли частичное состояние общего `toolParser` после неудачного/пустого первичного stream перед `retryEmpty`, которое может примешаться к replacement stream. Менять только при воспроизводимом offline regression.
4. После offline green отдельно проверить restart-сценарий `accepted streaming tool_call → process restart → short continue blocks → matching tool result resolves pending` на настоящем session-store, не только на boundary helper.
5. Windows/live — только после полного offline green и по прежним ограничениям без дублирования provider traffic.
