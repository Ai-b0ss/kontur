# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head, повторно снятый из PR перед публикацией handoff: `700f3f12a5bbbd82021ace64fbee3be93f99a1e0`.

## Режим исполнения

Действует ZERO-MINUTE MODE и FREE FABRIC generation 1 / `STATIC_NO_CAS`. Hosted CI не запускать и не делать push только ради него. Linux/Python/offline проверки — через бесплатный ChatGPT/container executor. Native Windows не имитировать через Linux/Wine. Work stealing запрещён текущим manifest generation.

Канонический control state перед внешними записями перепроверен: owner generation 1, `external_writes=true`, `hosted_ci=false`, обязательны effect gate/current task fence/current owner generation/verified result before integration.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных managed files и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` исключён как источник этого `PermissionError`.

Существующий digest-разрез на exact Core НЕ перезапускать:
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- задачи `auth`, `codex`, `migration`, `runtime`, `outside-digest`;
- read-only GitHub combined status в этом запуске снова показывает все пять `pending`.

Нового Windows/hosted запуска не было. Linux-результаты не использовались как доказательство NTFS/NCM28.

Если существующий digest-разрез позже даст `outside-digest`, уже подготовлен единственный следующий call-cut: `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. В ZERO-MINUTE MODE это максимум один native Windows gate на бесплатном/уже оплаченном исполнителе.

После точного callsite: минимальный фикс → бесплатные Linux/Python регрессии → один native Windows gate `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`.

## Codex / Agent — single-slot reservation

На exact Agent source `700f3f12…` gap подтверждён по реальному исходнику:
- `ForegroundAccountReservations.wait_for_background_route()` немедленно возвращает `set()` при `pool_size <= 1`;
- `handle_openai_responses()` включает reservation routing только при `account_pool.size > 1`;
- поэтому при одном легитимном слоте независимая новая работа может взять аккаунт незавершённого foreground tool-loop;
- anchored continuation при этом должна сохранять собственную affinity-path и не ждать сама себя.

Минимальный кандидат двухточечный:
1. `wait_for_background_route`: ранний возврат только при `pool_size <= 0`;
2. `handle_openai_responses`: применять `should_avoid_reserved_foreground_accounts(...)` при любом положительном пуле, а не только при `size > 1`.

### Что реально проверено бесплатным исполнителем

В чистом локальном Python harness воспроизведена старая семантика и кандидат:
- старая версия: `pool_size=1` возвращается немедленно — FAIL для wait-until-clear и TTL;
- кандидат: single-slot ждёт `clear()` — PASS;
- кандидат: заброшенная single-slot reservation освобождается по TTL — PASS;
- multi-slot avoid-set сохраняется — PASS;
- `pool_size=0` остаётся неблокирующим primitive — PASS;
- anchored continuation helper остаётся bypass — PASS;
- call-site guard для независимой новой работы включается при единственном слоте — PASS.

Текущий `tests/test_foreground_slot_routing.py` на exact head отдельной single-slot регрессии не содержит.

Долговечное evidence с provenance опубликовано в control-ветке:
- `autonomy/evidence/notion/20260820T1012Z_single_slot_reservation_local_evidence.json`;
- `autonomy/evidence/notion/20260820T1012Z_single_slot_reservation_candidate.patch`.

Evidence привязан к `brain=NOTION_CORE`, `execution=chat.compute.linux`, source head `700f3f12…`, server blob `3bb268933763f72bc4987173af0da5e1f38ef27e`, test blob `e321ae37e6c4bf9943691a82662acc30c0162b12`. Provider traffic/hosted CI не было.

Продуктовый `payload/server.py` намеренно не перезаписан через GitHub contents API: доступный интерфейс заменяет весь многотысячный файл, а ручная реконструкция exact source ради двух строк рискованнее, чем сохранить проверенный patch и применить его в среде с нормальным patch/git доступом.

## Дополнительный аудит child lifecycle

Свежий Agent head `700f3f12…` добавляет регрессию «failed rebind keeps old generation». Текущий `ServerSubagentLifecycle._swap_pool()` строит replacement до изменения lifecycle state; если construction падает, старые entrypoint/generation остаются опубликованными. Статический контракт согласуется с новой регрессией; отдельного продуктового изменения здесь не делалось.

## Единственный оставшийся native-Windows blocker/gate

NCM28: установить точный источник оставшегося `PermissionError` в `auth-rollback` на exact Core `b6f4eef…`. Никакие Linux/Wine результаты не считать доказательством Windows-семантики. Не размножать диагностику.

## Следующий порядок

1. Read-only снять результат уже существующего Windows digest workflow, если статус изменился; ничего не запускать.
2. В среде с нормальным git/patch применить опубликованный two-line single-slot patch на свежий exact Agent head, добавить две регрессии `pool_size=1 waits until clear` и `expires by TTL`, затем бесплатно прогнать routing/agent/delegation/server-wiring.
3. Если `server-wiring` проходит локально — материализовать `ServerSubagentLifecycle` в настоящий `payload/server.py` и повторить бесплатные контракты.
4. Затем один настоящий `codex exec` project probe только в уже авторизованной среде без нового hosted CI: реальный файл → локальное действие → конкретный провал verifier → tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем two-slot/failover + restart/recovery незавершённой цепочки без повторения уже выполненного локального side effect.
