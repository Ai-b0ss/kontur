# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `87ae1c6af2440f92ff054de894e1e12535787dbd`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- Добавлен `scripts/stream-session-restart-integration-test.js` и включён в `npm test`. Он связывает настоящий `src/stream-session-guard.js` с `src/session-store.js` и фиксирует обязательную цепочку: streaming tool-call сохраняется до первого client output → pending переживает reload/restart → короткий `continue` не перескакивает через него → только matching `role=tool` снимает pending. Коммиты `c34cf0be…` и `955bbdcd…`.
- Проверен риск общего `toolParser` при `retryEmpty`: нормальный unusable-stream перед retry проходит через `toolParser.flush()`, который очищает незакрытый XML state. Добавлен постоянный regression в `scripts/tool-stream-truncation-test.js`: один parser переиспользуется между rejected partial primary stream и свежим replacement; stale `bash` не должен примешаться к новому `read_file`. Коммит `59edb23a…`.
- Исправлен реальный error-path defect в `src/stream-session-guard.js`: исключение из `opts.onError` раньше могло вылететь до `res.end()/resolve()` и оставить клиентский поток незавершённым. Observer теперь изолирован; исходная upstream/persist ошибка всё равно штатно закрывает response. Коммит `fe4b8e0d…`.
- `scripts/stream-session-guard-test.js` дополнен сценарием с падающим `onError`; локально целевая логика дала `QWEN_STREAM_ERROR_OBSERVER_ISOLATION_PASS`. Коммит `df34d969…`.
- Добавлен regression нескольких одновременно pending tool calls: если из двух принятых вызовов пришёл результат только одного, снимается только его `tool_call_id`; второй остаётся pending после reload, и короткое продолжение остаётся fail-closed до его собственного результата. Коммит `87ae1c6a…`.
- Во время работы соседний reliability-writer изменял `server.js`; перед Core-записями head перечитывался, его account-selection изменения сохранены и не откатывались.
- Полный exact-tree `npm test` в этом проходе **не заявлен**: приватное дерево целиком на hosted-машине пока не материализовано. Доказанная граница — exact GitHub readback изменённых файлов, локальные целевые проверки и синтаксическая проверка нового restart integration test.

### Постоянная память / capsule runtime

- В начале прохода LATEST blob SHA был `2a8fe1c5827e36ecbea4591af6a49a1d9b9a21a8`. Валидная v4 capsule `20260820T175327Z-578be7c1a9` восстановлена нормативным `capsule_runtime_v4.py`; сам runtime был побайтно сверён по Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.
- Во время публикации две промежуточные immutable capsule получили ошибочные байты при ручной передаче connector-аргумента и оставлены как orphan: `20260820T185657Z-a15bcde178` и `20260820T190401Z-9dcd764069`. **Никогда не использовать их как LATEST/PREVIOUS, не исправлять на месте.**
- Валидный промежуточный checkpoint `20260820T185926Z-c7ebb68b42` был корректно `pack → verify → restore`, побайтно перечитан после upload и опубликован CAS; теперь он сохранён как PREVIOUS.
- Финальный checkpoint этого прохода: `20260820T190618Z-536e143ece`, source ref `87ae1c6a…`, archive SHA-256 `8236d9bed52849f3bb4c00f419f1ea78047b76078fd5da7a9adc00a4252fd9b4`.
- Финальная capsule создана нормативным v4 и локально прошла `verify + restore`. Все четыре uploaded part и manifest перечитаны обратно; Git blob SHA совпали с локальными байтами: `part-0000` → `2d849aa59b6f57ebec511c37a383ba11389004bc`, `part-0001` → `9cf13bf6551e4d09957d56416e18213a78e6d9a4`, `part-0002` → `b14bd9ea315a7c71e2764807456d5094943d386d`, `part-0003` → `c45f9b29c3d9a1e1c8a38a2f6d8d6df91ea64c8b`, manifest → `be19a7be1a792c6455f609a245d9f7307217a612`.
- Перед финальным CAS LATEST был перечитан и всё ещё указывал на наш предыдущий валидный checkpoint с blob SHA `b8926d1896b867cb05ff0b4f4b4db2628bfdcdfd`. Он сохранён как PREVIOUS, затем финальный LATEST опубликован именно с этим parent SHA.
- Текущий LATEST: `20260820T190618Z-536e143ece`, blob SHA `0ed1ca549a264ecf0d1cec765e921dcd1849070e`.
- Текущий PREVIOUS: `20260820T185926Z-c7ebb68b42`, blob SHA `b8926d1896b867cb05ff0b4f4b4db2628bfdcdfd`.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; persist failure работает fail-closed.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Error observers streaming-пути не способны сорвать штатное закрытие клиентского ответа.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Следующий запуск начинает с LATEST `20260820T190618Z-536e143ece`, восстанавливает его нормативным v4 и перечитывает свежий PR #6 head.
2. Попытаться материализовать достаточный exact private tree на ChatGPT-hosted машине и реально выполнить `stream-session-restart-integration-test`, `stream-session-guard-test`, `tool-stream-truncation-test`, `session-pending-tool-call-restart-test`; если получится полное дерево — полный `npm test` без внешнего CI/provider traffic.
3. Следующий неразобранный Core-риск: двойной error/completion lifecycle, когда upstream `error` event и parser `onDone(error)` приходят рядом. Сначала воспроизводимый offline regression; код менять только если доказана двойная выдача/двойное завершение или зависание.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
