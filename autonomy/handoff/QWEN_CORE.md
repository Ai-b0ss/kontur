# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `896dea540fa3c73aefb69e319dd07d8622fef383`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Qwen Core — свежий результат

- Non-stream restart-gap уже закрыт на `896dea54…`: принятый `assistant.tool_calls` сохраняется через `checkpointAcceptedToolProgress(...)`, а короткое продолжение при незавершённом вызове останавливается с `409 QWEN_PENDING_TOOL_RESULT`.
- Эквивалентный streaming-gap подтверждён на exact head и локализован точнее. `parseQwenSSE()` уже знает полный нормализованный tool-call в `writeToolCallDeltas(calls)` непосредственно **до** отправки его OpenAI SSE-дельт клиенту. Но `pipeThroughOpenAI()` сейчас не имеет callback для принятого tool-call, а `server.js` после завершения stream делает `sessionStore.set(... history: sessionStore.checkpointMessages(restoredMessages))`. Поэтому streaming tool-call может быть виден клиенту, но отсутствовать в durable checkpoint; финальная запись также не умеет сохранить этот новый pending call.
- Безопасная граница исправления определена: добавить синхронный `onToolCallsAccepted(calls)` в parser/pipe и вызывать его в `writeToolCallDeltas` **до любого выпуска накопленных `bufferedDataLines` и до первой tool-call SSE-дельты**. Это важно для `requireToolCall`: до обнаружения вызова обычные SSE-строки уже накоплены, но ещё не видны клиенту, поэтому durable checkpoint должен стать границей принятия до разблокировки всего накопленного вывода.
- Новый существенный нюанс после чтения exact parser: callback нельзя просто дать выбросить исключение наружу из `stream.on('data')`. Такой throw уйдёт через EventEmitter-обработчик и способен стать необработанным исключением процесса. `writeToolCallDeltas` должен сам перехватить ошибку durable-write, вызвать `close(error)` и вернуть **до** изменения `toolCallDetected/emittedOutput`, до flush `bufferedDataLines` и до `onData`. То есть ошибка checkpoint превращается в штатную ошибку потока, а не в падение сервера и не в частично выданный tool-call.
- Server callback должен собрать assistant message `{role:'assistant', content:null, tool_calls:calls}` и синхронно вызвать `sessionStore.set(... history: checkpointAcceptedToolProgress(restoredMessages, assistantMessage))` с текущими `streamRouteResponse/streamRoutePrepared`. Если durable write падает, tool-call нельзя выпускать клиенту как принятый. После успешного callback финальный stream checkpoint не должен затирать pending history обратно на `restoredMessages`.
- `retryEmpty` меняет `streamRouteResponse/streamRoutePrepared` до возврата replacement stream, поэтому callback должен читать эти переменные в момент принятия вызова, а не захватывать исходный route. Это сохраняет правильные `chatId/accountId` после bounded retry/failover.
- Нужен regression без сети: предыдущий durable tool result → streaming SSE выдаёт новый `write_file` call → callback фиксирует его до **любого** клиентского вывода, включая ранее buffered content → имитируем restart до matching result → `findPendingToolCalls` видит call → короткое continue блокируется → matching `role=tool` снимает pending. Отдельно проверить retryEmpty route и ошибку persist: при ней `tool_call` и накопленный require-tool output не должны попасть клиенту, а процесс не должен падать.
- Product source в этом запуске не мутировался: доступный GitHub connector умеет полную замену файла, но не безопасный частичный patch большого `server.js/chat-adapter.js`; не переписывать большие файлы из усечённого fetch и не реконструировать неизвестные bytes из памяти. Hosted CI/provider traffic/production не использовались.

### Capsule runtime — важное состояние

- В начале запуска `LATEST.json` прочитан; parent Git blob SHA: `6a51b27608df34b32a604dda7df0546ccb6125b9`.
- Он указывает на capsule `20260820T1505Z-pending-tool-restart`, но её manifest имеет schema `free_fabric_capsule_v3_b64`, тогда как нормативный `capsule_runtime_v4.py` принимает только `free_fabric_worker_capsule_v4`. `PREVIOUS.json` отсутствует. Поэтому старую capsule нельзя честно объявлять восстановленной через v4; согласно protocol v2 recovery floor — exact GitHub source, и работа продолжена с exact product commit `896dea54…`.
- Не реконструировать неизвестные bytes старой capsule из памяти. Следующий writer должен создать новый настоящий v4 checkpoint/capsule через `capsule_runtime_v4.py pack`, verify/readback и CAS LATEST от parent blob `6a51b276…` только если LATEST всё ещё имеет этот exact blob SHA. Если LATEST уже изменился — не force-write, принять нового writer.
- В текущей hosted-машине нормативный `capsule_runtime_v4.py` отсутствует как локальный файл, а connector даёт его содержимое только как GitHub resource, не как смонтированный файл. Поэтому v4 pack вручную не имитировался: protocol v2 прямо запрещает ручное сокращение publish/restore. Это ограничение лучше, чем публикация псевдо-v4 capsule.

### Что уже доказано на Core-линии

- `session-store.restoreCheckpoint()` до следующего upstream-запроса сохраняет новый подтверждённый `role=tool` progress.
- Persisted coding-subagents после потенциально изменяющего инструмента (`bash`, `write_file`, `edit_file`, `append_file`) переходят в `uncertain`; автоматический повтор после restart блокируется до явного `retryUncertain=true`.
- Наблюдатель `onEvent` изолирован от исполнения подагента.
- Crash-safe `opencode-sessions.json`: primary — граница подтверждения; backup обновляется после подтверждённого primary; неудачная запись откатывает память и канонический файл.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Многошаговый tool-loop продолжает после tool result, возвращает модели malformed JSON/executor ошибки как tool result, не исполняет незакрытый `<tool_call>`, хранит все tool calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- Два режима system prompt сохраняются: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Qwen pool / reliability — соседняя линия

Не перехватывать узкую механику cooldown/account selection без пересекающегося Core-дефекта. Не откатывать изменения reliability-worker в той же PR-ветке; перед любой записью заново читать head/blob.

### Текущие ограничения

- Обычные Node/Python/offline/tool-loop/restart/browser проверки — на ChatGPT hosted машине.
- GitHub Actions/CircleCI не запускать ради обычной проверки.
- Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
- Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Реализовать streaming accepted-tool boundary по схеме выше, но только через exact bytes свежего head; при конфликте refetch. Callback failure обязательно превращать в `close(error)` до любого client output, а не бросать исключение из EventEmitter.
2. Добавить streaming restart regression + persist-failure-before-any-output + retryEmpty route regression.
3. Прогнать Core/session/subagent проверки локально; если удастся материализовать exact tree — полный `npm test` без hosted CI.
4. После существенной записи создать новый **v4** capsule нормативным `capsule_runtime_v4.py`, полностью проверить upload/readback и публиковать LATEST только CAS от стартового blob SHA; stale writer не перезаписывает нового.
5. Windows/live — только после полного offline green и по прежним ограничениям без дублирования provider traffic.
