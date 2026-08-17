# Share-safe source handoff

**Статус:** candidate/source handoff МОЖНО собирать воспроизводимо; exact historical-preview claim остаётся BLOCKED.

Есть две разные планки, их нельзя смешивать.

## 1. Что уже можно передать

Можно передать **рабочую candidate/source базу** из PR #11, если exact head прошёл clean CI/share-safe gate.

Она содержит:
- current A–E Mini App source;
- current Worker/D1 runtime candidate;
- exact primary source 13.08;
- exact accepted execution evidence 14.08;
- packages/core/contracts;
- migrations;
- tests/release/verification tooling;
- provenance и исторический архив, если нужен полный engineering handoff.

Формулировка получателю:

> `candidate/current working source handoff at commit <SHA>`

Нельзя называть такой архив:

> `exact bytes of historical preview 5dabce57`

пока provenance не доказан.

## 2. Что всё ещё заблокировано

Historical preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

До цепочки

`5dabce57 -> immutable Cloudflare version -> exact Worker/assets -> exact Git source`

запрещено заявлять byte-for-byte equivalence этому preview.

Отдельно v84/current Codex/prod-17.08 identities уже доказаны, но их нельзя подставлять вместо `5dabce57`.

## 3. Что входит в полный source handoff

Обязательно:
- `README.md`, `CURRENT_PRODUCT.md`, `HANDOFF.md`, architecture/map/state;
- exact `docs/product/source/*`;
- exact accepted `docs/product/evidence/*`;
- `apps/miniapp` source + public assets;
- `apps/worker` source + D1 migrations;
- `packages/core`, `packages/contracts`;
- local/reference components, если они нужны test/recovery path;
- package manifests + lock/workspace files;
- tests;
- reproducible verification/release tooling;
- `.env.example` без секретов;
- runtime reachability tooling;
- guarded deployment workflows;
- SHA-256 manifest каждого включённого файла.

`docs/archive/legacy/` можно включать в **полный engineering handoff** как явно маркированную историю. Для минимального runtime-only пакета его можно исключить отдельным режимом, но нельзя смешивать архив с current authority.

## 4. Что НЕ включать

- plaintext `.runtime-state/` или ключи его расшифровки;
- `.env`, `*.local`, реальные tokens/keys/passwords;
- `backups/`, production D1 exports, `data/`, `research-private/`;
- Telegram sessions/cookies/accounts;
- browser profiles;
- `node_modules/`, `dist/`, local caches;
- временные ZIP/log/tmp;
- любые private files, которые не являются осознанно утверждёнными product sources.

## 5. Reproducible packaging

`tools/package-handoff.ps1`:
- берёт фактический `git ls-files`;
- исключает private/runtime/generated paths;
- копирует source во временный staging;
- сканирует секреты;
- добавляет `SHA256SUMS.txt`;
- собирает ZIP;
- распаковывает ZIP заново и проверяет internal SHA-256;
- пишет SHA-256 самого ZIP;
- очищает только безопасный temporary path.

CI обязан запускать этот packager из clean checkout.

## 6. Acceptance gate рабочего source handoff

Перед отправкой конкретного commit одновременно нужны:

1. exact primary/evidence SHA gate PASS;
2. fresh checkout + frozen install PASS;
3. current MVP tests PASS;
4. Worker/API tests PASS;
5. typecheck/build PASS;
6. runtime reachability report создан;
7. secret scan PASS;
8. reproducible archive + internal manifest PASS;
9. direct production deploy остаётся fail-closed;
10. архив/сообщение явно указывает commit SHA и статус `candidate/current working source`, без false exact-preview claim.

Green со старого commit не переносится на новый head.

## 7. Acceptance gate forensic/exact-preview-ready

Дополнительно:

1. доказать или честно исчерпать `5dabce57 -> immutable CF version -> assets/source`;
2. закончить exhaustive classification/reachability спорного shipping runtime;
3. проиндексировать найденную Codex lineage 14.08;
4. удалить/минимизировать legacy только отдельным доказанным diff после этих gates.

Пока эти пункты не закрыты, статус допустим:

`working source handoff: PROVABLE`

но не:

`exact historical preview recovery: PROVEN`.
