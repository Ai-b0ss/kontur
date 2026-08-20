# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `b19b8d19f9a19170feb19ed27cbd6676ecffe831`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- Нормативный входной LATEST: `20260820T215201Z-7440afb0bf`, archive SHA-256 `25d502e7b826536964c3276840ed83d64ad366d981b168d33ec11404a5a85258`, Git blob SHA указателя `9a1da451efececcac9a12d19af8c23c124c931c0`. Manifest имеет нормативную схему `free_fabric_worker_capsule_v4`, один part с SHA `902f6b8755f116cafdddb42cd17ec0ef23e758fbe2152286bbdebf6421675d10`; неизвестные bytes не реконструировались.
- PR #6 ушёл вперёд от предыдущего Core head `394f0489…` до `b19b8d19…` ровно на два коммита другого работника; compare показывает изменения только в `src/account-store.js` и `scripts/account-store-mutation-atomicity-test.js`. Core-файлы subagent/session/stream не менялись, поэтому предыдущие Core-инварианты не были затёрты.
- Проверен следующий boundary из прошлого handoff: сбой `markUncertain`/`markRunning` batch-store **не воспроизводит автоматический повтор** при текущей архитектуре. `markRunning` выполняется до coding turn, поэтому его отказ происходит до любого tool side effect; durable состояние остаётся прежним. Если после возможного side effect падает `markUncertain`, предшествующий успешно записанный `running` остаётся durable и следующий запуск уже блокирует автоматический retry тем же guard, что и `uncertain`. Аналогично неудачный `markFailed` после read-only failure оставляет более консервативный `running`, то есть может потребовать ручного разрешения, но не создаёт duplicate side effect. Продуктовый код по этому месту не менялся: нарушение безопасности не доказано.
- Важная деталь: `retryUncertain=true` сначала пытается долговечно записать новый `running`; если эта запись падает, старое `uncertain/running` не снимается, а coding turn не стартует. Это тоже fail-closed.
- Полный exact-tree `npm test` всё ещё не заявлен: целиком приватное дерево локально не материализовано. GitHub Actions/CircleCI/Cloudflare и живой Qwen намеренно не запускались.

### Предыдущий существенный Core-result

- Если coding-subagent уже успешно закончил работу, но `markDone()` не смог долговечно записать результат, задача получает `QWEN_SUBAGENT_RESULT_PERSIST_FAILED`, `uncertain=true`; автоматический повтор блокируется. Постоянный regression `scripts/subagent-side-effect-uncertainty-test.js` покрывает этот случай.
- Локальная ошибка сохранения принятого streaming tool-call (`QWEN_TOOL_CHECKPOINT_REJECTED`) отделена от provider/account health и не штрафует здоровый Qwen-аккаунт.

### Постоянная память / capsule runtime

- Текущий входной checkpoint: `20260820T215201Z-7440afb0bf`, archive SHA-256 `25d502e7b826536964c3276840ed83d64ad366d981b168d33ec11404a5a85258`, LATEST blob SHA `9a1da451efececcac9a12d19af8c23c124c931c0`.
- Невалидные immutable orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` никогда не использовать и не чинить на месте.
- Финальный checkpoint после следующей существенной мутации/локального exact-tree доказательства публиковать только по нормативному v4: pack -> verify/restore -> immutable upload -> reread/verify every part + manifest -> reread LATEST -> CAS от стартового blob SHA. При CAS-конфликте новый immutable capsule оставить без принудительной записи указателя.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once: transport error, parser completion/error и поздние parser data не способны повторно завершить response или писать после terminal state.
- Synchronous parser/retry factory failures удерживаются внутри streaming lifecycle; replacement rejection не остаётся unhandled.
- Error observers streaming-пути не способны сорвать штатное закрытие клиентского ответа.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- Если coding-subagent уже завершился, но его финальный результат не удалось долговечно зафиксировать, задача тоже становится `uncertain` и не исполняется повторно автоматически.
- Сбой записи `markUncertain` после потенциального side effect оставляет durable `running`, который также блокирует автоматический retry; сбой `markRunning` происходит до старта coding turn.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Начать со свежего нормативного QWEN_CORE LATEST и перечитать PR #6 head; не считать `b19b8d19…` вечным.
2. При первой возможности материализовать exact private tree на ChatGPT-hosted машине и прогнать `scripts/subagent-side-effect-uncertainty-test.js`, `scripts/subagent-batch-resume-test.js`, соседние subagent/session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий Core boundary: проверить не только статус, но и **сохранность диагностического результата**, когда запись `markUncertain` сама падает после side effect. Безопасность от duplicate retry уже есть за счёт durable `running`, но причина исходной ошибки может потеряться; менять поведение только если воспроизводимый тест покажет, что это мешает безопасному явному восстановлению `retryUncertain=true`.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
