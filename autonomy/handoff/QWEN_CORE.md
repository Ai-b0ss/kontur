# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `22b4fa819685eaca943a012e179d9ef7eca4eac0`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- Закрыт диагностический дефект persisted coding-subagents. Раньше исходная ошибка Qwen/coding-turn могла быть скрыта вторичной ошибкой `markUncertain()`/`markFailed()`: запись состояния падала уже после исходного сбоя, и наружу вылетала ошибка хранилища. Теперь вторичная ошибка записи состояния перехватывается отдельно; исходные `code/error/uncertain` сохраняются для текущего вызова, durable `running` остаётся нетронутым и продолжает запрещать автоматический повтор. Дополнительно возвращаются только безопасные признаки `diagnosticsPersisted=false` и `statePersistenceCode`, без текста/пути ошибки хранилища.
- Закрыт соседний дефект диагностики результата: `markResultPersistenceUncertain()` уже сохранял исходный код ошибки `markDone()` в `error.persistenceCode`, но runner терял это поле при формировании failed-result. Теперь первопричина (`persistenceCode`, например `EIO`) попадает в durable `uncertain`-результат, а после restart блокирующий ответ возвращает `priorPersistenceCode`. Вторичный сбой записи uncertain-state отделён в `statePersistenceCode`, поэтому две причины больше не смешиваются.
- Найден и исправлен следующий restart-gap явного повтора. `subagent-batch-store.markRunning()` раньше очищал `result` в момент `retryUncertain=true`. Если новая попытка затем падала вместе с процессом до нового terminal commit, durable `running` всё ещё безопасно блокировал автоматический повтор, но причина предыдущей неопределённости терялась. Теперь `markRunning()` сохраняет предыдущий diagnostic result, пока новая попытка находится в `running`; новый `done/failed/uncertain` по-прежнему заменяет его нормальным terminal result.
- Добавлен постоянный `scripts/subagent-retry-diagnostic-preservation-test.js` и включён в `npm test`: `uncertain -> running` обязан сохранять diagnostic result после reopen/restart, а новый durable `done` обязан его заменить.
- Изменения Core этого запуска: `238afa3f2c098494d59008988fb7688ab79b59bc`, `f8941fa89a24e1bfe6c3428f82eac51cd6089a58`, `7d9cc693a24a8ea2247255f2a43c080dd5706bdb`, `56ed494aa3fd9287befebe36ace325ae45b4d30a`, `435510d16578b264aa3b724e77e57a47ff34e19f`, `84cc1a469a3366f9909a160c78372c66fe97551f`, `22b4fa819685eaca943a012e179d9ef7eca4eac0`.
- На ChatGPT-hosted машине без внешнего CI/provider traffic для первого диагностического слоя прошли целевые проверки: `QWEN_SUBAGENT_PERSIST_DIAGNOSTIC_GUARD_PASS original_preserved=1 durable_running_guard=1 no_sensitive_persist_message=1` и `QWEN_SUBAGENT_PERSISTENCE_DIAGNOSTICS_PASS durable_root_cause=1 secondary_store_failure_distinct=1 original_failure_preserved=1`.
- Новый explicit-retry regression закоммичен как постоянный тест, но полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты и production не использовались.

### Постоянная память / capsule runtime

- В начале запуска нормативно восстановлен LATEST `20260820T215201Z-7440afb0bf` через exact `capsule_runtime_v4.py`: part/manifest/archive/workspace verification и restore — PASS. Стартовый Git blob SHA указателя был `9a1da451efececcac9a12d19af8c23c124c931c0`; PREVIOUS не понадобился.
- После первого существенного блока создан нормативный v4 checkpoint `20260820T235137Z-5bb3f8906e`, archive SHA-256 `d602c464811823c5279cc58e3da9b85e4a2941ac7fdee99eddc6e2ba15790c66`, source ref `56ed494aa3fd9287befebe36ace325ae45b4d30a`. Локальные `verify + restore` прошли; immutable upload перечитан и совпал с manifest. Перед публикацией LATEST всё ещё имел стартовый blob SHA, поэтому старый LATEST был сохранён в PREVIOUS, а новый LATEST опубликован через CAS. Текущий LATEST blob SHA `c7fbc10522cac933850bcccaae2fbf4157bbe9c1` и указывает на эту капсулу.
- После второго существенного блока (сохранение diagnostics во время explicit retry) создан **ещё один нормативный v4 checkpoint** `20260820T235757Z-6376281fee`, archive SHA-256 `7f6bba39c46e768b86239bbca26dfe815a1bd90aaa763fdb6b27b5c6a07cf91c`, source ref `22b4fa819685eaca943a012e179d9ef7eca4eac0`. Локальные `verify + restore` — PASS. Immutable upload перечитан: `part-0000.b64` 2048 chars / SHA-256 `588961d2f768ae89f77c00c6d16e813330480ea75327a0b001bf9523933ff7d2`; `part-0001.b64` 908 chars / SHA-256 `42a00e8b6da63767700373410e491ad48fa86a9cbeca5e8f8064e350ee77b19d`; manifest совпадает, archive 2215 bytes / SHA-256 `7f6bba39…7cf91c`.
- Второй checkpoint **намеренно не переписал LATEST**. Нормативный CAS-parent, запомненный в начале запуска, уже изменился после первой нашей публикации (`9a1da451… -> c7fbc105…`). Протокол запрещает force-write при изменённом parent SHA, поэтому `20260820T235757Z-6376281fee` оставлен валидной immutable capsule, а LATEST остаётся на `20260820T235137Z-5bb3f8906e`. Следующий запуск должен восстановить LATEST, затем учесть этот handoff и exact source `22b4fa…`; при новом checkpoint он сможет опубликовать актуальное состояние с новым CAS-parent.
- Невалидные immutable orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` никогда не использовать и не чинить на месте. Валидную непубликованную `20260820T235757Z-6376281fee` с ними не путать.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once: transport error, parser completion/error и поздние parser data не способны повторно завершить response или писать после terminal state.
- Synchronous parser/retry factory failures удерживаются внутри streaming lifecycle; replacement rejection не остаётся unhandled.
- Error observers streaming-пути не способны сорвать штатное закрытие клиентского ответа.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- Если coding-subagent уже завершился, но его финальный результат не удалось долговечно зафиксировать, задача становится `uncertain`, хранит безопасный код первичной persistence-причины и не исполняется повторно автоматически.
- Если после потенциального side effect не удаётся записать `uncertain`, durable `running` остаётся защитным состоянием; текущий вызов всё равно получает исходную coding/provider ошибку и отдельный безопасный код secondary persistence failure.
- Во время явного повтора `running` сохраняет предыдущий diagnostic result до нового terminal commit, поэтому авария посередине retry не стирает причину прежней неопределённости.
- Сбой `markRunning` происходит до старта coding turn, поэтому не создаёт неподтверждённый tool side effect.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. В следующем запуске начать с нормативного LATEST `20260820T235137Z-5bb3f8906e`, затем прочитать этот handoff и свежий PR #6 head. Валидная `20260820T235757Z-6376281fee` содержит более свежий worker checkpoint, но не является LATEST из-за строгого CAS-правила.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и выполнить `scripts/subagent-side-effect-uncertainty-test.js`, `scripts/subagent-batch-resume-test.js`, `scripts/subagent-retry-diagnostic-preservation-test.js` и соседние session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий узкий Core boundary: проверить реальный отказ `markRunning()` при `retryUncertain=true` с сохранённой прежней диагностикой. Coding turn не должен стартовать, старый uncertain/running guard и его причина не должны быть разрушены.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
