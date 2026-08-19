# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19 19:38 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head: `38a4a827b46b434b7768b706a3979164231a36ed`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

## Что уже есть и сохраняется

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул: бюджет переключений задаётся `QWEN_ACCOUNT_FAILOVER_BUDGET`, по умолчанию 4, жёсткий потолок 6;
- provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему останавливают дальнейшее прощупывание соседних аккаунтов;
- tool-loop хранит связь `chatId` с аккаунтом-владельцем; при смене аккаунта создаётся свежий Qwen-тред и один раз переносится полная локальная история;
- агент продолжает после tool result и после ошибок инструмента; обычный лимит — 12 модельных ходов, жёсткий потолок — 24;
- два режима системного промпта (`engineer`/`owner`) уже есть;
- runtime/profile recovery не передаёт GPG-ключ через argv и не печатает секреты;
- `provider-circuit.json`, account JSON, основной session checkpoint и его backup сохраняются crash-safe;
- ChatGPT relay не считать активной задачей до появления owner session или явного owner-запроса; outbox не включать.

## Skills

- `src/skills.js` загружает только явно выбранные Markdown-skills из `QWEN_SKILLS_DIR` (по умолчанию `<repo>/skills`);
- выбор принимается через `skills`, `skill_names` или `skillNames`, служебные поля удаляются до upstream;
- максимум 8 skills, до 12 000 символов каждый и до 32 000 суммарно; traversal и symlink-выход запрещены;
- в owner-режиме приватный системный промпт остаётся главным, skill-контекст добавляется отдельно и не подмешивает `ENGINEER_BASE_PROMPT`;
- штатные skills: `debug-repair` и `windows-parity`;
- `listAvailableSkills()` выдаёт безопасный каталог допустимых `.md`; `node scripts/list-skills.js` печатает его как JSON.

## Что произошло после предыдущей смены

- PR #6 ушёл вперёд на три коммита: `04c0ad67... -> 38a4a827...`;
- два содержательных изменения другого Qwen-рабочего попали ровно в `src/session-store.js` и `scripts/session-store-restart-test.js`, поэтому эту область параллельно не переписывать;
- persistence checkpoint теперь транзакционнее: recovery-copy фиксируется первой, primary — последней; при ошибке финального primary commit мутация откатывается и в памяти, а при restart источником истины остаётся последний целый primary;
- тест теперь отдельно инъецирует ошибку финального `rename` и проверяет, что не возникает ложного успешного состояния, после следующей успешной записи primary и backup снова сходятся;
- третий свежий коммит меняет только CircleCI/Kontur QA и не является изменением Qwen-продукта;
- `qwen-workspace` PR #5 перепроверен: head прежний `468733b2...`, mergeable=true;
- provider traffic = 0; живые аккаунты, encrypted runtime, production и relay outbox не тронуты.

## Важное наблюдение по пулу

`account-store.candidates()` сейчас ставит `activeId` первым, пока он доступен. Это означает, что новые независимые операции могут продолжать нагружать последний успешный аккаунт вместо LRU-распределения, хотя thread-affinity уже передаётся отдельно через `preferredAccount`. Это потенциально мешает пулу равномерно расходовать allowance. Не менять вслепую: сначала добавить офлайн-контракт, который различает (а) продолжение существующего треда — preferred account должен остаться первым; (б) новую независимую операцию — допустимо выбирать наименее недавно использованный аккаунт. После доказательства изменить только порядок кандидатов, не трогая cooldown/provider circuit.

## Проверки и ограничения

- старый Windows PASS остаётся полезным, но exact head `38a4a827...` содержит свежую session-store транзакционность; перед объявлением Windows-паритета нужен один bounded offline Windows run на нынешнем продуктовом состоянии;
- обычный `npm test` уже включает `session-store-restart-test.js`; PASS для exact `38a4a827...` не придумывать без фактического CircleCI результата;
- GitHub Actions minutes не использовать как обычный compute;
- старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` по-прежнему не дублировать вслепую.

## Что дальше

1. Снять фактический обычный CircleCI для exact текущего Qwen head; если зелёный — один bounded Windows offline parity из-за свежей session-store транзакционности.
2. Независимо добавить офлайн-тест политики выбора аккаунта: новый независимый запрос не должен бессрочно прилипать к active account, а continuation с `preferredAccount` обязан сохранять affinity. Только после красного теста делать минимальную LRU-правку.
3. Установить судьбу старого live-trigger `4de8bdae...`; если доказано, что он не состоялся, выполнить ровно один bounded live `read_file → tool result → следующий модельный ход → bash → tool result → final`.
4. После live PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.
5. После стабилизации Skills/prompt-линии — безопасный API-каталог skills, затем bounded subagents; после них web-search, большие документы и мультимодальность.
