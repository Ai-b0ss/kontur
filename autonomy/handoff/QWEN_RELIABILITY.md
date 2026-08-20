# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 04:34 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head после этой смены: `03d722c3fd132a34ac16d6b7e5e03f6198e64e1c`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

## Что уже есть

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул без причины: бюджет переключений по умолчанию 4, жёсткий потолок 6;
- provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему останавливают дальнейшее прощупывание соседних аккаунтов;
- новые независимые задачи распределяются по давно не использовавшимся аккаунтам, а существующий Qwen-тред сохраняет приоритет своего аккаунта-владельца;
- failover незавершённой цепочки переносит локальную историю в новый Qwen-тред и продолжает tool-loop;
- crash-safe сохранение уже есть для account state, OpenCode session checkpoint/backup, provider circuit, batch progress и vision cache;
- два режима системного промпта (`engineer`/`owner`), Skills, последовательные tool-using субагенты и восстановление пачки между перезапусками уже реализованы;
- локальные картинки проверяются по реальному пути после раскрытия symlink/junction, ограничены 8 МБ и сохраняют cache crash-safe;
- ChatGPT relay не активная задача до появления owner session; outbox не включать.

## Эта смена

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md` и этот handoff; перепроверены PR #6 и `qwen-workspace` PR #5;
- на старте PR #6 был уже на `5e1f6fa18f2c8b51a3588eb1830a8e0a68bce27f`; после прошлого head было два соседних коммита и оба затрагивали только `src/qwen-v3-vision.js` и `scripts/vision-input-boundary-test.js`, поэтому эти файлы не трогались;
- взят независимый feature-gap: совместимость локальных Skills с актуальным официальным форматом Qwen Code;
- `src/skills.js` теперь поддерживает не только старые плоские `skills/name.md`, но и стандартный каталог `skills/name/SKILL.md` с простым YAML-frontmatter `name`/`description`;
- стандартный `SKILL.md` имеет приоритет над одноимённым старым плоским файлом, но обратная совместимость сохранена;
- canonical path проверяется после `realpath`: `SKILL.md`, уводящий через symlink/junction за пределы каталога Skills, блокируется;
- если frontmatter объявляет другое `name`, skill не загружается (`QWEN_SKILL_NAME_MISMATCH`), чтобы каталог и содержимое не расходились;
- каталог Skills теперь возвращает `description` и `layout`, поэтому следующий слой сможет безопасно делать model-visible discovery без чтения произвольных файлов;
- `scripts/skills-selection-test.js` расширен: стандартный `SKILL.md`, описание, mismatch, symlink escape и старый плоский формат проверяются вместе; этот тест уже входит в обычный `npm test`;
- коммиты этой смены в PR #6: `093e8a1ed4e76ab3d8c49c5ca9e8ece87db00004`, `03d722c3fd132a34ac16d6b7e5e03f6198e64e1c`;
- provider traffic = 0; живые аккаунты, encrypted runtime, production и relay не тронуты;
- exact head `03d722c3...` пока без опубликованных GitHub status contexts; CircleCI PASS заранее не приписывать.

## Зачем это нужно

Официальный Qwen Code сейчас хранит Skills как директории с `SKILL.md` и frontmatter, а не только как один `.md` на skill. Поддержка этого формата позволяет переносить существующие Qwen Code skills в наш мост без ручного переписывания и готовит безопасный следующий шаг — model-invoked discovery по описаниям. При этом owner prompt остаётся отдельным главным прикладным текстом: skill подключается как технический контекст и не заменяет его.

## Важно проверить следующим запуском

- сначала снять фактический обычный CircleCI на exact `03d722c3fd132a34ac16d6b7e5e03f6198e64e1c`; при красном результате чинить только воспроизведённую причину;
- после green нужен один bounded Windows offline parity на актуальном дереве: последние изменения Skills затрагивают directory/symlink semantics, а vision-тест — junction;
- старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую;
- crash-safe batch resume закрывает границу между подзадачами, но не умеет безопасно продолжить середину оборванного tool-turn с неизвестным локальным side effect.

## Что дальше

1. Получить обычный CircleCI PASS на exact `03d722c3...`.
2. При green — один Windows offline parity без provider traffic.
3. Следующий независимый feature-gap: model-visible каталог Skills по `name + description` и безопасный auto-discovery; не загружать все Skills целиком в каждый запрос.
4. Установить судьбу старого live-trigger; если доказано, что он не состоялся, выполнить ровно один bounded live `read_file → tool result → следующий модельный ход → bash → tool result → final`.
5. После live PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.
6. Затем связать безопасное продолжение середины tool-turn с batch manifest без повторения уже выполненных локальных side effects.
