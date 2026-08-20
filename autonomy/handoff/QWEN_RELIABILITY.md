# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 11:48 МСК.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, head `b87793e39ba4a03571dafbaad96b099b38742cf1`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, новый head `9671aaa0cb09b9cc1ebccfb21882e61a957a5160`.
Старая промежуточная ветка каталога `autopilot/qwen-auto-skills-catalog-20260820` больше не является рабочей основой.
`Ai-b0ss/qwen-workspace` PR #5: head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

## Что уже есть

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул без причины: bounded failover по соседним подходящим аккаунтам, provider-wide WAF/trust/pressure по-прежнему закрывают дальнейшее прощупывание;
- новые независимые задачи распределяются по давно не использовавшимся аккаунтам, существующий Qwen-тред сохраняет приоритет своего аккаунта-владельца;
- failover незавершённой tool-цепочки переносит локальную историю в новый Qwen-тред и продолжает работу;
- crash-safe сохранение есть для account state, OpenCode session checkpoint/backup, provider circuit, batch progress и vision cache;
- два режима системного промпта (`engineer`/`owner`), явно выбираемые Skills, tool-using субагенты и восстановление пачки между перезапусками уже реализованы;
- Skills понимают `name/SKILL.md`, `priority`, `user-invocable`, `disable-model-invocation` и `paths:`;
- подготовительный Auto-Skills слой уже умеет строить metadata-only каталог по подтверждённым `touchedPaths`, не подгружая тело всех Skills;
- `src/session-touched-paths.js` извлекает пути только из подтверждённой пары `assistant tool_call -> tool result` для `read_file/write_file/edit_file/append_file/list_dir`; `bash`, traversal и явно неуспешные tool-result не активируют навык;
- ChatGPT relay не активная задача до появления нового owner session/регрессии.

## Эта смена

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и свежий PR #6; PR #6 не двигался с `b87793e3...`, поэтому конфликтов с основной Qwen-линией не обнаружено;
- соблюдён ZERO-MINUTE MODE: CircleCI/GitHub Actions не запускались и не перезапускались; provider traffic = 0;
- в подготовительной ветке обнаружен реальный пробел: новые `model-skill-catalog-capability-test.js` и `session-touched-paths-test.js` существовали, но не входили в штатный `npm test`; исправлено коммитом `0ab96ca653f6c8f7507a977c4fdd19dd26b67565`;
- `src/session-store.js` теперь сохраняет `touchedPaths` внутри существующего crash-safe session checkpoint. Новые пути монотонно объединяются со старыми, нормализуются и ограничиваются тем же лимитом 256; после restart запись восстанавливается вместе с остальной сессией. Содержательное изменение начато в `3ea1ffc79894f34d68a78f1a8c020b87a482aff0`, затем лишний комментарийный diff убран коммитом `9671aaa0cb09b9cc1ebccfb21882e61a957a5160`;
- добавлен отдельный регресс `scripts/session-touched-paths-persistence-test.js`: нормализация Windows-пути, отбрасывание traversal, монотонное объединение, запись на диск и восстановление после нового `require()`/перезапуска. Коммит `9ded04556b33662db42c16ce475ff2142a07a0d1`;
- этот регресс включён в штатный `npm test`; пакетный список тестов обновлён коммитом `68a2237f255743c7c7cef3ab289a88a9e6c5a4dc`;
- локально в ChatGPT container на Node `v22.16.0` реально прошли: точный `session-touched-paths-test`, отдельная интеграционная проверка `confirmed file tool -> merge -> JSON persist -> restart -> preserved`, а также проверка durable `session-store` семантики. Получены маркеры `session-touched-paths-test: PASS`, `AUTO_SKILLS_SESSION_INTEGRATION_PASS` и `SESSION_TOUCHED_PATHS_DURABLE_PASS`;
- отдельно выполнен `node --check` для `model-skill-catalog-capability-test.js`; полный проектный `npm test` не запускался, потому что контейнер не имеет сетевого доступа для клонирования/установки всего репозитория;
- проверено, что на подготовительной ветке не появилось GitHub Actions workflow runs: hosted-минуты этими изменениями не расходовались;
- `server.js` намеренно не переписан через GitHub Contents API вслепую: для следующего шага подготовлен bounded candidate patch, который передаёт merged `touchedPaths` во все четыре `preparePublicPayloadGoverned()` пути и сохраняет их во всех трёх `sessionStore.set()` путях.

## Что делать следующим запуском

1. Снова проверить свежий PR #6 и не заходить в файлы, которые параллельно меняет другой Qwen-рабочий.
2. На `autopilot/qwen-auto-skills-session-20260820` аккуратно подключить `server.js`: после `restoreCheckpoint()` вычислить `confirmed = collectConfirmedTouchedPaths(effectiveBody.messages)`, затем `touchedPaths = mergeTouchedPaths(record?.touchedPaths, confirmed)`.
3. Передать `touchedPaths` в каждый `preparePublicPayloadGoverned()` путь: обычный, failover-rebase, non-stream retry и stream retry.
4. Сохранить тот же merged набор во всех трёх `sessionStore.set()` путях: обычный non-stream, retry и stream. Неподтверждённый tool-call путь активировать не должен.
5. После этого добавить полный серверный регресс: успешный file tool -> path-gated Skill появился -> следующий ход без нового файла -> Skill остался -> reload session-store -> Skill остался; failed file tool Skill не активирует.
6. Проверять сначала бесплатным локальным Node в ChatGPT container. Пока действует ZERO-MINUTE MODE, не запускать и не перезапускать CircleCI/GitHub Actions, не делать runner-ветки и не делать push только ради CI.
7. Только после закрытия session-scoped каталога добавлять bounded on-demand загрузку тела ровно выбранного Skill по имени; не затаскивать тела всех Skills в каждый запрос.
8. Старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую. Provider traffic без нового доказанного основания не запускать.
9. После одного доказанного live tool-loop PASS проверить настоящий `restart -> восстановление незавершённой цели -> аккаунт A недоступен -> продолжение через B` с сохранённой tool history.

## Важная граница доказательства

Текущий подготовительный head `9671aaa0...` не объявлять полностью зелёным: локально доказаны pure touched-path extraction и durable session persistence, но настоящий `server.js` wiring ещё не применён, а полный `npm test` на exact head не выполнялся. Hosted CI специально не использовался.
