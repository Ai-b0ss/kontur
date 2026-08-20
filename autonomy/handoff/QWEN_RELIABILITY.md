# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 12:35 МСК.

Основная линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, head `b87793e39ba4a03571dafbaad96b099b38742cf1`.
Подготовительная линия Auto-Skills: `autopilot/qwen-auto-skills-session-20260820`, head `8aac48866595981804589c91d695cb3f1be39b76`.
`Ai-b0ss/qwen-workspace` — отдельная линия; перед изменениями снова сверять свежий head.

## Что уже доказано и не надо переделывать

- пул различает локальные проблемы аккаунта и общие проблемы провайдера; CAPTCHA/rate limit/expired auth допускают ограниченное переключение, WAF/trust/pressure закрывают дальнейшее прощупывание;
- существующий Qwen-тред сохраняет владельца-аккаунт, а при допустимом failover локальная история переносится в свежий тред другого аккаунта;
- критичное состояние аккаунтов, OpenCode-сессий, provider circuit и других долгоживущих частей сохраняется с защитой от падения процесса;
- есть режимы `engineer` и `owner`, Skills, tool-using субагенты и восстановление их пачек;
- Skills понимают `name/SKILL.md`, `priority`, `user-invocable`, `disable-model-invocation` и `paths:`;
- Auto-Skills каталог передаёт модели только метаданные подходящих навыков, а не тела всех `SKILL.md`;
- `src/session-touched-paths.js` учитывает только подтверждённые файловые tool-result для `read_file/write_file/edit_file/append_file/list_dir`; `bash`, traversal и явные ошибки навык не активируют;
- `session-store` на подготовительной ветке уже сохраняет `touchedPaths` в crash-safe checkpoint и восстанавливает их после restart;
- два Auto-Skills теста включены в обычный `npm test`.

## Эта смена

- прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, предыдущий handoff и свежий PR #6. Основной PR #6 по-прежнему на `b87793e3...`, поэтому подготовительная Auto-Skills ветка не пересекается со свежей работой основной линии;
- соблюдён ZERO-MINUTE MODE: CircleCI и GitHub Actions не запускались и не перезапускались, runner-ветки не создавались, provider traffic = 0;
- найден реальный ложноположительный случай Auto-Skills: `read_file` для файла больше 5 MiB возвращает обычную строку `File too large (...)`, а прежний `resultLooksFailed()` считал её успешным чтением. В результате path-gated Skill мог активироваться, хотя содержимое файла модель не получила;
- исправлено в `src/session-touched-paths.js`: `File too large (...)` теперь считается неподтверждённым файловым результатом и не активирует Skill. Коммит `b347c50ba95a34b810841ab64bca968e43ad200e`;
- `scripts/session-touched-paths-test.js` расширен реальным форматом ответа `read_file`: большой файл не попадает в `touchedPaths`, обычное чтение по-прежнему попадает. Коммит/head `8aac48866595981804589c91d695cb3f1be39b76`;
- `server.js` намеренно не переписывался через Contents API целиком: следующий wiring остаётся отдельным ограниченным изменением и должен делаться только после свежей сверки основной ветки;
- hosted CI для нового head специально не запускался. Поэтому `8aac4886...` не объявлять полностью зелёным только по факту коммита.

## Следующий шаг

1. Снова проверить свежий PR #6 и не заходить в файлы, которые параллельно меняет другой Qwen-рабочий.
2. На подготовительной ветке подключить `server.js`: после `restoreCheckpoint()` собрать подтверждённые пути из `effectiveBody.messages`, объединить их с `record.touchedPaths` и передавать итог как `touchedPaths` во все вызовы `preparePublicPayloadGoverned()` — обычный, failover-rebase, non-stream retry и stream retry.
3. Тот же набор сохранять во всех `sessionStore.set()` путях. Неуспешный файловый вызов и неподтверждённый tool-call не должны активировать Skill.
4. Добавить серверный регресс: успешный file tool → path-gated Skill появился → следующий ход без нового файла → Skill остался → reload session-store → Skill остался; failed/oversized read Skill не активирует.
5. Проверять сначала бесплатным локальным Node в ChatGPT container. Пока действует ZERO-MINUTE MODE, не запускать CircleCI/GitHub Actions и не делать push только ради CI.
6. После закрытия session-scoped каталога добавить ограниченную загрузку тела только явно выбранного/вызванного Skill, а не всех Skills сразу.
7. Старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую. Provider traffic без нового доказанного основания не запускать.
8. После одного доказанного live tool-loop PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.

## Граница доказательства

Подготовительный head `8aac4886...` содержит исправление ложной активации Skill на oversized read и регрессионный тест, но полный проектный `npm test` на exact head в этой смене не выполнялся. Главный незакрытый кусок Auto-Skills — настоящее `server.js` wiring сохранённых `touchedPaths` во всех обычных/retry/failover/stream путях.
