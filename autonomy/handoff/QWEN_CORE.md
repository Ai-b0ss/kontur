# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `df34d969fc9f474cae090974ba84f55436c02ef7`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Qwen Core — свежий результат

- Ранее закрытый streaming restart-gap OpenCode сохранён: новый `assistant.tool_calls` не выпускается клиенту, пока его durable checkpoint не принят; после `retryEmpty` сохраняется фактический новый маршрут `chatId/accountId`, а финальная запись не откатывает историю к состоянию до принятого tool-call.
- Добавлен постоянный интеграционный regression `scripts/stream-session-restart-integration-test.js` и включён в `npm test`. Он связывает настоящий `src/stream-session-guard.js` с настоящим `src/session-store.js` и проверяет цепочку: streaming `write_file` принят до первого client output → процессоподобный reload store → pending call переживает restart → короткий `continue` не перескакивает через него → только явный matching `role=tool` снимает pending состояние. Файл добавлен коммитом `c34cf0be…`, npm wiring — `955bbdcd…`.
- Проверен следующий риск `toolParser` при `retryEmpty`. По текущему `parseQwenSSE` orderly empty/unusable stream сначала вызывает `toolParser.flush()`, а `createToolCallStreamParser().flush()` очищает `pendingText/inToolCall/toolBuffer`. Поэтому ожидаемого загрязнения replacement-stream остатками незакрытого `<tool_call>` не обнаружено. Чтобы это не сломалось позже, `scripts/tool-stream-truncation-test.js` теперь переиспользует один parser между частичным rejected primary stream и свежим replacement и требует, чтобы stale `bash` не примешался к новому `read_file`. Коммит `59edb23a…`.
- Найден и исправлен отдельный реальный error-path defect в `src/stream-session-guard.js`: `finishWithError()` раньше вызывал `opts.onError(error)` до `res.end()/resolve()` без защиты. Если observer телеметрии/cooldown сам бросал исключение, EventEmitter callback мог выйти наружу и оставить client stream незавершённым. Теперь observer изолирован `try/catch`, а исходная upstream/persist ошибка всё равно штатно закрывает ответ. Коммит `fe4b8e0d…`.
- `scripts/stream-session-guard-test.js` усилен сценарием, где `onError` намеренно бросает исключение: клиент обязан получить исходную upstream-ошибку и завершённый response, а secondary observer failure не должен подменить её. Коммит `df34d969…`.
- На ChatGPT-hosted машине без Qwen/provider traffic и без внешнего CI целевая логика observer isolation воспроизведена: `QWEN_STREAM_ERROR_OBSERVER_ISOLATION_PASS`. Новый integration-test также прошёл синтаксическую проверку: `QWEN_STREAM_RESTART_TEST_SYNTAX_PASS`.
- Полный `npm test` на целиком материализованном exact private tree в этом проходе **не заявлен**. Доказанная граница: exact GitHub readback изменённых файлов + локальные целевые проверки. GitHub Actions/CircleCI ради обычной проверки не запускались.
- Во время работы соседний reliability-writer изменил только `server.js` и закрыл свой account-eligibility fallback. Перед Core-записью head был перечитан, его изменения сохранены и не откатывались.

### Capsule runtime — текущее состояние

- В начале прохода `LATEST.json` имел Git blob SHA `2a8fe1c5827e36ecbea4591af6a49a1d9b9a21a8` и указывал на валидную v4 capsule `20260820T175327Z-578be7c1a9` с archive SHA-256 `0af751ebf914585825c712325cbd76ccb1eefe5c0f7354d42e341da687197f0e`.
- Нормативный `autonomy/v3/tools/capsule_runtime_v4.py` материализован локально и побайтно проверен по Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; именно им выполнены `verify` и `restore` исходной capsule. Restore PASS, неизвестные байты из памяти не реконструировались.
- После работы checkpoint упакован тем же v4. Первая попытка upload под id `20260820T185657Z-a15bcde178` получила неверный `part-0001` при передаче через connector; этот каталог оставлен immutable orphan и **никогда не должен использоваться как pointer target**. Его не исправлять и не считать валидной capsule.
- Затем выполнен новый нормативный `pack → verify → restore`: capsule `20260820T185926Z-c7ebb68b42`, source ref `df34d969…`, archive SHA-256 `3964e26d9ed8c93637a0ca9cceb401147de9051172cb240d2a722037a62fdd99`, 4 части.
- Все четыре части и manifest загружены в новый immutable каталог и перечитаны обратно. Их Git blob SHA совпали с локальными байтами: `part-0000.b64` → `577fd8f6fc40c2c9bcf0673b87e72725b4bcf958`; `part-0001.b64` → `5bf07c9f63ab851f2e7de3998da303d368ef26ef`; `part-0002.b64` → `6c781804f0da3eb5bafc8ffcf23cb83510316f35`; `part-0003.b64` → `a9462bbb2da1b11e8afc212dc16068c2c2ae3d84`; `manifest.json` → `d71715cdef0c5adbe1efd9772d44aa4540635bbe`.
- Перед публикацией LATEST перечитан повторно: parent blob SHA всё ещё был исходным `2a8fe1c5…`. Старый LATEST сохранён как PREVIOUS, затем новый LATEST опубликован CAS-обновлением именно с этим parent SHA. Новый `LATEST.json` blob SHA `b8926d1896b867cb05ff0b4f4b4db2628bfdcdfd`; `PREVIOUS.json` теперь указывает на `20260820T175327Z-578be7c1a9` и имеет blob SHA `2a8fe1c5827e36ecbea4591af6a49a1d9b9a21a8`.
- Следующий worker обязан начинать с LATEST `20260820T185926Z-c7ebb68b42` и восстанавливать его нормативным v4; invalid orphan `20260820T185657Z-a15bcde178` игнорировать.

### Что уже доказано на Core-линии

- Non-stream accepted `assistant.tool_calls` сохраняются до возврата клиенту; короткое продолжение при незавершённом вызове останавливается с `409 QWEN_PENDING_TOOL_RESULT`.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса, поэтому restart не теряет уже выполненный результат инструмента.
- Streaming tool-call имеет fail-closed durable boundary до выдачи клиенту; persist failure не выпускает удержанный вызов.
- Error observers streaming-пути больше не способны сорвать штатное закрытие клиентского ответа.
- Persisted coding-subagents после потенциально изменяющего инструмента (`bash`, `write_file`, `edit_file`, `append_file`) переходят в `uncertain`; автоматический повтор после restart блокируется до явного `retryUncertain=true`.
- Наблюдатель `onEvent` изолирован от исполнения подагента.
- Crash-safe `opencode-sessions.json`: primary — граница подтверждения; backup обновляется после подтверждённого primary; неудачная запись откатывает память и канонический файл.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Многошаговый tool-loop продолжает после tool result, возвращает malformed JSON/executor ошибки как tool result, не исполняет незакрытый `<tool_call>`, хранит все tool calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- Два режима system prompt сохраняются: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Qwen pool / reliability — соседняя линия

Не перехватывать узкую механику cooldown/account selection без пересекающегося Core-дефекта. Reliability-worker пишет в ту же PR-ветку; перед каждой записью заново читать PR head и blob изменяемого файла, не откатывать его изменения.

### Текущие ограничения

- Обычные Node/Python/offline/tool-loop/restart/browser проверки — на ChatGPT hosted машине.
- GitHub Actions/CircleCI не запускать ради обычной проверки и не делать trigger-push ради CI.
- Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
- Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. В начале следующего прохода восстановить LATEST `20260820T185926Z-c7ebb68b42` нормативным v4 и заново прочитать свежий PR #6 head (на момент checkpoint `df34d969…`).
2. Материализовать достаточный exact source PR #6 на ChatGPT hosted машине и реально выполнить `scripts/stream-session-restart-integration-test.js`, `scripts/stream-session-guard-test.js`, `scripts/tool-stream-truncation-test.js` вместе с session/restart/tool-loop regressions; если получится полное дерево — полный `npm test`, без hosted CI и provider traffic.
3. Следующий Core-риск: несколько одновременно pending tool calls и частичный набор tool results через restart. Проверить, что результат одного call снимает только его id, остальные остаются pending, а короткий `continue` блокируется до явного согласования оставшихся вызовов.
4. Отдельно проверить, нет ли двойного завершения/лишнего error path при комбинации upstream `error` event и parser `onDone(error)`; менять код только при воспроизводимом offline regression.
5. Windows/live — только после полного offline green и по прежним ограничениям без дублирования provider traffic.
