# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `c53ed44f415b3cf65d6356936d9a95ef9379735f`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/его gate-ветки не запускать и не двигать до явной разморозки владельцем.

Перед новой записью снова перечитать PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9, Circle policy и v4 LATEST/PREVIOUS.

## Новый серьёзный Core RED — schema-invalid durable session record
Fresh exact `src/session-store.js` blob на предыдущем product head `747beb79...`: `44b521bd026c82c8e9cc733af714a3d6b42f4ca9`.

`readSessionsFile()` сейчас проверяет только верхний объект `{sessions:{...}}`, но не схему каждой записи. Синтаксически корректный JSON вроде:

`{ sessions: { damaged: { chatId: "new-thread", history: "not-an-array" } } }`

принимается как хороший primary snapshot. Тогда:
- backup не используется;
- `recoveryState('damaged').uncertain === false`;
- `getRecord()` возвращает этот `chatId` и строковый `history` как доверенное primary-состояние;
- сервер может переиспользовать upstream thread при утраченной/повреждённой локальной истории, то есть fail-closed replay/restart boundary нарушается.

Hosted reproduction на логике, побайтно совпадающей с текущими `readSessionsFile/load/getRecord/recoveryState`, получен:
`QWEN_SESSION_RECORD_SCHEMA_BUG_REPRODUCED primary_schema_unchecked=1 stale_thread_reused=1 backup_not_used=1`.

Постоянный намеренно RED regression добавлен в PR #6:
- commit `c53ed44f415b3cf65d6356936d9a95ef9379735f`;
- `scripts/session-store-record-schema-recovery-test.js`.

Regression требует:
1. malformed primary record отвергает весь primary snapshot;
2. валидный `.bak` поднимается как `recoveryUncertain`;
3. backup `chatId` не переиспользуется (`chatId:null` до явного reconcile);
4. поддерживаемый legacy string-record остаётся читаемым.

Тест намеренно НЕ включён в `npm test`, потому что продукт пока красный. Это допустимый временный standalone только до root fix; после targeted green его обязательно сразу подключить в штатный `npm test`.

## Следующий root fix
Минимально чинить `src/session-store.js` в `readSessionsFile()` на свежих exact bytes:
- каждая запись должна быть либо поддерживаемой legacy непустой строкой, либо не-массивным объектом;
- если объект имеет `history`, оно обязано быть массивом;
- `chatId`, если присутствует и не `null`, должен быть непустой строкой;
- malformed record должен инвалидировать snapshot целиком, чтобы `load()` перешёл на backup и выставил uncertainty всем восстановленным ключам.

Не расширять в этом же коммите схему без воспроизводимой необходимости. После fix:
1. exact targeted `session-store-record-schema-recovery-test.js`;
2. `session-store-restart-test.js`;
3. stale-backup/system-retention/pending-tool restart cluster;
4. только после green подключить новый regression в `npm test`.

В этом проходе большой `session-store.js` не заменялся через Contents API: доступная операция требует полную замену файла, а собирать неизвестные байты вручную опаснее дефекта. Нужна побайтно проверенная материализация exact blob перед продуктовой записью.

## Ранее закрытые Core invariants — без нового контрпримера не открывать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed при реально невалидном/нечитаемом primary;
- owner/system checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent/coding/plain subagents strict owner/engineer validation;
- local tool `Error:` contract + required-argument validation;
- capability mode preflight;
- durable owner authority type validation;
- required-tool terminal frames/parser reset/reasoning gate.

## Координация с QWEN_RELIABILITY
Fresh handoff до этого прохода:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- единственный Reliability proof gap: exact `scripts/provider-safety-test.js` на настоящем locked dependency tree с axios.

Core не трогает `account-store/cooldown/provider-circuit`.

## Финальный порядок после закрытия нового RED
1. Fresh PR head + fresh Reliability.
2. Core session/restart cluster green на одном стабильном SHA.
3. Reliability exact provider-safety proof green на тех же product bytes.
4. Full exact-tree Linux `npm test` доступным бесплатным exact executor.
5. Если остаётся только Circle — статус `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`; freeze не обходить.
6. После явной разморозки — один native Windows Server 2022 gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
7. Только после Linux + native Windows green создавать и проверять Windows owner doctor/acceptance harness.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний проверенный handoff до этого запуска указывал:
- capsule `20260822T230801Z-b2fff032a7`;
- archive SHA-256 `72602c3feae0ad139e4b17bc4e8b004ecf26e6796d704b45af9145803aa595fb`;
- pointer blob `0fb9c8b2deb1d947c64a40db7e88b5905eb4edde`;
- normative runtime blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Новая capsule в этом проходе не публиковалась: exact v4 path/bytes не были безопасно материализованы в hosted filesystem, force-write/CAS bypass запрещён. Продуктовый RED regression и этот handoff дают точную точку продолжения; следующий проход при exact v4 materialization сначала fresh-read LATEST blob и только затем pack -> verify -> restore -> CAS.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
