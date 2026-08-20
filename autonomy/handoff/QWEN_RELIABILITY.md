# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 09:34 МСК.

Текущая основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head: `e7d7ca50d1bb3737d73b6e46821b5548d7b439c0`.
Отдельная подготовительная ветка этой смены: `autopilot/qwen-auto-skills-catalog-20260820`, head `2e01f249879d46418fd7560e69c3fc094cba1b78`.
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

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md` и этот handoff; заново проверены PR #6 и qwen-workspace PR #5;
- PR #6 с прошлого handoff сдвинулся с `64c91058...` до `e7d7ca50...` (+6 коммитов). Свежая волна меняла только `src/session-store.js`, его тесты и `package.json`, поэтому `session-store` в этой смене не редактировался параллельно;
- подтверждено, что основной Qwen CircleCI на рабочей ветке запускает три обычных офлайн-job на каждый push, а GitHub Actions запускается на PR/main. Zero-minute режим владельца всё ещё считается действующим;
- чтобы не тратить hosted minutes и не конфликтовать с активной `session-store` линией, создана отдельная ветка без PR и без CircleCI branch-filter: `autopilot/qwen-auto-skills-catalog-20260820` от exact `e7d7ca50...`;
- на этой ветке реализован независимый слой Auto-Skills catalog: `qwen-v3-capabilities.prepareInput()` теперь умеет принимать уже подтверждённые `touchedPaths`, нормализует/дедуплицирует их, ограничивает 256 путями и строит `renderModelSkillCatalog(..., { touchedPaths })`;
- в модель добавляется только метаданный каталог `name + description`; тела Skills не подгружаются автоматически. Явно выбранные Skills продолжают работать по старому контракту;
- каталог добавляется как технический контекст до применения режима системного промпта, поэтому в `owner`-режиме приватный owner prompt остаётся первым управляющим текстом и не смешивается с инженерной персоной;
- добавлен отдельный регресс `scripts/model-skill-catalog-capability-test.js`: path-gated Skill скрыт без совпадения, появляется после `src/**/*.js`, Windows-разделители нормализуются, дубликаты путей схлопываются, тело Skill не попадает в каталог, owner prompt остаётся ведущим;
- новый тест включён в обычный `npm test` на подготовительной ветке;
- diff подготовительной ветки ограничен тремя файлами: `src/qwen-v3-capabilities.js`, новый тест и одна строка `package.json`;
- head подготовительной ветки `2e01f249879d46418fd7560e69c3fc094cba1b78`; от основного head она ahead на 3 коммита, без посторонних файлов;
- для `2e01f249...` нет GitHub status contexts и нет GitHub Actions workflow runs — то есть подготовительный push не потратил GitHub Actions. CircleCI branch-filter также не включает эту ветку;
- локально прогнать Node-тесты через контейнер не удалось: окружение этого запуска не имеет DNS-доступа к GitHub, а запуск hosted CI запрещён текущим режимом. Поэтому PASS для нового кода не приписывать до реального исполнителя;
- provider traffic = 0; аккаунты, encrypted runtime, production и relay не тронуты.

## Что делать следующим запуском

1. Сначала снова проверить текущий head PR #6 и свежие файлы. `session-store` не трогать, если соседний Qwen-рабочий продолжает эту линию.
2. Проверить, снят ли zero-minute режим. Пока он действует — не открывать PR для `autopilot/qwen-auto-skills-catalog-20260820`, не переносить её на основную CircleCI-filtered ветку и не запускать hosted CI вручную.
3. Когда исполнение снова разрешено, сначала перенести/ребейзнуть маленький diff Auto-Skills catalog на свежий PR #6 head и прогнать `node scripts/model-skill-catalog-capability-test.js`, затем полный `npm test`.
4. Следующий продуктовый кусок после зелёного теста — session-scoped `touchedPaths`: bounded монотонное множество до 256 относительных путей, crash-safe сохраняемое вместе с сессией и восстанавливаемое после restart.
5. Активировать путь только после подтверждённого успешного файлового действия. Не считать `bash` надёжным источником путей и не активировать Skill по неподтверждённому tool-call.
6. Для OpenCode/OpenAI пути брать подтверждённые пути из пары сохранённый assistant tool-call + успешный tool-result; упавшая файловая операция Skill не активирует.
7. Регресс для полной цепочки: `файл успешно затронут → path-gated Skill появился → следующий ход без нового файла → Skill остался → restart → Skill всё ещё активен`; отдельно проверить отрицательный случай failed tool-call.
8. После этого добавить bounded on-demand загрузку тела ровно выбранного моделью Skill по имени, не всех Skills сразу.
9. Старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую.
10. Когда hosted/free runner снова разрешён: полный offline `npm test` на exact head, затем один bounded Windows parity, потому что `paths:` и vision затрагивают Windows path/junction semantics.
11. После одного доказанного live tool-loop PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.

## Отдельно про qwen-workspace

PR #5 остаётся mergeable на `ce51b26c227b08032301a8574fee4fe2ee9330a3`. Перед любыми изменениями перечитать свежий diff; сейчас основная полезная работа остаётся в `qwen-free-api`.
