# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `83b43364ba48fcea4d8d0f8394549c6cf64d7000`, PR draft/open. Последний Core-head этого запуска — `56ed494aa3fd9287befebe36ace325ae45b4d30a`; следующий commit до `83b43364…` меняет только `src/qwen-client.js` и относится к соседней линии надёжности, Core-файлы не затронуты.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- Закрыт диагностический дефект persisted coding-subagents. Раньше исходная ошибка Qwen/coding-turn могла быть скрыта вторичной ошибкой `markUncertain()`/`markFailed()`: запись состояния падала уже после исходного сбоя, и наружу вылетала ошибка хранилища. Теперь вторичная ошибка записи состояния перехватывается отдельно; исходные `code/error/uncertain` сохраняются для текущего вызова, durable `running` остаётся нетронутым и продолжает запрещать автоматический повтор. Дополнительно возвращаются только безопасные признаки `diagnosticsPersisted=false` и `statePersistenceCode`, без текста/пути ошибки хранилища.
- Закрыт соседний дефект диагностики результата: `markResultPersistenceUncertain()` уже сохранял исходный код ошибки `markDone()` в `error.persistenceCode`, но runner терял это поле при формировании failed-result. Теперь первопричина (`persistenceCode`, например `EIO`) попадает в durable `uncertain`-результат, а после restart блокирующий ответ возвращает `priorPersistenceCode`. Вторичный сбой записи uncertain-state отделён в `statePersistenceCode`, поэтому две причины больше не смешиваются.
- Изменения Core: `238afa3f2c098494d59008988fb7688ab79b59bc` (базовая защита), `7d9cc693a24a8ea2247255f2a43c080dd5706bdb` (разделение primary/secondary persistence diagnostics), `f8941fa89a24e1bfe6c3428f82eac51cd6089a58` и `56ed494aa3fd9287befebe36ace325ae45b4d30a` (постоянные regression-сценарии).
- Постоянный `scripts/subagent-side-effect-uncertainty-test.js` теперь проверяет: mutating failure → uncertain; auto-retry blocked; сбой записи `markUncertain` не скрывает исходный `QWEN_UPSTREAM_STREAM_FAILED`, оставляет durable `running` и всё равно блокирует повтор; completed mutating result при падении `markDone` сохраняет `QWEN_SUBAGENT_RESULT_PERSIST_FAILED` вместе с исходным `persistenceCode`; restart видит `priorPersistenceCode` только если эта диагностика действительно была долговечно записана.
- На ChatGPT-hosted машине без внешнего CI/provider traffic целевые проверки прошли: `QWEN_SUBAGENT_PERSIST_DIAGNOSTIC_GUARD_PASS original_preserved=1 durable_running_guard=1 no_sensitive_persist_message=1` и `QWEN_SUBAGENT_PERSISTENCE_DIAGNOSTICS_PASS durable_root_cause=1 secondary_store_failure_distinct=1 original_failure_preserved=1`.
- Полный exact-tree `npm test` всё ещё не заявлен: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты и production не использовались.

### Постоянная память / capsule runtime

- В начале запуска нормативно восстановлен LATEST `20260820T215201Z-7440afb0bf` через exact `capsule_runtime_v4.py`: part/manifest/archive/workspace verification и restore — PASS. Стартовый Git blob SHA указателя был `9a1da451efececcac9a12d19af8c23c124c931c0`; PREVIOUS не понадобился.
- После существенной работы создан нормативный v4 checkpoint `20260820T235137Z-5bb3f8906e`, archive SHA-256 `d602c464811823c5279cc58e3da9b85e4a2941ac7fdee99eddc6e2ba15790c66`, source ref `56ed494aa3fd9287befebe36ace325ae45b4d30a`. Локальные `verify + restore` прошли.
- Immutable upload перечитан: `part-0000.b64` — 2048 chars, SHA-256 `64f5a76b99e51b8147deac25e8fcb6f9af68e89ace9a3c85b1dee1ce05af64b3`; `part-0001.b64` — 564 chars, SHA-256 `00976950877bfd5007a0a7842240533f6edecfd584ebb16d5a9d7f0e46708b72`; собранный archive — 1958 bytes и SHA-256 `d602c464…790c66`. Manifest перечитан и совпадает с локальным.
- Перед публикацией LATEST был перечитан и всё ещё имел исходный blob SHA `9a1da451…`; старый LATEST сохранён в PREVIOUS, затем новый LATEST опубликован через `update_file` именно с исходным parent SHA. Текущий LATEST blob SHA `c7fbc10522cac933850bcccaae2fbf4157bbe9c1` и указывает на `20260820T235137Z-5bb3f8906e`.
- Невалидные immutable orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` никогда не использовать и не чинить на месте.

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
- Сбой `markRunning` происходит до старта coding turn, поэтому не создаёт неподтверждённый tool side effect.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. В следующем запуске начать с нового нормативного LATEST `20260820T235137Z-5bb3f8906e` и перечитать свежий PR #6 head: соседний reliability-worker продолжает двигать `qwen-client`, поэтому `83b43364…` не считать вечным.
2. Проверить явный `retryUncertain=true` после ситуации, где durable состояние осталось `running` из-за неудачной записи diagnostics: повтор разрешается только после новой успешной записи `running`; убедиться воспроизводимым тестом, что диагностическая неопределённость не может быть ошибочно снята или потеряна при ещё одном сбое состояния.
3. По возможности материализовать exact private tree на ChatGPT-hosted машине и прогнать `scripts/subagent-side-effect-uncertainty-test.js`, `scripts/subagent-batch-resume-test.js` и соседние subagent/session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
