# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `394f048991003df5980aef3e8a2f2121db60ae58`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале прохода нормативно восстановлен LATEST `20260820T210201Z-7d8dcd7309` через exact `capsule_runtime_v4.py`; archive SHA-256 совпал: `ccb644d51a9806b969892e9bfb0bda559b5ae66b049930e1fef28321fe2554e7`. Стартовый Git blob SHA LATEST для CAS этого прохода: `b18662a6523b4a45531f7eacda208cd16281017d`.
- Свежий PR #6 перед изменением оставался на `a89d4066…`; non-stream OpenCode уже правильно отделяет `QWEN_TOOL_CHECKPOINT_REJECTED` от ошибок Qwen и не штрафует аккаунт за локальный persist failure. Повторно этот слой не переделывался.
- Найден и воспроизведён другой настоящий дефект persisted coding-subagents: если сам coding turn уже успешно завершился (в том числе после `write_file`/`bash`), но `markDone()` не смог долговечно записать результат, общий catch превращал эту локальную ошибку в обычный `failed`. На следующем запуске `failed` автоматически выполнялся повторно, поэтому уже случившийся side effect мог повториться. Дофиксовый offline repro: `QWEN_SUBAGENT_DONE_PERSIST_BUG_REPRO_PASS durable_status=failed duplicate_execution=1`.
- Исправление в `src/subagent-agent-runner.js`: ошибка фиксации уже завершённого результата теперь получает `QWEN_SUBAGENT_RESULT_PERSIST_FAILED`, `uncertain=true` и сохраняется через существующий `markUncertain`. Если даже запись uncertain-состояния не удалась, старый durable `running` остаётся fail-closed и также блокирует автоматический повтор.
- Усилен существующий постоянный regression `scripts/subagent-side-effect-uncertainty-test.js`: добавлен сценарий `write_file -> успешный финал -> transient markDone EIO`. Он требует `uncertain`, отдельный код ошибки и отсутствие второго запуска задачи без `retryUncertain=true`.
- Продуктовые коммиты этого прохода: `42a8da5d0abc9f8d15d2ca02c8b03b3576d3aca5`, затем тестовый `394f048991003df5980aef3e8a2f2121db60ae58`.
- На ChatGPT-hosted машине целевая логика после исправления прошла: `QWEN_SUBAGENT_RESULT_PERSIST_FAIL_CLOSED_PASS uncertain=1 duplicate_execution_blocked=1 original_persist_code=EIO`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions/CircleCI/Cloudflare и живой Qwen намеренно не запускались.

### Предыдущий streaming-result этого же дня

- Локальная ошибка сохранения принятого streaming tool-call (`QWEN_TOOL_CHECKPOINT_REJECTED`) раньше проходила через provider/account observer и ошибочно могла штрафовать здоровый Qwen-аккаунт. Это исправлено в `src/stream-session-guard.js`: local persistence failure теперь отдельный server-side класс, не вызывает provider/account observer, не выпускает удержанный tool-call и reject-ится обратно в route.
- Постоянный regression `scripts/stream-session-local-persist-failure-test.js` проверяет direct + replacement stream, `provider_health_untouched`, fail-closed tool output и сохранение `QWEN_TOOL_CHECKPOINT_REJECTED`.
- Целевой offline результат: `QWEN_STREAM_LOCAL_PERSIST_FAILURE_PASS provider_health_untouched=1 route_reject=1 retry_reject_propagated=1 tool_output_withheld=1`.

### Постоянная память / capsule runtime

- Входной валидный checkpoint: `20260820T210201Z-7d8dcd7309`, archive SHA-256 `ccb644d51a9806b969892e9bfb0bda559b5ae66b049930e1fef28321fe2554e7`, LATEST blob SHA `b18662a6523b4a45531f7eacda208cd16281017d`; PREVIOUS: `20260820T195254Z-3a16acdb61`.
- Невалидные immutable orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` никогда не использовать и не чинить на месте.
- Финальный checkpoint этого прохода должен быть опубликован только по нормативному v4: pack -> verify/restore -> immutable upload -> reread/verify every part + manifest -> reread LATEST -> CAS от стартового blob SHA. При CAS-конфликте новый immutable capsule оставить без принудительной записи указателя.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once: transport error, parser completion/error и поздние parser data не способны повторно завершить response или писать после terminal state.
- Synchronous parser/retry factory failures удерживаются внутри streaming lifecycle; replacement rejection не остаётся unhandled.
- Error observers streaming-пути не способны сорвать штатное закрытие клиентского ответа.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- Новый инвариант: если coding-subagent уже завершился, но его финальный результат не удалось долговечно зафиксировать, задача тоже становится `uncertain` и не исполняется повторно автоматически.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Начать со свежего нормативного QWEN_CORE LATEST и перечитать PR #6 head; не считать `394f0489…` вечным.
2. При первой возможности материализовать exact private tree на ChatGPT-hosted машине и прогнать `scripts/subagent-side-effect-uncertainty-test.js`, `scripts/subagent-batch-resume-test.js`, соседние subagent/session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Проверить следующий локальный boundary: ошибка `markUncertain`/`markRunning` самого batch-store не должна превратить durable state в автоматически повторяемый `failed`; менять код только после воспроизводимого нарушения.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
