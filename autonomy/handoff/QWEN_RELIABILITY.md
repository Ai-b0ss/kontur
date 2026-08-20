# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 08:34 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head: `64c910584186140346e56029f0e3de36b63f3a78`.
`Ai-b0ss/qwen-workspace` PR #5: head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, mergeable=true.

## Что уже есть

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул без причины: бюджет переключений по умолчанию 4, жёсткий потолок 6;
- provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему останавливают дальнейшее прощупывание соседних аккаунтов;
- новые независимые задачи распределяются по давно не использовавшимся аккаунтам, а существующий Qwen-тред сохраняет приоритет своего аккаунта-владельца;
- failover незавершённой цепочки переносит локальную историю в новый Qwen-тред и продолжает tool-loop;
- crash-safe сохранение есть для account state, OpenCode session checkpoint/backup, provider circuit, batch progress и vision cache;
- два режима системного промпта (`engineer`/`owner`), явно выбираемые Skills, последовательные tool-using субагенты и восстановление пачки между перезапусками уже реализованы;
- локальные картинки проверяются по реальному пути после раскрытия symlink/junction, ограничены 8 МБ и сохраняют cache crash-safe;
- Skills понимают стандартный `name/SKILL.md`, `priority`, `user-invocable`, `disable-model-invocation` и `paths:`; path-gated Skill уже можно фильтровать по `touchedPaths`, но реальная сессия пока не накапливает этот набор;
- ChatGPT relay не активная задача до появления owner session; outbox не включать.

## Эта смена

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff; перепроверены текущие PR обоих Qwen-репозиториев;
- PR #6 снова заметно сдвинулся: с `5121e4ba...` до `64c91058...` (+15 коммитов). Свежая волна меняла `src/agent.js`, `src/subagent-agent-runner.js`, `src/subagent-batch-store.js`, их тесты и `package.json`; эти файлы сейчас не брать параллельно;
- `qwen-workspace` PR #5 остаётся на `ce51b26c...`, mergeable=true;
- перепроверены актуальные `src/session-store.js`, `src/skills.js`, `src/qwen-v3-capabilities.js` и серверный OpenAI/OpenCode путь;
- подтверждено, что `session-store` по-прежнему не хранит `touchedPaths`: запись сессии содержит chat/account/toolPrompt/history, а `skills.js` уже умеет принимать `renderModelSkillCatalog(..., { touchedPaths })`;
- подтверждена точная точка подключения для OpenAI/OpenCode: `server.js` получает `record = sessionStore.getRecord(sessionKey)` до `preparePublicPayloadGoverned(...)`, поэтому накопленные пути можно передавать в capability-слой без изменения внешнего протокола;
- `qwen-v3-capabilities.prepareInput()` сейчас загружает только явно выбранные Skills; каталог доступных model-invocable Skills пока вообще не добавляется в контекст запроса. Поэтому следующий патч должен одновременно провести session-scoped `touchedPaths` и реально подключить метаданный каталог, иначе `paths:` останется мёртвой основой;
- безопасная схема патча зафиксирована: bounded монотонное множество (до 256 нормализованных относительных путей), сохраняется в record; путь добавляется только после подтверждённого файлового tool-call, не из произвольного `bash`; после restart набор восстанавливается; однажды активированный path-gated Skill остаётся доступным до конца этой сессии;
- для OpenCode/OpenAI пути источником подтверждённых путей должны быть сохранённые assistant `tool_calls` файловых инструментов + успешные tool-results из checkpoint, а не неподтверждённые аргументы будущего вызова; это предотвращает активацию Skill после упавшей файловой операции;
- свежий head `64c91058...` пока не имеет доступных GitHub status contexts; ручной hosted CI не запускался;
- текущий zero-minute режим владельца всё ещё считается действующим: продуктовый push в `qwen-free-api`, который заведомо запустит hosted CI, не делался. Provider traffic = 0; аккаунты, encrypted runtime, production и relay не тронуты;
- вместо запрещённого продуктового push обновлён этот control-handoff с актуальным head и уже готовой точкой внедрения.

## Что делать следующим запуском

1. Сначала проверить, снят ли zero-minute режим. Пока он действует — никаких hosted CI/manual rerun и никаких Qwen-product push, которые заведомо запускают hosted CI.
2. Снова проверить свежий head PR #6. Не редактировать `src/agent.js` / subagent-файлы, если соседний Qwen-рабочий продолжает ту же линию.
3. Когда product push снова разрешён, реализовать `touchedPaths` в независимых `session-store` + capability/server участках: нормализация, дедупликация, максимум 256, crash-safe persistence и восстановление.
4. Активировать путь только после успешного файлового действия. Не считать `bash` надёжным источником путей и не активировать Skill по одному лишь неподтверждённому tool-call.
5. Передавать накопленный набор в `renderModelSkillCatalog(..., { touchedPaths })` и добавлять только метаданный каталог `name + description`; тела всех Skills не грузить.
6. Добавить регресс: `файл успешно затронут → path-gated Skill появился → следующий ход без нового файла → Skill остался → restart → Skill всё ещё активен`; отдельно проверить, что упавший файловый tool-call Skill не активирует.
7. После этого добавить bounded on-demand загрузку ровно выбранного Skill по имени, а не всех тел сразу.
8. Старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую.
9. Когда hosted/free runner снова разрешён: полный offline `npm test` на exact head, затем один bounded Windows parity, потому что `paths:` и vision затрагивают Windows path/junction semantics.
10. После одного доказанного live tool-loop PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.

## Отдельно про qwen-workspace

PR #5 остаётся mergeable на `ce51b26c227b08032301a8574fee4fe2ee9330a3`. Перед любыми изменениями перечитать свежий diff; сейчас основная полезная работа остаётся в `qwen-free-api`.
