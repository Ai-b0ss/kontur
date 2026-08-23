# Контур — текущий продукт

**Статус:** OWNER-CANONICAL · CORE revalidated 2026-08-22 · draft PR #12

**Приоритет:** этот файл кратко фиксирует текущий продукт. Наличие старой механики в коде или документации НЕ делает её частью продукта.

Финальный verdict/evidence находится в `docs/product/evidence/KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md`, `KONTUR_CORE_DONE_REVALIDATION_2026-08-22.md` и owner-package `MANIFEST.json`. Merge/main/production не авторизованы.

## 1. Контур в одной строке

Telegram Mini App + бот: человек один раз проходит 8 вопросов, получает визуальный результат-птицу, люди благодарят друг друга reply-командой `/worm`, а каждые 5 полученных червяков дают яйцо с гарантированно новым косметическим окрасом, который можно надеть и который сохраняется после перезагрузки.

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

`HOOK «Какая ты птица в IT?» -> hero egg -> 8Q quiz -> progressive physical cracks -> bird reveal -> короткое объяснение /worm -> HOME`

Mini App должна работать как standalone hook даже для человека, который ничего не знает о конкретном Telegram-чате.

Community onboarding — отдельная contextual branch. Существующие три community screens **сохранять в source**, но не возвращать в обязательный default entry.

Исходный owner-approved контракт 13.08:
- [`docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`](docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md)
- [`docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`](docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md)

Human-readable ТЗ: [`docs/product/PRODUCT_BRIEF_2026-08-13.md`](docs/product/PRODUCT_BRIEF_2026-08-13.md).

## 4. Что уже реально прошло после ТЗ

14 августа через Codex был выполнен визуальный и интеграционный проход. Поэтому нельзя считать, что проект всё ещё находится перед STEP A или STEP E.

Фактическое состояние:
- **STEP A принят:** Hook Hybrid H3;
- **STEP B принят:** одно hero egg уменьшается/переезжает в q1;
- **STEP C принят:** 8 deterministic crack states + согласованный progress language;
- **STEP D собран и присутствует в current runtime source:** hook -> 8Q -> hatching -> reveal -> `/worm` -> Home;
- **STEP E принят и интегрирован:** пять канонических backend-ролей дают шесть визуальных результатов — сорока, дятел, сойка, журавль, сова и Котосов;
- Котосов — presentation-only вариант уже победившей роли `vibe`: он выбирается только когда `coder` является строго единственным сильнейшим secondary score; ничья/неполные данные дают сову;
- backend role taxonomy, `resolveRole`, веса вопросов и scoring из-за Котосова НЕ меняются;
- owl/kotosov presentation-вариант сохраняется локально с привязкой к `player.userId`, чтобы reload не менял визуальный результат.

Exact evidence STEP E:
- [`docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`](docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md)
- [`docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`](docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md)

Текущая реализация: `apps/miniapp/src/result-taxonomy.ts` + `LocalKontur.tsx`.

Подробный журнал: [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md).

## 5. Исторический STEP F и текущее состояние релиза

После принятия STEP E официальный следующий gate 14 августа был **STEP F — одна безопасная Worker Version без переключения трафика**.

17 августа проект уже ушёл дальше исторического STEP F: frozen handoff source был собран и через guarded release workflow выложен в production. Run `32030041504` создал Cloudflare Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`, предварительно сохранил rollback evidence, сбросил production D1 к свежей схеме и применил миграции.

Последний красный post-check этого run не доказал дефект source/deploy: он получил старое поколение статических assets сразу после успешного deploy. Exact incident evidence и исправление verifier: [`docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`](docs/provenance/PRODUCTION_RELEASE_2026-08-17.md).

**Не повторять destructive production reset ради повторной проверки.** Следующий live proof должен быть read-only/non-destructive и сначала доказать exact convergence свежего `dist/index.html` и assets.

## 6. Чего в текущем продукте НЕТ

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

## 7. Preview `5dabce57` и граница доказанности

Owner указывал более ранний preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

КРИТИЧЕСКИ ВАЖНО: пока не построено доказательство `preview 5dabce57 -> immutable Cloudflare Worker version -> exact frontend assets/source`, нельзя утверждать, что `main`, v84, v86 или любой snapshot byte-for-byte соответствует этому preview.

Уже доказано отдельно:
- v84 = immutable Version ID `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker module SHA-256 = `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- текущий GitHub source происходит из Codex lineage `v86-local-candidate/verification/result/source/kontur`;
- `5dabce57` — отдельный более поздний preview и пока остаётся forensic provenance target, а не current-product authority.

До закрытия этого forensic gate:
- exact primary sources 13.08 + accepted evidence 14.08 + текущий source определяют доказанный product lineage;
- runtime-код удалять только по доказанным reachability/provenance данным;
- `5dabce57` не является блокером обычного handoff, но формулировка `byte-for-byte equals 5dabce57` запрещена.

## 8. Приоритеты реализации

Актуальный порядок — [`IMPLEMENTATION_PRIORITY.md`](IMPLEMENTATION_PRIORITY.md).

Коротко:
1. CORE acceptance и secret-safe handoff закрыты на exact release-record commit;
2. PR #12 сохранять draft до отдельного решения owner;
3. forensic `5dabce57` и exhaustive legacy reachability можно продолжать отдельно, не переоткрывая CORE;
4. не изобретать заново A–E и не генерировать новые bird concepts без нового owner decision;
5. merge в `main` и production — только после отдельного явного разрешения owner.

## 9. Источники истины

При конфликте:
1. новое явное решение owner;
2. exact primary source 13.08 из `docs/product/source/`;
3. exact accepted execution evidence 14.08 из `docs/product/evidence/`;
4. этот `CURRENT_PRODUCT.md` как краткая текущая карта;
5. `docs/product/PRODUCT_BRIEF_2026-08-13.md` и `DECISION_LOG_2026-08-14.md`;
6. воспроизводимое доказательство current source/deployment;
7. `ARCHITECTURE.md` / `CODEBASE_MAP.md`;
8. актуальные тесты, если они проверяют именно current invariant;
9. всё из `docs/archive/` — только история/доказательства.

Старые `PROJECT_STATE`, V4/V5 specs, navigator/backlog и большие product docs не могут отменить доказанный current state.
