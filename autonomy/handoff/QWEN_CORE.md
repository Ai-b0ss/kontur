# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после Core-fix: `2058d2d3ffde3bb8fce56c011402759365beac36`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует: CircleCI/его gate-ветки не запускать и не двигать до явной разморозки владельцем.

Перед новой записью снова перечитать PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9, Circle policy и v4 LATEST/PREVIOUS.

## Закрыт серьёзный restart/replay дефект: schema-invalid durable session record
Исходный exact `src/session-store.js` blob: `44b521bd026c82c8e9cc733af714a3d6b42f4ca9`.

До исправления `readSessionsFile()` проверял только верхний `{sessions:{...}}`. Синтаксически корректная, но повреждённая запись вроде `{chatId:"new-thread", history:"not-an-array"}` считалась доверенным primary snapshot. Backup не использовался, recovery uncertainty не выставлялась, и upstream `chatId` мог быть переиспользован при утраченной локальной истории.

Дофиксовое воспроизведение:
`QWEN_SESSION_RECORD_SCHEMA_BUG_REPRODUCED primary_schema_unchecked=1 stale_thread_reused=1 backup_not_used=1`.

### Исправление
- `c53ed44f415b3cf65d6356936d9a95ef9379735f` — первоначальная RED-регрессия;
- `77e29f8fd1f4bfa6f3305925cbe8e4972e308ee0` — первая валидация записи;
- `debeab0e906e3e1174bb9b3a88da9302a65d98ad` — регрессия подключена в штатный `npm test`;
- `4654aacf2a2a7b2e978c2a05af84c7bc211f2785` — регрессия расширена повреждёнными элементами history;
- `2058d2d3ffde3bb8fce56c011402759365beac36` — окончательная минимальная валидация history entries.

Текущий `src/session-store.js` blob: `5d644421fe8d10aedc571dcbc9ee9652a0422a48`.
Текущий regression blob: `c7985e2cb8c25f12437852ea7f1b491427d4307c`.

Теперь durable record допускается только как поддерживаемая непустая legacy-строка либо обычный объект; `chatId`, если задан, обязан быть непустой строкой; `history` — массив; каждый history entry — объект с непустым строковым `role`; `tool_calls`, если присутствует, — массив; `tool_call_id`, если присутствует, — непустая строка. Повреждение primary инвалидирует snapshot целиком, поэтому `load()` переходит на валидный backup, выставляет `recoveryUncertain`, а старый backup-thread наружу отдаётся как `chatId:null` до явного reconcile.

Targeted hosted proof после фикса, без provider/CI:
- `QWEN_SESSION_RECORD_SCHEMA_NESTED_TARGET_PASS malformed=5 legacy=1 valid_history=1`;
- `QWEN_SESSION_RECORD_SCHEMA_RECOVERY_PASS malformed_primary_rejected=5 backup_fail_closed=5 legacy_string=1`.

Новый regression НЕ остался standalone: он уже входит в обычный `npm test`.

## Что ещё не доказано на текущем head
- полный exact-tree Linux `npm test`;
- совместный exact session/restart cluster на всём свежем дереве после последнего Core-fix;
- QWEN_RELIABILITY final exact `provider-safety-test.js` на настоящем locked dependency tree;
- native Windows Server 2022 full suite на тех же product bytes;
- Windows owner doctor/acceptance harness. Его создавать только после Linux + native Windows green.

## Ранее закрытые Core invariants — без нового контрпримера не открывать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- owner/system checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent/coding/plain subagents strict owner/engineer validation;
- local tool `Error:` contract + required-argument validation;
- capability mode preflight;
- durable owner authority type validation;
- required-tool terminal frames/parser reset/reasoning gate.

## Координация с QWEN_RELIABILITY
Последний fresh handoff этого прохода:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- единственный Reliability proof gap: exact `scripts/provider-safety-test.js` на настоящем locked dependency tree с axios.

Core не трогает `account-store/cooldown/provider-circuit`.

## Финальный порядок
1. Fresh PR head + fresh Reliability.
2. Exact Core session/restart cluster на текущем стабильном SHA, включая новый schema regression.
3. Reliability exact provider-safety proof на тех же product bytes.
4. Full exact-tree Linux `npm test`.
5. Пока Circle freeze действует — максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`, freeze не обходить.
6. После явной разморозки — один native Windows Server 2022 gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
7. Только после Linux + native Windows green создать простой owner Windows doctor/acceptance harness и прогнать его в native Windows Circle.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
В этом проходе exact `capsule_runtime_v4.py` был материализован и проверен по каноническому Git blob:
`6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Входной `LATEST`:
- capsule `20260822T230801Z-b2fff032a7`;
- archive SHA-256 `72602c3feae0ad139e4b17bc4e8b004ecf26e6796d704b45af9145803aa595fb`;
- pointer blob `0fb9c8b2deb1d947c64a40db7e88b5905eb4edde`.

Входная capsule прошла exact `verify + restore`.

Новая нормативная capsule после фикса:
- `20260823T011225Z-36bfb3c9f8`;
- archive SHA-256 `c03776090372b1407adaf8b9d7f50b5f77c17c08b79b4a3b5de085a4c09ce60d`;
- source_ref `2058d2d3ffde3bb8fce56c011402759365beac36`.

Локально прошли `pack -> verify -> restore`; восстановленные `CHECKPOINT.md` и `EVIDENCE.txt` побайтно совпали с исходными. После загрузки manifest и обе части перечитаны из GitHub и их Git blob SHA совпали с локальными:
- manifest `6437c60393f4b699f35364b7441401f509bef9d6`;
- part-0000 `fcedaa848840cff74b79c3672079d84e196762cc`;
- part-0001 `8ee1442392b6571e9da179a50603fe71a2eca948`.

Перед CAS `LATEST` всё ещё имел исходный blob `0fb9c8b2...`, поэтому публикация прошла без конфликта и без force-write. Старый указатель сохранён как `PREVIOUS`. Текущий `LATEST`:
- capsule `20260823T011225Z-36bfb3c9f8`;
- pointer blob `5f9f8af4f7cd4688b434d87b8e0aac196c2ad5de`.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
