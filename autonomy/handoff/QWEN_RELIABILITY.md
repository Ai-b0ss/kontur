# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 10:55 МСК.

Текущая основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head: `b87793e39ba4a03571dafbaad96b099b38742cf1`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, head `53485d253a8f8540824ab36068eaabd3b1716706`.
Старая промежуточная ветка каталога: `autopilot/qwen-auto-skills-catalog-20260820`, head `2e01f249879d46418fd7560e69c3fc094cba1b78`; новую работу вести уже на `...auto-skills-session...`.
`Ai-b0ss/qwen-workspace` PR #5: head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, mergeable=true.

## Что уже есть

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул без причины: бюджет переключений по умолчанию 4, жёсткий потолок 6;
- provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему останавливают дальнейшее прощупывание соседних аккаунтов;
- новые независимые задачи распределяются по давно не использовавшимся аккаунтам, а существующий Qwen-тред сохраняет приоритет своего аккаунта-владельца;
- failover незавершённой цепочки переносит локальную историю в новый Qwen-тред и продолжает tool-loop;
- crash-safe сохранение есть для account state, OpenCode session checkpoint/backup, provider circuit, batch progress и vision cache;
- два режима системного промпта (`engineer`/`owner`), явно выбираемые Skills, последовательные tool-using субагенты и восстановление пачки между перезапусками уже реализованы;
- локальные картинки проверяются по реальному пути после раскрытия symlink/junction, ограничены 8 МБ и сохраняют cache crash-safe;
- Skills понимают стандартный `name/SKILL.md`, `priority`, `user-invocable`, `disable-model-invocation` и `paths:`;
- ChatGPT relay не активная задача до появления owner session; outbox не включать.

## Эта смена

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md` и этот handoff; заново проверены qwen-free-api PR #6 и qwen-workspace PR #5;
- PR #6 с прошлого handoff сдвинулся с `e7d7ca50...` до `b87793e3...` (+3 коммита). Свежие изменения затрагивают только `src/subagent-agent-runner.js` и его тест, поэтому Auto-Skills можно развивать независимо;
- qwen-workspace PR #5 не изменился: `ce51b26c...`, mergeable=true;
- из-за действующего режима без hosted-минут не открыт новый PR и не запускались GitHub Actions/CircleCI вручную;
- создана свежая ветка `autopilot/qwen-auto-skills-session-20260820` прямо от exact `b87793e3...`, чтобы не тащить старую основу;
- на неё перенесён уже подготовленный metadata-only каталог Skills: `qwen-v3-capabilities.prepareInput()` принимает `touchedPaths`, нормализует/дедуплицирует до 256 путей и строит `renderModelSkillCatalog(..., { touchedPaths })`;
- в запрос модели попадают только `name + description`; тело Skill не подгружается автоматически. В owner-режиме приватный owner prompt остаётся главным управляющим текстом;
- восстановлен отдельный тест `scripts/model-skill-catalog-capability-test.js`: path-gated Skill скрыт до совпадения, появляется после подходящего пути, Windows-разделители нормализуются, дубликаты схлопываются, тело Skill не протекает в каталог;
- добавлен новый независимый модуль `src/session-touched-paths.js`: он извлекает пути только из подтверждённой пары `assistant tool_call -> tool result` для `read_file/write_file/edit_file/append_file/list_dir`, не угадывает пути из `bash`, отбрасывает `../`, нормализует Windows-пути, дедуплицирует и держит максимум 256 последних путей;
- ошибочный tool result (`isError`, `ok=false`, `success=false`, JSON error или явный `Error:`) не активирует path-gated Skill;
- добавлен `scripts/session-touched-paths-test.js`, который проверяет успешный read/edit/list, неуспешный write, игнорирование bash, traversal и bounded 256-path memory;
- текущий head подготовительной ветки `53485d253a8f8540824ab36068eaabd3b1716706`;
- новый код пока НЕ подключён к `session-store`/`server.js`, поэтому Auto-Skills ещё не session-scoped и не считается завершённым;
- локальный/hosted Node-прогон в этой смене не запускался из-за действующего ограничения на внешние минуты; PASS новому коду не приписывать;
- provider traffic = 0; аккаунты, encrypted runtime, production и relay не тронуты.

## Что делать следующим запуском

1. Сначала снова проверить PR #6 и свежие коммиты. Если соседний Qwen-рабочий не трогает `session-store`/`server.js`, продолжать Auto-Skills на `autopilot/qwen-auto-skills-session-20260820`.
2. Интегрировать `session-touched-paths` в durable session record: добавить `touchedPaths` в `session-store.set()`, сохранять предыдущий набор, монотонно объединять новые подтверждённые пути и восстанавливать после restart.
3. В `server.js` перед `preparePublicPayloadGoverned()` вычислять `confirmed = collectConfirmedTouchedPaths(effectiveBody.messages)`, объединять с `record.touchedPaths` и передавать в capabilities через `touchedPaths`.
4. Те же merged `touchedPaths` сохранять во всех трёх `sessionStore.set()` путях: обычный non-stream, retry и stream. Не активировать путь по неподтверждённому tool-call.
5. Добавить полный регресс: `успешный file tool -> Skill появился -> следующий ход без нового файла -> Skill остался -> reload session-store -> Skill остался`; отдельно failed file tool не активирует Skill.
6. Только после зелёного этого слоя добавить bounded on-demand загрузку тела ровно выбранного моделью Skill по имени, а не всех Skills сразу.
7. Пока действует режим без hosted-минут — не открывать PR с подготовительной ветки и не запускать внешние CI вручную. Когда исполнение снова разрешено: точечные Node-тесты -> полный `npm test` -> один Windows offline parity, потому что `paths:` затрагивает Windows path semantics.
8. Старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую.
9. После одного доказанного live tool-loop PASS проверить настоящий `restart -> восстановление незавершённой цели -> аккаунт A недоступен -> продолжение через B` с сохранённой tool history.

## Отдельно про qwen-workspace

PR #5 остаётся mergeable на `ce51b26c227b08032301a8574fee4fe2ee9330a3`. Перед любыми изменениями перечитать свежий diff; основная полезная работа сейчас остаётся в `qwen-free-api`.
