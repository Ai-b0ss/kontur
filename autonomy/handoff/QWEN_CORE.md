# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `896dea540fa3c73aefb69e319dd07d8622fef383`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true` по последней проверке.

### Qwen Core — свежий результат

- Проверен следующий restart-край после уже сохранённого `role=tool`. Подтверждён реальный дефект non-stream OpenCode-пути: Qwen мог вернуть следующий `assistant.tool_calls`, сервер отдавал его клиенту, но durable checkpoint сохранял только входной `restoredMessages`. Если процесс/клиент падал до следующего `role=tool`, короткое `continue` после restart теряло незавершённый assistant call и могло перескочить через потенциально изменяющий инструмент.
- Исправление внесено в PR #6. `src/session-store.js` теперь умеет `checkpointAcceptedToolProgress(...)`: пригодный non-stream assistant-ответ с `tool_calls` добавляется в durable history до возврата ответа клиенту. `findPendingToolCalls(...)` отслеживает вызовы по `tool_call.id` и снимает их только после соответствующего `role=tool` результата.
- `server.js` в primary и non-stream retry сохраняет историю через `checkpointAcceptedToolProgress(...)`. Короткий `continue/продолжи/...` при незавершённом сохранённом tool-call теперь останавливается с `409 QWEN_PENDING_TOOL_RESULT`, вместо того чтобы слепо повторять потенциальный side effect или молча перескакивать через него. В ответ наружу выводятся только `id` и имя инструмента, без аргументов.
- Добавлен regression `scripts/session-pending-tool-call-restart-test.js`: подтверждённый `read_file` result → следующий принятый `write_file` call → restart до его результата → pending call обязан сохраниться; после явного matching `role=tool` pending снимается, а результат становится durable. Тест включён в обычный `npm test`.
- Коммиты этой Core-правки: `04cb2894859730e1be3f6fd9672d77c29eae6b0e`, `4a47e5647adf9c157d91c07e4e6124c13144ba79`, `970401f93d2f9cd6ca46385fef82a0999c94e34c`, `896dea540fa3c73aefb69e319dd07d8622fef383`.
- Во время работы соседний `QWEN_RELIABILITY` одновременно менял ту же PR-ветку. Первый `server.js` write получил `409`; файл был заново прочитан, после чего Core-правка наложена поверх свежего состояния без отката reliability-изменений. Дальше перед любой записью в PR #6 обязательно заново читать head/blob.
- На собственной ChatGPT-машине без hosted CI/provider traffic прогнана целевая логика: `QWEN_PENDING_TOOL_CALL_LOGIC_PASS accepted=1 resolved=1 multi=1 partial=1`.
- Полный exact-tree `npm test` в этом запуске не заявляется: полный приватный репозиторий не был материализован в контейнер через доступный GitHub connector. GitHub Actions/CircleCI не запускались, Qwen/provider traffic = 0, production/deploy = 0.

### Capsule v3 / постоянное состояние QWEN_CORE

- До этого запуска `autonomy/v3/workspaces/QWEN_CORE/LATEST.json` отсутствовал, поэтому создан первый checkpoint/capsule по протоколу v3.
- Capsule: `autonomy/v3/workspaces/QWEN_CORE/20260820T1505Z-pending-tool-restart/`.
- Archive SHA-256: `4c2433a87fafcf5cd6a9a6b52e93617d08438959863f38f0adfdbaf30766183b`, 2662 bytes, 2 base64 parts.
- Обе части и manifest после записи заново прочитаны через GitHub; их Git blob SHA совпали с локально вычисленными blob SHA. Локально archive был заново собран из parts, SHA/size проверены, безопасно распакован и проверен по `WORKSPACE_MANIFEST.json`.
- `LATEST.json` обновлён только после этой проверки и указывает на product commit `896dea540fa3c73aefb69e319dd07d8622fef383`, status `VALID`.
- Capsule намеренно тонкая (`thin_exact_git_pointer`): все продуктовые изменения уже durably committed в exact Git SHA; незакоммиченных source bytes нет. В capsule лежат source identity, checkpoint и локальное evidence, а не выдуманная реконструкция полного private tree.

### Что уже было доказано на Core-линии ранее

- `session-store.restoreCheckpoint()` до следующего upstream-запроса сохраняет доказанный новый `role=tool` progress. После restart короткое продолжение восстанавливает уже выполненный локальный инструмент, обычный user-only progress заранее не коммитится.
- Persisted coding-subagents после уже начатого потенциально изменяющего инструмента (`bash`, `write_file`, `edit_file`, `append_file`) переходят в `uncertain`, а не обычный retryable `failed`; автоматический повтор после restart блокируется до явного `retryUncertain=true`. Read-only ошибки остаются retryable.
- Наблюдатель `onEvent` изолирован от исполнения подагента: сбой UI/логирования после tool result больше не роняет задачу и не создаёт повтор side effect.
- Crash-safe `opencode-sessions.json`: primary — граница подтверждения; backup обновляется только после подтверждённого primary; неудачная запись откатывает память и канонический файл.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся, локальная история один раз переносится на свежий thread.
- Многошаговый tool-loop умеет продолжать после tool result, возвращать модели ошибки malformed JSON/executor как tool result, не исполнять незакрытый `<tool_call>`, хранить все tool calls одного model-turn и явно завершаться `QWEN_AGENT_ROUND_LIMIT` вместо ложного success.
- Два режима system prompt сохраняются: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, с приватным prompt владельца без переписывания и с отдельным нейтральным проектным контекстом.
- Нативный Windows Server 2022 parity был зелёным на предыдущей продуктовой линии; для нынешнего exact head новый Windows-run не выполнялся.

### Qwen pool / reliability — состояние соседней линии, не перехватывать без необходимости

- Fail-open через stale `current()`/`preferredAccount` закрыт; configured-but-none-eligible возвращает `503 QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие аккаунтов остаётся `401`.
- Cooldown стал монотонным: более слабая последующая ошибка не сокращает уже установленную CAPTCHA/rate-limit паузу.
- Соседний worker в этом же PR дополнительно меняет классификацию late-stream CAPTCHA/chat-id. Core не должен откатывать эти изменения; при конфликте всегда refetch текущего файла.

### Текущие ограничения

- Старые FREE FABRIC compute-probe не повторять.
- Для обычных Node/Python/offline/tool-loop/restart/browser проверок использовать ChatGPT hosted машину; hosted CI не запускать ради проверки.
- Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
- Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Qwen Core: закрыть эквивалентный **streaming** restart-gap. Сейчас после принятого SSE `assistant.tool_call` финальный streaming checkpoint всё ещё сохраняет только `restoredMessages`, поэтому незавершённый вызов может не стать durable. Нужен точный callback/accepted-call boundary в `pipeThroughOpenAI`/server: сохранить принятый assistant tool-call до того, как клиент может его потерять, и не позволить финальному stream checkpoint затереть pending state.
2. Добавить regression именно для streaming: предыдущий tool result durable → SSE выдаёт новый tool_call → авария до matching tool result → restart/short continue обязан увидеть pending call; matching result должен снять pending. Не делать сетевых/provider вызовов.
3. Если удастся бесплатно материализовать exact private tree в ChatGPT-container, прогнать сначала session/server regressions, затем Core/subagent regressions и полный `npm test`. Hosted CI для этого не использовать.
4. После полного offline green — отдельный Windows PLATFORM_CONTRACT на exact head, когда будет бесплатный нативный исполнитель, без provider traffic.
5. Живой многошаговый `read_file → Qwen → bash → Qwen → final` делать только после восстановления результата старой разрешённой live-попытки; дубликат запрещён.
