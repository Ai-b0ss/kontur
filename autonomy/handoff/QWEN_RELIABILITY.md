# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19 20:35 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head после этой смены: `473cec3478d9178510f58ca090cb54cd8a5b03f1`.
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

## Что сделано в этой смене

- перед записью заново проверены PR #6 и свежий head `10de5086...`: другой Qwen-рабочий менял только `scripts/session-store-restart-test.js`, поэтому участок пула не пересекался;
- исправлена политика выбора аккаунта для НОВОЙ независимой операции: `account-store.candidates()` больше не ставит `activeId` первым, а сортирует все доступные аккаунты по `lastUsedAt` от наименее недавно использованного к наиболее недавно использованному; при равенстве порядок детерминирован по id;
- это убирает прилипание новых задач к последнему успешному аккаунту и равномернее расходует allowance легитимного пула;
- привязка существующего Qwen-треда не ослаблена: `qwen-client.operationCandidates(preferredAccount)` по-прежнему явно ставит владельца треда первым поверх LRU-списка. Старый `chatId` через другой аккаунт не отправляется;
- cooldown, failover budget и provider-wide safety circuit не менялись;
- добавлен `scripts/account-selection-policy-test.js`: он проверяет LRU для независимой работы, отсутствие зависимости от UI/current `activeId` и сохранение preferred affinity;
- новый тест включён в обычный `npm test`;
- commit продукта: `473cec3478d9178510f58ca090cb54cd8a5b03f1` (`pool: balance independent work by least-recently-used account`);
- provider traffic = 0; живые аккаунты, encrypted runtime, production и relay outbox не тронуты.

## Проверки и ограничения

- на момент завершения смены GitHub ещё не показывает status contexts для `473cec34...`; CircleCI PASS не придумывать, сначала снять фактический результат;
- exact head содержит свежую session-store транзакционность и новое LRU-распределение; после зелёного обычного CircleCI нужен один bounded Windows offline parity без provider traffic;
- GitHub Actions minutes не использовать как обычный compute;
- старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` по-прежнему не дублировать вслепую.

## Что дальше

1. Снять фактический обычный CircleCI для exact `473cec34...`. Если красный — чинить только воспроизведённую причину. Если зелёный — один bounded Windows offline parity на этом exact продуктовом состоянии.
2. После CI отдельно проверить, что LRU не сломал `markFailure`/CAPTCHA rotation и реальный OpenCode thread-affinity; офлайн-контракты уже должны ловить регрессии через общий `npm test`.
3. Установить судьбу старого live-trigger `4de8bdae...`; если доказано, что он не состоялся, выполнить ровно один bounded live `read_file → tool result → следующий модельный ход → bash → tool result → final`.
4. После live PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.
5. После этого продолжать расширение возможностей: безопасный API-каталог skills, затем bounded subagents; после них web-search, большие документы и мультимодальность.
