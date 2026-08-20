# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `dea4ee945ea0fd0d3b0278ed2402435355aed569`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

### Qwen Core — свежий результат

- Проверен обычный OpenCode/session restart путь после локального tool result. Подтверждён реальный дефект: durable checkpoint истории раньше продвигался только после пригодного ответа Qwen. Если клиент уже выполнил локальный инструмент и прислал `role=tool`, а затем Qwen/parser/process падал до следующего `sessionStore.set`, короткое `continue` после restart мог восстановить состояние до результата инструмента и создать риск повторения уже выполненного side effect.
- Исправление внесено в продукт commit `36347b96e66b259c0193bddeac9fd070f5857b8a`: `session-store.restoreCheckpoint()` теперь до следующего upstream-запроса сохраняет только доказанный новый `role=tool` progress. Обычный новый user-turn без tool result заранее не коммитится. Полный клиентский transcript остаётся авторитетным, короткое продолжение получает merged checkpoint.
- Новая логика сравнивает tool results как multiset по каноническому checkpoint-представлению, поэтому повтор уже сохранённого результата не вызывает лишнюю запись, а дополнительный одинаковый результат всё равно считается новым.
- Добавлен постоянный regression `scripts/session-tool-result-progress-test.js`, commit `bef36688a87bbe12b56dfa752391b0b45987096e`; включён в обычный `npm test` commit `dea4ee945ea0fd0d3b0278ed2402435355aed569`.
- Regression моделирует именно нужную аварию: checkpoint до tool result → клиент прислал completed `write_file` result → никакого последующего `sessionStore.set`/успешного Qwen response → новый процесс загружает store → короткий `continue` обязан восстановить completed tool result. Отдельно проверяется, что user-only progress не precommit'ится и одинаковый уже сохранённый tool result не переписывает store.
- На собственной ChatGPT-машине без hosted CI/provider traffic отдельно прогнана целевая логика обнаружения нового tool result: `QWEN_SESSION_TOOL_RESULT_PROGRESS_PASS`.
- Долговечное evidence: `autonomy/v3/evidence/QWEN_SESSION_TOOL_RESULT_PROGRESS_20260820.json`, control commit `455c917d83da3e9e70ab630ed21a6eb4e63a2f1d`.
- Полный exact-tree `npm test` в этом запуске не заявляется: приватное дерево репозитория по-прежнему не материализовано напрямую в ChatGPT-container. CircleCI/GitHub Actions ради проверки не запускались, Qwen/provider traffic = 0, production/deploy = 0.

### Что уже было доказано на Core-линии ранее

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
- Отдельно доказан ещё не закрытый вторичный дефект: generic `markFailure('Failed to generate chat_id')` после уже классифицированной ошибки может лишний раз увеличить `failures` и затереть точный `lastError`. Evidence/candidates лежат в `autonomy/v3/evidence/QWEN_CHAT_ID_SECONDARY_FAILURE_20260820.json` и соответствующих `autonomy/v3/candidates/*`. Это зона `Qwen — пул и надёжность`.

### Текущие ограничения

- Старые FREE FABRIC E1/E1-v2 compute-probe не повторять: executable ChatGPT compute уже доказан.
- Для обычных Node/Python/offline/tool-loop/restart/browser проверок использовать ChatGPT hosted машину; hosted CI не запускать ради проверки.
- Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
- Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Qwen Core: проверить следующий restart-край — что происходит, если `role=tool` уже сохранён новым pre-upstream checkpoint, а последующий upstream ответ успел породить новый assistant tool-call, но процесс падает до следующего клиентского tool result. Нужно доказать, что короткий restart не теряет уже подтверждённый tool result и не «перескакивает» через незавершённый assistant call; patch только при воспроизводимом дефекте.
2. Если удастся бесплатно материализовать exact private tree в ChatGPT-container, сначала прогнать `session-tool-result-progress-test.js`, `session-store-restart-test.js`, `server-session-commit-order-test.js`, `server-nonstream-session-commit-test.js`, затем Core/subagent regressions и полный `npm test`. Hosted CI для этого не использовать.
3. После полного offline green — отдельный Windows PLATFORM_CONTRACT на exact head, когда будет бесплатный нативный исполнитель, без provider traffic.
4. Живой многошаговый `read_file → Qwen → bash → Qwen → final` делать только после восстановления результата старой разрешённой live-попытки; дубликат запрещён.
