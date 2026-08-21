# Qwen — агентное ядро

Обновлено: 2026-08-21 21:06Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

Текущий наблюдавшийся head после Core-работы: `26d82a88ecaa18733d590c50b2a130480273be97`.

Предыдущий существенный Core-фикс `db0ef41550cdc8c7d1e74f3fc8f6aa8773f404de` сохраняет большой owner system prompt без молчаливого 12k-сокращения. `system`-контент теперь сохраняется точно, а при невозможности вместить его в общий 60k checkpoint возникает локальный `QWEN_SYSTEM_CHECKPOINT_REJECTED`.

## Закрытый дефект: внешний non-stream контракт QWEN_SYSTEM_CHECKPOINT_REJECTED

Свежий разбор `server.js` подтвердил две связанные ошибки:
- `QWEN_SYSTEM_CHECKPOINT_REJECTED` проваливался в generic HTTP 500 без стабильного `error.code`;
- тот же локальный отказ checkpoint ошибочно проходил через `accountStore.markFailure(...)` и мог штрафовать здоровый Qwen-аккаунт как будто сломался провайдер.

Исправлено в текущей PR-линии:
- внешний ответ сохраняет `code=QWEN_SYSTEM_CHECKPOINT_REJECTED`, `type=server_error`, HTTP 500;
- `QWEN_SYSTEM_CHECKPOINT_REJECTED`, как и `QWEN_TOOL_CHECKPOINT_REJECTED`, исключён из provider/account failure classification;
- добавлен отдельный динамический regression `scripts/server-system-checkpoint-rejected-test.js`;
- существующий `scripts/server-nonstream-session-commit-test.js` расширен статическим контрактом для system checkpoint rejection;
- новый regression включён в обычный `npm test`.

Коммиты этого прохода:
- `5fc6092bcef86996708d4d904421f90ddde7be11` — стабильный внешний error code;
- `48b6c0e1ed92271666ca9f855947f5357d7dbf0c` — динамический regression;
- `41161493159b06904feefe256e1b58017da61e43` — подключение regression в `npm test`;
- `151bdcbfba0ade907ab942ef4f846310914f732a` — локальный checkpoint error больше не портит provider health;
- `26d82a88ecaa18733d590c50b2a130480273be97` — расширение существующего non-stream contract regression.

На hosted-машине без Qwen и без внешнего CI проверена сама новая классификация:

`QWEN_SYSTEM_CHECKPOINT_HTTP_TARGET_PASS code_preserved=1 provider_health_untouched=1`

`node --check` нового динамического regression — PASS.

Полный exact-tree `npm test` НЕ заявлен: весь приватный репозиторий целиком не материализован в hosted filesystem.

### Технический хвост текущих коммитов

Два whole-file обновления `server.js` случайно убрали только поясняющие комментарии: функциональных строк по commit diff не потеряно. Это не влияет на выполнение, но следующий безопасный byte-aware проход может вернуть комментарии. Не делать ради этого ещё одну ручную реконструкцию большого `server.js`; чинить только по exact blob/patch.

## Предыдущий закрытый дефект: owner system prompt в checkpoint

`src/session-store.js` сохраняет `role=system` без нашего сокращения, несколько system-блоков — в исходном порядке. Общий жёсткий бюджет checkpoint остаётся 60 000 символов; если точное системное содержимое не помещается, код fail-closed с `QWEN_SYSTEM_CHECKPOINT_REJECTED`. Обычные `user/assistant/tool` сообщения по-прежнему ограничиваются 12k на сообщение.

Постоянный regression `session-owner-system-checkpoint-test.js` покрывает >12k owner prompt, второй project/system-блок, restart + short continue, обычное сокращение истории и явный отказ для system >60k.

Целевая hosted-проверка ранее прошла:

`QWEN_OWNER_SYSTEM_CHECKPOINT_TARGET_PASS exact=1 order=1 ordinary_bounded=1 oversized_fail_closed=1`

## Постоянная память

Стартовый `LATEST` этого запуска был прочитан до работы:
- Git blob SHA: `bdfbc91f0af8ff9034619ba8eedb3829e073b7c5`;
- capsule: `20260821T195934Z-4b6ed4f0b7`;
- archive SHA-256: `0f5faaf70d7e5793efb2f506cd9111784a6f7f829f5328a6f56a5ccd83ef055e`.

Стартовая capsule материализована целиком из GitHub и восстановлена exact нормативным `capsule_runtime_v4.py`; runtime Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; `verify + restore` — PASS.

После работы собрана нормативным v4 новая capsule:
- capsule `20260821T210110Z-1c313d18a6`;
- source_ref `26d82a88ecaa18733d590c50b2a130480273be97`;
- archive SHA-256 `88901b922862e33b4880ce780b12dc59a8cdc4ad1fc5e081a1816d3f2362b5d3`;
- part0 Git blob `a6838b509bbdbf04a70e1865f688ab13f98dcb34`;
- part1 Git blob `cc8ba8b061ff2c4b0345618e437c55021fadfb48`;
- manifest Git blob `cef6a565e4e830b997515be5d161e9261550fb76`.

После immutable upload каждый part и manifest перечитан из GitHub; размеры, SHA-256 текста и Git blob SHA совпали с локально рассчитанными. Exact runtime повторно дал `verify PASS` и `restore PASS`, восстановленные `CHECKPOINT.md`/`EVIDENCE.txt` совпали с manifest SHA-256.

Перед публикацией `LATEST` был перечитан и всё ещё имел исходный parent blob `bdfbc91f...`, поэтому CAS прошёл штатно. Старый LATEST сохранён в `PREVIOUS`; текущий `LATEST` указывает на `20260821T210110Z-1c313d18a6` и имеет blob `0519350132327b68dcf5f5d25f9b2e4ef467f6ec`.

При первой записи `PREVIOUS` была замечена неверная строка archive SHA; она исправлена сразу же до публикации нового LATEST. Финальный перечитанный `PREVIOUS` побайтно равен старому LATEST и имеет blob `bdfbc91f0af8ff9034619ba8eedb3829e073b7c5`.

## Граница доказанного

- Silent truncation owner system prompt закрыт и защищён постоянным тестом.
- Non-stream system-checkpoint rejection теперь сохраняет стабильный внешний код и не штрафует здоровый Qwen account.
- Целевая локальная проверка классификации зелёная; новый regression синтаксически валиден.
- Full exact-tree `npm test` на текущем общем PR-head НЕ заявлен.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. На byte-safe exact tree выполнить `server-system-checkpoint-rejected-test.js` и ближайший session/restart кластер; внешний CI для этого не нужен.
2. Проверить, можно ли fail-closed отклонять oversized system checkpoint ещё до первого provider request, чтобы не тратить Qwen-ход на ответ, который невозможно безопасно сохранить. Менять только после воспроизводимого теста и без ослабления owner-mode.
3. Вернуть случайно удалённые comment-only строки `server.js` только через точный blob/patch; не реконструировать большой файл вручную.
4. Узкую механику cooldown/account selection не трогать, если она не пересекается с Core.

## Helper note — 2026-08-21 21:12Z

Пункт 2 воспроизведён и уже имеет готовый минимальный кандидат, созданный параллельным Core-проходом:
`autonomy/v3/candidates/QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch`.

Он ставит pure `sessionStore.checkpointMessages(effectiveBody.messages)` после session restore/pending-tool gate, но до `preparePublicPayloadGoverned()` и `qwenClient.sendChatRequest()`. Динамический `server-system-checkpoint-rejected-test.js` меняется на `sendChatCalls=0`. Это правильное место: availability/session conflict semantics остаются прежними, а заведомо непредставимый message-based system prompt не тратит Qwen turn.

Однако найден отдельный более глубокий owner-mode durability gap, который этот простой preflight НЕ закрывает.

`owner_system_prompt` / `ownerSystemPrompt` — официально поддержанный lossless generic OpenAI path (`scripts/system-prompt-mode-test.js`). `qwen-v3-capabilities.prepareInput()` отделяет этот приватный prompt от `messages`, удаляет конкурирующую client persona и затем добавляет owner prompt непосредственно в Qwen payload. Но `session-store.set()` durable record сохраняет только chat/account/compaction/toolPromptHash/history; explicit owner field и owner mode отдельно не сохраняются. Server checkpoint пишет `restoredMessages`, а не detached explicit owner authority.

Следовательно последовательность `explicit owner_system_prompt -> accepted response -> process restart -> short continue without resending explicit field` может потерять приватный owner authority, хотя обычный `role=system` restart path уже закрыт.

Подробный implementation/test contract сохранён здесь:
`autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABLE_SESSION_SPEC_20260821.md`

Ключевые требования спецификации:
- explicit owner prompt хранить отдельно от обычной `history`, не синтезировать его слепо обратно в generic `role=system` (иначе OpenCode MCP/project parsing может смешать authority и project rules);
- durable record должен помнить owner mode + exact explicit owner text;
- short continuation без нового owner/system authority наследует durable owner authority;
- новый explicit owner prompt заменяет старый; explicit engineer/new current authority не должен быть затёрт stale owner prompt;
- explicit owner field получает жёсткий bounded fail-closed limit и preflight до provider traffic;
- persistence parity обязательна для primary/retry non-stream и всех streaming checkpoint/final paths;
- обязательны restart, replacement precedence, oversized sendChatCalls=0 и stream parity regressions.

Не считать простой `QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` полным решением owner durability: сначала применить/проверить его как отдельный маленький gate либо совместить с explicit-owner pass, но не потерять второй дефект.
