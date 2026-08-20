# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — исправлена идентичность persistent segment; exact server.py wiring остаётся следующим крупным шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 в этом проходе не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `a0f4c4082e9ef356522d441eb7b3172a3f5fdd47`.

### Фактическое состояние

- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; прямую полную замену огромного файла не делали;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact blob `f02cef...` и содержит пять подготовленных преобразований: ранний startup `BaseException` cleanup; owner-mode не запускает extractor Codex `instructions` в planner и metric/token path; stale affinity больше не считается владением foreground reservation; multi-account routing использует `wait_for_turn_route(..., owner_turn_key=turn_key)`;
- single-slot path уже ждёт чужую foreground reservation до захвата общего inference gate, а owner continuation освобождается по своему `turn_key`, поэтому не создаётся тупик;
- lifecycle rebind/unbind cancellation-safe; старое поколение не закрывается, пока его child ещё работает; peer failure в batch delegation не отменяет независимого sibling, который мог уже войти в локальный write/shell;
- delegated failover сохраняет локальную историю и результаты уже выполненных инструментов; новый provider client создаёт новый Notion thread и не получает старый thread другого аккаунта;
- subagents остаются выключены по умолчанию; живой provider traffic не запускался.

### Новый найденный и исправленный дефект

Аудит показал разрыв между response-cache identity и persistent `ConversationSegment` identity. `turn_affinity.response_input_fingerprint()` уже учитывал инженерные `instructions`, `tools`, `tool_choice` и `text`, но `conversation_segments.response_input_fingerprints()` раньше связывал persistent Notion thread только с input items + prompt-policy fingerprint.

Это было опасно, потому что incremental continuation отправляет в старый Notion thread только delta input и убирает `tools`. При изменении инженерного контекста, каталога инструментов или structured-output контракта система могла продолжить старый thread, созданный под предыдущим planner contract.

Исправлено:
- `payload/conversation_segments.py` теперь смешивает в каждый per-input SHA-256: `bridge_prompt_policy`, инженерные `instructions` только в `engineer`-режиме, `tools`, `tool_choice`, `text` и сам input item;
- в `owner`-режиме конкурирующие Codex `instructions` по-прежнему полностью исключены из segment identity;
- добавлены регрессии: смена engineer instructions, tool catalog и structured-output contract обязана давать segment rollover; смена проигнорированных owner-mode Codex instructions rollover не вызывает.

Коммиты этого прохода в PR #8:
- `4374a84e814529b08a13d8b69f32a9782cad474d` — первая фиксация engineer instructions в persistent identity;
- `c03c1a2db478885c264d7f07f20151fb939f42e2` — первая регрессия;
- `52c0eb43fcb450f7ee843287732c66c1a36fb03f` — полный planner-contract identity (`tools/tool_choice/text`);
- `a0f4c4082e9ef356522d441eb7b3172a3f5fdd47` — расширенные регрессии.

Локальный семантический probe на exact новой логике: PASS для engineer-instructions rollover, tool-catalog rollover, structured-output rollover и owner-instructions-ignore.

CircleCI/GitHub Actions/Cloudflare/production не использовались.

### Постоянная память v4

- в начале запуска `LATEST.json` прочитан с exact parent blob `42c74bb6b9a985e3a5372149a0cd84c0c0feaf61`;
- capsule `20260820T190441Z-3eb216d577` восстановлена и полностью проверена по v4-инвариантам: part length/SHA, archive size/SHA и exact workspace inventory совпали; archive SHA-256 `e6a9ad7101e887fc03fdab6f3b1bfce5a39516fc1b4a83ac05549463c04c196d`;
- после продуктовой работы упакована и локально verify/restore PASS новая capsule `20260820T193511Z-6967dc082e`, archive SHA-256 `2dc30d948a7649db8cef8b333ae2261b4180c5dbd80faa3642417199c0e10c0d`;
- immutable manifest и part загружены в GitHub и перечитаны: Git blob SHA совпали с локальными (`manifest=1c89d17c...`, `part=1603f57f...`), part text SHA-256 `9f37f2e0...` совпал с manifest;
- перед публикацией `LATEST` был перечитан и сохранил исходный parent blob `42c74bb...`, поэтому CAS разрешён; старый LATEST сохранён как PREVIOUS, новый LATEST опубликован через `update_file` без force-write;
- новый `LATEST` content blob: `92ecb7aba999cab3e720c0ce5d942b17dd519724`.

### Следующий шаг

1. Получить полные exact bytes `payload/server.py` blob `f02cef...` lossless-способом и локально повторно проверить Git blob SHA.
2. Применить текущий `apply_startup_status_cleanup.py`; он обязан увидеть exact `f02cef...` и все пять preimage-фрагментов ровно по одному разу.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, prompt-mode/identity, foreground routing, delegation, delegated tool-loop, failover и lifecycle tests. В этот набор обязательно входит новая persistent-segment identity регрессия.
4. Только после lossless PASS заменить `payload/server.py` и сравнить exact diff: разрешены только пять подготовленных узких изменений; никаких посторонних удалений/переформатирования.
5. После крепкого локального PASS — один bounded живой Codex project run; затем two-slot run; затем A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
6. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
