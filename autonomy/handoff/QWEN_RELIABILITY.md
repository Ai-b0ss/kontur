# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-20 05:50 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head после этой смены: `6a62bd5cc16e7c477e4de868932dd7aa9eceb1ba`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

## Что уже есть

- локальные CAPTCHA/rate limit/expired auth не останавливают весь пул без причины: бюджет переключений по умолчанию 4, жёсткий потолок 6;
- provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему останавливают дальнейшее прощупывание соседних аккаунтов;
- новые независимые задачи распределяются по давно не использовавшимся аккаунтам, а существующий Qwen-тред сохраняет приоритет своего аккаунта-владельца;
- failover незавершённой цепочки переносит локальную историю в новый Qwen-тред и продолжает tool-loop;
- crash-safe сохранение уже есть для account state, OpenCode session checkpoint/backup, provider circuit, batch progress и vision cache;
- два режима системного промпта (`engineer`/`owner`), явно выбираемые Skills, последовательные tool-using субагенты и восстановление пачки между перезапусками уже реализованы;
- локальные картинки проверяются по реальному пути после раскрытия symlink/junction, ограничены 8 МБ и сохраняют cache crash-safe;
- ChatGPT relay не активная задача до появления owner session; outbox не включать.

## Эта смена

- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md` и этот handoff; перепроверены PR #6 и `qwen-workspace` PR #5;
- на старте PR #6 уже ушёл вперёд до `5022f1b921b15ca49829d0cac25804d411deac94`; соседний рабочий менял только `src/qwen-v3-capabilities.js` и `scripts/system-prompt-mode-test.js`, поэтому эти файлы не трогались;
- по официальной документации Qwen Code подтверждено: Skills действительно model-invoked, модель видит только метаданные доступных Skills, а `disable-model-invocation: true` и `user-invocable: false` управляют двумя разными путями вызова;
- в `src/skills.js` добавлена совместимая часть этого контракта: `priority`, `user-invocable`, `disable-model-invocation`, раздельные списки model/user-visible Skills и компактный `renderModelSkillCatalog()`;
- model-visible каталог содержит только имя и описание, не загружает тела всех Skills и жёстко ограничен 6000 символами;
- model-only Skill теперь может быть скрыт от ручного списка, а manual-only Skill — наоборот скрыт от модели, не мешая явному выбору клиентом;
- сортировка model/user каталогов учитывает `priority`, при равенстве остаётся детерминированной по имени;
- `scripts/skills-selection-test.js` расширен проверками model-only/manual-only, priority, безопасного каталога без утечки тела Skill и лимита размера;
- коммиты этой смены в PR #6: `f2c3809128290cc0ea2e0ad69c1e4b4cf0777c8f`, `6a62bd5cc16e7c477e4de868932dd7aa9eceb1ba`;
- provider traffic = 0; живые аккаунты, encrypted runtime, production и relay не тронуты;
- локально запустить Node-тест не удалось только из-за отсутствия сетевого доступа контейнера к GitHub; синтаксис/смысл проверены по итоговым GitHub diff, но обычный CircleCI на exact head всё равно обязателен;
- на exact `6a62bd5c...` опубликованного GitHub status context пока нет; CircleCI PASS заранее не приписывать.

## Зачем это нужно

Это следующий кусок к настоящему Auto-Skills: модель должна видеть дешёвый каталог `name + description` и сама решать, нужен ли Skill, а полное содержимое конкретного `SKILL.md` подгружать только после выбора. Такой подход не раздувает каждый запрос телами всех Skills и не смешивает Skills с приватным owner prompt.

## Важно проверить следующим запуском

- сначала снять фактический обычный CircleCI на exact `6a62bd5cc16e7c477e4de868932dd7aa9eceb1ba`; при красном результате чинить только воспроизведённую причину;
- после green нужен один bounded Windows offline parity на актуальном дереве: последние Skills/vision изменения затрагивают directory/symlink/junction semantics;
- не редактировать `src/qwen-v3-capabilities.js` параллельно, пока другой Qwen-рабочий продолжает prompt-mode линию;
- старый разрешённый live-trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировать вслепую;
- crash-safe batch resume закрывает границу между подзадачами, но не умеет безопасно продолжить середину оборванного tool-turn с неизвестным локальным side effect.

## Что дальше

1. Получить обычный CircleCI PASS на exact `6a62bd5c...`.
2. При green — один Windows offline parity без provider traffic.
3. Когда prompt-mode линия освободит `qwen-v3-capabilities.js`, подключить `renderModelSkillCatalog()` к реальному модельному контексту и добавить bounded механизм выбора/подгрузки одного Skill по имени; не загружать все Skills целиком.
4. После этого поддержать официальный `paths:` gate: Skill не рекламируется модели, пока сессия не коснулась подходящего файла.
5. Установить судьбу старого live-trigger; если доказано, что он не состоялся, выполнить ровно один bounded live `read_file → tool result → следующий модельный ход → bash → tool result → final`.
6. После live PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранённой tool history.
7. Затем связать безопасное продолжение середины tool-turn с batch manifest без повторения уже выполненных локальных side effects.
