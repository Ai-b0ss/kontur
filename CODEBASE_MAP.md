# Контур — карта кодовой базы

**Статус:** рабочая карта cleanup · 2026-08-17.  
Главное правило: присутствие файла в репозитории не означает, что его механика входит в текущий продукт.

## A. Канонический продуктовый слой

- `CURRENT_PRODUCT.md` — единственная текущая продуктовая конституция.
- `PROJECT_STATE.yaml` — короткий машинный указатель на актуальное состояние и provenance-gate.
- `README.md` — человеческая точка входа.
- `AGENTS.md` / `AI_PROJECT_NAVIGATOR.md` — правила для агентов.

## B. Candidate runtime/source, который нельзя удалять вслепую

- `apps/miniapp/` — Mini App. Внутри исторически сосуществовали несколько поверхностей и routing-флаги.
- `apps/worker/` — Cloudflare Worker/runtime и D1 migrations.
- `packages/core/` — игровая логика; содержит как нужные, так и потенциально устаревшие механики.
- `packages/contracts/` — общие контракты.

До доказанного связывания preview `5dabce57` с exact source ни один из этих каталогов нельзя целиком объявлять current или legacy только по названию.

## C. Локальный/reference/test контур

- `apps/api/`
- `apps/bot/`
- `packages/db/`
- `tools/`

Они могут быть нужны для локальной проверки, миграций, симуляций, backup/restore и исторической совместимости. Они не должны восприниматься как второй production runtime без отдельного доказательства.

## D. Исторические поверхности в коде

Имена/маршруты вроде `ExperienceV2`, `RestoredExperience`, `ZeroSeason`, `LiveCampaign`, `?season=zero`, `?campaign=v5` и прочие V1–V5 слои — **QUARANTINED LEGACY UNTIL PROVEN OTHERWISE**.

Их текущая политика:
- не использовать как источник продуктовых требований;
- не развивать автоматически;
- не удалять до reachability/provenance-аудита;
- если они нужны exact deployed preview — классифицировать как compatibility runtime, а не как текущую продуктовую механику.

## E. Историческая документация

`docs/archive/` — архив. Документы там сохраняются ради provenance, решений и расследований, но не являются ТЗ.

Крупнейшие прежние источники путаницы (`PROJECT_STATE` 2026-08-08, старый AI navigator, V5 spec, старый product direction, старый backlog/README) перенесены/сохранены в архив cleanup-веткой.

## F. Runtime/private state

Не входит во внешний source handoff:
- `.runtime-state/`;
- `.env`, `*.local`;
- `backups/`, `data/`, `research-private/`;
- токены, Telegram IDs, D1 dumps, локальные профили и прочие secrets/personal data.

Зашифрованный runtime-state хранится отдельно от shareable source.

## G. Следующий обязательный gate

1. доказать `5dabce57 preview -> exact Worker version -> exact assets`;
2. сопоставить это с GitHub/local recovered source;
3. построить tracked-file inventory: CURRENT / COMPATIBILITY / TEST-INFRA / ARCHIVE / PRIVATE-EXCLUDED / UNKNOWN;
4. только после этого физически удалять или перемещать legacy runtime;
5. собрать воспроизводимый share-safe source package.