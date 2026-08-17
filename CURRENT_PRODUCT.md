# Контур — текущий продукт

**Статус:** OWNER-CANONICAL · 2026-08-17  
**Приоритет:** этот файл определяет текущий продукт. Наличие старой механики в коде или документации НЕ делает её частью продукта.

## 1. Контур в одной строке

Telegram Mini App + бот: человек один раз проходит 8 вопросов, получает свою птицу, люди благодарят друг друга reply-командой `/worm`, а каждые 5 полученных червяков дают яйцо с гарантированно новым косметическим окрасом, который можно надеть и который сохраняется после перезагрузки.

## 2. Замороженный MVP-инвариант

`8 вопросов один раз -> птица -> reply /worm -> +1 червяк -> 5 worms = egg -> гарантированно новый cosmetic coloration -> equip -> reload сохраняет состояние`

Дополнительно:
- self-farming запрещён;
- один giver -> один receiver не чаще одного раза за игровой день;
- `/worm` — явный reply-жест благодарности/уважения за конкретное сообщение;
- настоящее reward-яйцо стоит ровно 5 worms;
- яйцо НЕ даёт дубль: результатом должен быть ещё не открытый окрас;
- выбранный окрас сохраняется.

## 3. Канонический первый вход

`HOOK «Какая ты птица в IT?» -> hero egg -> 8Q quiz -> progressive physical cracks -> персональный bird reveal -> короткое объяснение /worm -> HOME`

Mini App должна работать как standalone hook даже для человека, который ничего не знает о конкретном Telegram-чате.

Community onboarding — отдельная contextual branch. Существующие три community screens **сохранять в source**, но не возвращать в обязательный default entry.

Полное owner-approved ТЗ: [`docs/product/PRODUCT_BRIEF_2026-08-13.md`](docs/product/PRODUCT_BRIEF_2026-08-13.md).

## 4. Что уже реально прошло после ТЗ

14 августа через Codex был выполнен визуальный проход. Поэтому нельзя считать, что проект всё ещё находится перед STEP A.

Фактическое состояние:
- **STEP A принят:** Hook Hybrid H3;
- **STEP B принят:** одно hero egg уменьшается/переезжает в q1;
- **STEP C принят:** 8 deterministic crack states + согласованный progress language;
- **STEP D был собран как executable first-time-flow mock** и локально проверен в review-пакете; требовалась/требуется сверка с exact current source/preview;
- предусмотренный следующий продуктовый gate: **STEP E — Bird Character Direction + 1–2 real UI concepts**.

Подробно: [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md).

## 5. Чего в текущем продукте НЕТ

Без нового явного owner-решения НЕ возвращать и НЕ описывать как текущие фичи:
- tactical tree / ветви / дерево;
- daily move / ежедневный ход;
- ежедневную серию из пяти вопросов;
- forecasts / прогнозы;
- raid / рейды;
- Form II;
- inventory / gear;
- storm;
- leaderboard / streak / XP;
- AI character / narrator;
- пассивную выдачу червяков;
- старую двойную экономику reputation+wallet как продуктовый инвариант;
- duplicate/refund gacha;
- перегруженные V3/V4/V5/community-guide surfaces.

Исторический код этих систем может временно оставаться в репозитории как compatibility/evidence. `IMPLEMENTED != PRODUCT APPROVED`.

## 6. Текущий preview и граница доказанности

Owner указал текущий preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

КРИТИЧЕСКИ ВАЖНО: пока не построено доказательство `preview 5dabce57 -> Cloudflare Worker version -> exact frontend assets/source`, нельзя утверждать, что `main`, v84, v86 или любой старый snapshot byte-for-byte соответствует этому preview.

До закрытия provenance gate:
- preview — фактический UX-ориентир owner;
- этот файл + `PRODUCT_BRIEF` + `DECISION_LOG` — product authority;
- GitHub-код — current/legacy mixture, который нужно классифицировать;
- runtime-код удалять только по доказанным reachability/provenance данным;
- Codex artifacts H3 / Step B/C/D не архивировать как legacy до provenance-разбора.

## 7. Приоритеты реализации

Актуальный порядок — [`IMPLEMENTATION_PRIORITY.md`](IMPLEMENTATION_PRIORITY.md).

Коротко:
1. exact provenance `5dabce57`;
2. recovery Codex lineage 14.08;
3. exhaustive file classification;
4. чистая архитектурная/документальная база;
5. продолжение current approved product line, а не новые механики;
6. clean-clone/share-safe handoff.

## 8. Источники истины

При конфликте:
1. явное текущее решение owner;
2. `CURRENT_PRODUCT.md`;
3. `docs/product/PRODUCT_BRIEF_2026-08-13.md`;
4. `docs/product/DECISION_LOG_2026-08-14.md`;
5. воспроизводимое доказательство exact current preview/source;
6. `ARCHITECTURE.md` / `CODEBASE_MAP.md`;
7. актуальные тесты, если они проверяют именно current invariant;
8. всё из `docs/archive/` — только история/доказательства.

Старые `PROJECT_STATE`, V4/V5 specs, navigator/backlog и большие product docs не могут отменить этот файл.
