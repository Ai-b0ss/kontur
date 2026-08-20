# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head по PR на 2026-08-20: `333b3c07f7897b7d7aa6740476d18b2cad951b27`.

## Режим исполнения

Действует ZERO-MINUTE MODE: не запускать CircleCI/GitHub Actions и не делать push только ради hosted CI. Linux/Python/offline проверки выполнять в бесплатной ChatGPT/container среде. Native Windows не имитировать через Linux/Wine; для NCM28 оставлять один минимальный Windows-gate.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` исключён как источник этого `PermissionError`.

Текущий точный digest-разрез на Core НЕ перезапускать:
- exact Core head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`;
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`.

Из доступной среды нет прямого read-only CircleCI API, поэтому в этом запуске результат существующего workflow не был выдуман или заменён Linux-проверкой. Новый Windows/hosted прогон не запускался.

Бесплатный статический разбор сохраняет прежнюю границу: v32 проводит held `managed_guard` в destructive rollback/delete paths, а базовые `tree_digest()` / `_strict_tree_listing()` остаются pathname-based. Это правдоподобный оставшийся callsite, но не доказанная Windows-первопричина.

Если существующий digest-разрез в итоге укажет `outside-digest`, готов более точный call-cut: ветка `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. В ZERO-MINUTE MODE запускать его только как один минимальный native Windows gate на бесплатном/уже оплаченном Windows-исполнителе.

После точного callsite: минимальный фикс → бесплатные Linux/Python регрессии → один native Windows gate `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрыть.

## Codex / Agent

Свежий PR #8 уже на `333b3c07…`; предыдущие handoff-head были устаревшими. На exact source повторно подтверждён single-slot reservation gap:
- `ForegroundAccountReservations.wait_for_background_route()` сейчас немедленно возвращает пустой set при `pool_size <= 1`;
- `handle_openai_responses()` вообще вызывает эту защиту только при `account_pool.size > 1`;
- поэтому при единственном легитимном слоте независимая новая работа может взять аккаунт, зарезервированный незавершённым foreground tool-loop;
- anchored continuation должна сохранить свою affinity-path и не ждать сама себя.

Минимальный кандидат остаётся двухточечным:
1. в `wait_for_background_route()` немедленный пустой ответ только при `pool_size <= 0`; при `pool_size == 1` ждать clear/TTL, если единственный аккаунт зарезервирован;
2. в `handle_openai_responses()` убрать внешний `account_pool.size > 1` и применять `should_avoid_reserved_foreground_accounts(...)` при любом положительном пуле. Anchored continuation не блокируется, потому что helper уже возвращает false при `has_affinity_anchor=True`.

### Что реально проверено бесплатно в этом запуске

В ChatGPT Python executor повторно проверена семантика исправленного reservation primitive без provider traffic и hosted CI:
- single-slot waiter действительно блокируется до `clear()`;
- abandoned single-slot reservation освобождается по TTL;
- multi-slot возвращает reserved avoid-set;
- `pool_size=0` возвращает пустой set;
- все эти проверки PASS.

Свежий `tests/test_foreground_slot_routing.py` на `333b3c07…` пока покрывает multi-slot, anchored continuation и TTL, но не содержит отдельной single-slot regression. Значит при безопасном применении продуктового патча надо добавить именно её.

Продуктовый `payload/server.py` в этом запуске намеренно не перезаписывался через GitHub contents API: доступный write-интерфейс требует заменить весь большой файл, а ручная реконструкция многотысячного exact source ради двух строк создаёт больший риск, чем польза. Не считать патч применённым в PR #8.

Нового provider traffic не было. Production и живой Notion не трогались. Hosted CI не запускался.

## Единственный оставшийся native-Windows blocker/gate

NCM28: установить точный источник оставшегося `PermissionError` в `auth-rollback` на exact Core `b6f4eef…`. Никакие Linux/Wine результаты не считать доказательством Windows-семантики. Не размножать диагностику: сначала использовать уже существующий digest-result; если он недоступен без минут, следующий допустимый Windows шаг — один минимальный call-cut на `f72c450f…`.

## Следующий порядок

1. Read-only снять результат уже существующего Windows digest workflow, если он стал доступен; ничего не запускать.
2. В clean exact Agent source применить две маленькие single-slot правки и добавить регрессию `pool_size=1 waits until clear/TTL`; прогнать бесплатно локально до коммита.
3. Бесплатно прогнать agent/prompt/routing/delegation/server-wiring контракты насколько позволяет exact source/deps.
4. Если server-wiring materializer проходит локально — внести `ServerSubagentLifecycle` в настоящий `payload/server.py` и повторить бесплатные контракты.
5. Затем один настоящий `codex exec` project probe только в уже авторизованной среде без нового hosted CI расхода: реальный файл → локальное действие → конкретный провал verifier → tool result → исправление → повтор verifier → `VERIFY_OK`.
6. Затем two-slot/failover + restart/recovery незавершённой цепочки без повторения уже выполненного локального side effect.
