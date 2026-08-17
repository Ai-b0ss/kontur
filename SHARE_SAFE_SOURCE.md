# Share-safe source handoff

**Статус:** BLOCKED ON EXACT PREVIEW SOURCE MAPPING.

Пока preview `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev` не связан с exact source, не выдавать внешний архив как «тот самый текущий код».

## Что должно войти в будущий чистый handoff

После provenance gate:
- exact current Mini App source;
- exact required Worker/API source;
- реально используемые packages/contracts/core;
- нужные D1 migrations;
- package manifests + lock/workspace files;
- воспроизводимые тесты current MVP invariant;
- `.env.example` без секретов;
- короткий README запуска;
- manifest с commit/version/hash provenance.

## Что НЕ включать

- `.runtime-state/` и encrypted runtime archives;
- `.env`, `*.local`, реальные токены/keys;
- `backups/`, D1 dumps, `data/`, `research-private/`;
- Telegram IDs/персональные данные;
- `node_modules/`, `dist/`, локальные caches;
- `docs/archive/` и старые V1–V5 product specs, если человек просит именно рабочий код;
- старые прототипы/визуальные эксперименты, не нужные exact current build.

## Acceptance gate перед отправкой

1. provenance exact preview -> source доказан;
2. fresh checkout без private state устанавливается;
3. current MVP tests PASS;
4. build PASS;
5. secret scan PASS;
6. архив создаётся детерминированно;
7. manifest перечисляет каждый включённый файл и SHA-256;
8. отдельной строкой указано, что production deployment и live data не включены.

До выполнения этих пунктов допускается только «candidate/source snapshot», но не заявление «это текущий deployed code».