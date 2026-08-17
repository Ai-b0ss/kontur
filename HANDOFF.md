# Контур — как передать проект другому разработчику

## Короткий ответ

**Не отправлять случайный ZIP из Downloads и не отправлять старый `main` без пояснений.**

Предпочтительный способ — дать доступ к private GitHub repository и отправить ссылку на чистую актуальную ветку/PR вместе с этим README.

## Что отправить человеку

Когда cleanup PR станет принятой базой:

1. ссылка на репозиторий `Ai-b0ss/kontur`;
2. конкретная ветка/commit, которые считаются handoff baseline;
3. попросить начать с:
   - `README.md`;
   - `CURRENT_PRODUCT.md`;
   - `docs/product/PRODUCT_BRIEF_2026-08-13.md`;
   - `docs/product/DECISION_LOG_2026-08-14.md`;
   - `ARCHITECTURE.md`;
   - `IMPLEMENTATION_PRIORITY.md`;
   - `CODEBASE_MAP.md`;
4. только затем читать исходники.

## Если передавать прямо сейчас

Текущий `main` ещё содержит смешение current/legacy поколений.

До завершения cleanup безопаснее отправлять **PR #11 / ветку `cleanup/repo-hygiene-shareable-source`**, явно называя её cleanup candidate, а не окончательным production snapshot.

Нельзя обещать, что эта ветка byte-for-byte соответствует preview `5dabce57`, пока provenance gate не закрыт.

## Что НЕ надо отправлять

Не включать в обычный handoff:
- `.env`;
- API tokens/secrets;
- Telegram cookies/sessions/accounts;
- Cloudflare credentials;
- production D1 dumps;
- локальные browser profiles;
- runtime state;
- private chat/research exports;
- ключи шифрования;
- случайные backup ZIP из Downloads.

Если человеку реально нужен runtime credential, передавать отдельно через согласованный секретный канал и с минимальными правами.

## Что должно работать после clone

Цель clean handoff:

```bash
git clone <repo>
cd kontur
pnpm install
pnpm check
```

И локальный запуск по README без скрытой зависимости от домашнего ПК владельца.

## Что сказать разработчику

Короткое сопроводительное сообщение:

> Это текущая рабочая база «Контура». В репозитории раньше накопилось несколько исторических поколений, поэтому сначала прочитай `README.md` и `CURRENT_PRODUCT.md`: они отделяют текущий продукт от V1–V5 архива. Полное актуальное ТЗ — `docs/product/PRODUCT_BRIEF_2026-08-13.md`, фактически пройденные визуальные гейты 14 августа — `docs/product/DECISION_LOG_2026-08-14.md`. Не считай существующий legacy-код утверждённой фичей. Текущий preview `5dabce57...workers.dev` используется как owner-visible reference, но exact Git provenance ещё должен быть доказан. Production без согласования не трогать.

## Definition of handoff-ready

Проект считается красиво сдаваемым, когда:
- README объясняет запуск и структуру;
- current product отделён от history;
- exact current source/provenance понятен;
- каждый tracked file классифицирован;
- secrets/private state исключены;
- clean-clone CI green;
- share-safe archive воспроизводим из Git;
- нет необходимости объяснять человеку «какую из 30 папок открыть».
