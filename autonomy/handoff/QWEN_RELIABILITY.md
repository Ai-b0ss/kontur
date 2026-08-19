# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19 17:37 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Свежий head: `7c188e6995e6f6eaeddf0286db5011c6f9cdb06e`.
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

## Что выяснено в этой смене

- перед работой заново прочитаны owner intent, CURRENT и этот handoff;
- PR #6 уже ушёл от прошлого `64837b7c...` до `7c188e69...`: четыре свежих коммита меняют `src/skills.js`, `src/qwen-v3-capabilities.js`, `scripts/skills-selection-test.js` и `scripts/system-prompt-mode-test.js`;
- поэтому в эти же файлы параллельный патч не вносился: другой Qwen-рабочий прямо сейчас развивает тот же участок;
- свежая логика skills остаётся ограниченной и сохраняет owner prompt отдельно; тест теперь дополнительно покрывает дедупликацию skills и суммарный бюджет контекста;
- свежая prompt-логика добавляет сохранение обычных client system-инструкций в engineer-режиме как `Instructions from: client system`, чтобы адаптер их не потерял, но не переклассифицирует встроенную персону OpenCode;
- `qwen-workspace` PR #5 перепроверен: head прежний `468733b2...`, mergeable=true;
- provider traffic = 0; живые аккаунты, encrypted runtime, production и relay outbox не тронуты.

## Важная координация

Следующий feature-gap после Skills — дать безопасный каталог skills через клиентский/API-контракт, а затем bounded subagents. Но не менять `src/skills.js`/`src/qwen-v3-capabilities.js`, пока свежая параллельная линия на них не стабилизируется. Независимые области: пул, restart/state recovery, Windows, web-search/большие документы/мультимодальность.

## Что дальше

1. Снять фактический обычный CircleCI на exact head `7c188e69...`; зелёный статус старого head не переносить автоматически.
2. После стабилизации текущей Skills/prompt-линии добавить безопасный API-каталог skills без вмешательства в owner prompt.
3. Не повторять живой Qwen-run, пока не установлена судьба старого разрешённого trigger `4de8bdae6d0c28789181f31b6212f97e6e283333`. Если доказано, что он не состоялся, нужен ровно один bounded live `read_file → tool result → следующий модельный ход → bash → tool result → final`.
4. После живого PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.
5. Windows parity запускать после очередного Windows-чувствительного изменения или перед финальным сведением линии; не тратить Windows compute только из-за Markdown/каталога skills.
6. После Skills/API — bounded subagents; затем web-search, большие документы и мультимодальность как следующие крупные возможности.
