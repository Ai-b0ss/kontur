# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head по свежему PR: `da7057ec71f90c1e544ce493bf4351ab93f7bbdb`.

## Режим исполнения

Действует ZERO-MINUTE MODE: не запускать CircleCI/GitHub Actions и не делать push только ради hosted CI. Linux/Python/offline проверки сначала выполнять в бесплатной ChatGPT/container среде. Native Windows не имитировать через Linux/Wine; для NCM28 оставлять один минимальный Windows-gate.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Текущий точный digest-разрез на Core НЕ перезапускать:
- exact Core head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- свежая read-only проверка статусов на 2026-08-20: все пять всё ещё `pending`.

Бесплатный статический разбор этого запуска подтвердил важную границу: v32 уже проводит held `managed_guard` в destructive rollback/delete paths, а базовые `tree_digest()` / `_strict_tree_listing()` остаются pathname-based. Это делает digest/read family правдоподобным оставшимся Windows callsite, но считать это доказанной первопричиной нельзя до одного native Windows результата. Никакой новый Windows fan-out не запускался.

Если текущий digest-разрез в итоге укажет `outside-digest`, уже есть более точный read-only call-cut: ветка `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. Он различает `sanitized_active`, `sha_file`, отдельные `tree_digest`, `_strict_tree_listing`, pending atomic, migration/runtime validation, `_path_lexists` и `outside_known`. В ZERO-MINUTE MODE его не запускать автоматически: использовать только как минимальный единственный native Windows gate, когда доступен бесплатный/уже оплаченный Windows-исполнитель без расходования hosted minutes.

После нахождения одного точного вызова: минимальный фикс → локальные Linux/Python регрессии → один native Windows gate `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → затем `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрываем.

## Codex / Agent

В ветке уже есть:
- режимы `engineer/owner`;
- распределение foreground-слотов и sticky continuation;
- безопасный failover на новый account/thread с переносом локальной истории;
- provider-neutral delegation;
- Notion child-agent runtime/lifecycle поверх того же account pool;
- точные схемы локальных инструментов и fail-closed обработка MCP tool-result;
- настоящий проектный `codex exec` гейт и двухслотовые/failover варианты;
- server-wiring materializer, который пока ещё не внесён напрямую в `payload/server.py`.

### Что реально проверено бесплатно в этом запуске

Свежий `payload/server.py` на Agent head `da7057ec…` всё ещё содержит single-slot reservation gap:
- `ForegroundAccountReservations.wait_for_background_route()` при `pool_size <= 1` сразу возвращает пустой avoid-set;
- вызывающий Responses path вообще вызывает эту защиту только при `account_pool.size > 1`;
- значит при единственном легитимном слоте независимый новый foreground/background route может взять аккаунт, который незавершённый foreground tool-loop считает зарезервированным.

Подготовлен и локально проверен минимальный кандидат исправления без hosted CI и без provider traffic:
1. `wait_for_background_route()` возвращает пустой set немедленно только при `pool_size <= 0`; при `pool_size == 1` он ждёт clear/TTL, если единственный аккаунт зарезервирован;
2. вызывающий path применяет `should_avoid_reserved_foreground_accounts(...)` для любого положительного размера пула, без внешнего `account_pool.size > 1`;
3. anchored continuation остаётся на своей affinity-path и не ждёт сама себя, потому что `should_avoid...(... has_affinity_anchor=True)` для foreground Sol возвращает false.

В бесплатном Python executor пройдены 6 целевых сценариев:
- single-slot независимый foreground ждёт clear;
- abandoned single-slot reservation освобождается по TTL;
- multi-slot semantics сохраняют avoid-set;
- anchored continuation не блокируется своей reservation;
- memory/background при одном слоте тоже ждёт release;
- `pool_size=0` fail-safe возвращает пустой set.

Этот продуктовый patch пока намеренно НЕ отправлен в `notion-agent-bridge`: доступный GitHub write-интерфейс требует замену всего большого `payload/server.py`, а в ZERO-MINUTE MODE нельзя делать недоказанную/ручную реконструкцию огромного файла только ради push. Следующий исполнитель должен применить ровно эти две маленькие правки из clean exact source и повторить те же бесплатные тесты перед коммитом.

Нового provider traffic не было. Production и живой Notion не трогались. Hosted CI не запускался.

## Единственный оставшийся native-Windows blocker/gate

NCM28: установить точный источник оставшегося `PermissionError` в `auth-rollback` на exact Core `b6f4eef…`. Никакие Linux/Wine результаты не считать доказательством Windows-семантики. Не размножать диагностику: сначала использовать уже ожидающий digest-result; если он недоступен/не стартует без минут, следующий допустимый Windows шаг — один минимальный call-cut на готовом `f72c450f…`, а не fan-out из новых workflow.

## Следующий порядок

1. Read-only проверить, не появился ли результат уже существующего Windows digest workflow; ничего не запускать.
2. В Agent clean exact source применить локально проверенный single-slot reservation fix + регрессии в `tests/test_foreground_slot_routing.py`; прогнать бесплатно локально, затем коммитить.
3. После этого бесплатно прогнать agent/prompt/routing/delegation/server-wiring контракты в ChatGPT container насколько позволяет exact source/deps.
4. Если server-wiring материализатор проходит локально — внести lifecycle в настоящий `payload/server.py` и повторить бесплатные контракты.
5. Затем один настоящий `codex exec` project probe в уже авторизованной среде только когда это можно сделать без нового hosted CI расхода: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
6. Затем two-slot/failover + restart/recovery незавершённой цепочки, без повторения уже выполненного локального side effect.
