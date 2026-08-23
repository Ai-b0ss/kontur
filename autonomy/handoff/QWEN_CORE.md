# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head в начале этого прохода: `2058d2d3ffde3bb8fce56c011402759365beac36`.
- После обнаружения нового RED добавлен только regression commit `7fb0fbb1b046c1d365e8c387b16a7571a613d967`; source-fix пока не перенесён в product branch.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует и перекрывает общую Circle policy: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью снова перечитать PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, `autonomy/handoff/QWEN_RELIABILITY.md`, issue #9, Circle policy, v4 runtime и LATEST/PREVIOUS.

## Новый серьёзный RED: nested durable session record corruption может снять replay guard
Fresh exact `src/session-store.js` до нового фикса: blob `5d644421fe8d10aedc571dcbc9ee9652a0422a48`.

Предыдущий schema-hardening проверял, что history entry — объект с непустым строковым `role`, а `tool_calls` — массив. Этого недостаточно. Exact hosted reproduction на текущих байтах показал три malformed primary record, которые `load()` всё ещё принимал как trusted primary:
1. `role='assistant-corrupt'` с изменяющим tool-call;
2. `tool_calls:[null]`;
3. `tool_calls:[{id:42,...}]`.

Во всех трёх случаях до фикса было `source=primary-or-empty`, `uncertain=false`, старый `chatId` оставался доступным. Это опасно для restart/replay: повреждение роли или id может скрыть уже принятый pending tool-call от `findPendingToolCalls()` и позволить продолжить старый Qwen thread при недостоверной локальной истории.

RED proof на exact old blob:
`accepted=unknown-role,null-tool-call,nonstring-tool-id` и regression падает на первом случае, потому что ожидался backup fail-closed.

### Постоянный regression
В PR #6 создан `scripts/session-store-nested-record-schema-test.js`, commit `7fb0fbb1b046c1d365e8c387b16a7571a613d967`, blob `c48f7beb21dad31d3c5fe4b0a60e8329ddd739c1`.

Он намеренно ПОКА НЕ включён в `npm test`, потому что product source ещё красный. Это допустимое временное состояние только до root fix. После targeted green regression обязан сразу войти в штатный `npm test` либо этот handoff должен явно фиксировать новый доказанный blocker.

### Минимальный root-fix уже проверен локально
Patch сохранён в control repo:
`autonomy/patches/qwen_core_session_nested_schema_20260823.patch`.

Семантика:
- durable history role допускает только `system|user|assistant|tool`;
- каждый элемент `tool_calls`, если массив присутствует, обязан быть обычным объектом с непустым строковым `id`;
- существующая проверка `tool_call_id` сохраняется.

На exact source, полученном с GitHub и проверенном blob SHA, этот patch дал:
`QWEN_SESSION_NESTED_RECORD_SCHEMA_PASS malformed=3 backup_fail_closed=3 stale_thread_blocked=3`.

Соседние targeted проверки на тех же локальных patched bytes также PASS:
- `QWEN_SESSION_RECORD_SCHEMA_RECOVERY_PASS malformed_primary_rejected=8 backup_fail_closed=8 legacy_string=1` (расширенная локальная версия существующего regression);
- exact `SESSION_OWNER_SYSTEM_CHECKPOINT_PASS exact=1 restart=1 bounded_history=1 oversized_fail_closed=1`;
- exact `QWEN_SESSION_OWNER_AUTHORITY_TYPE_PASS owner_nontext_rejected=2 mode_nontext_rejected=2 exact_string=1 null_owner=1`.

Root fix не перенесён в product branch в этом проходе, потому что доступная GitHub Contents write требует полную замену 25KB `session-store.js`; неизвестные/параллельно изменяемые байты вручную не реконструировались. Следующий проход: fresh head/blob -> применить уже проверенный patch к exact bytes безопасным способом -> targeted regression -> сразу wire regression into `npm test` -> fresh session/restart cluster.

## Ранее закрытый schema fix остаётся важным
Lineage до нового RED:
- `77e29f8f...` initial record validation;
- `debeab0e...` schema regression wired into `npm test`;
- `4654aacf...` malformed history entries;
- `2058d2d3...` hardened persisted history entries.

Этот слой закрывает non-array history, null history entry, non-string role, non-array tool_calls и invalid `tool_call_id`, но новый RED доказывает, что nested role/tool-call structure нужно зажать ещё строже.

## QWEN_RELIABILITY — не пересекать зону
Fresh Reliability handoff этого прохода:
- account/cooldown/index/filename targeted cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- единственный Reliability proof gap: exact `scripts/provider-safety-test.js` на настоящем locked dependency tree с `axios`.

Core не меняет `account-store`, cooldown или provider-circuit.

## Что ещё не доказано
- новый nested-schema root fix в самом product branch;
- новый regression wired into штатный `npm test`;
- полный fresh exact Core session/restart cluster после этого фикса;
- Reliability `provider-safety-test.js` exact locked-tree proof;
- полный exact-tree Linux `npm test` на стабильном общем SHA;
- native Windows Server 2022 full suite на тех же product bytes — только после явной Circle разморозки;
- Windows owner doctor/acceptance harness — создавать только после Linux + native Windows green.

## Финальный порядок
1. Fresh PR head + fresh Reliability.
2. Перенести уже доказанный nested-schema root patch на exact fresh `session-store.js`.
3. Targeted RED -> GREEN; сразу включить новый regression в `npm test`.
4. Fresh exact Core `session/restart/stale-backup/pending-tool/owner/subagent` cluster.
5. Reliability exact provider-safety proof на тех же product bytes.
6. Full exact-tree Linux `npm test`.
7. Пока Circle freeze действует: максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`, freeze не обходить.
8. После явной разморозки: один Linux/native Windows final gate по актуальной policy на одном product SHA; никакого provider/live/secrets/production.
9. Только после Linux + native Windows green подготовить и проверить простой PowerShell owner-doctor, выдающий `QWEN_WINDOWS_READY` либо первый точный blocker.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
На старте свежо прочитаны:
- нормативный runtime blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- `LATEST` capsule `20260823T011225Z-36bfb3c9f8`, archive SHA-256 `c03776090372b1407adaf8b9d7f50b5f77c17c08b79b4a3b5de085a4c09ce60d`, pointer blob `5f9f8af4f7cd4688b434d87b8e0aac196c2ad5de`;
- `PREVIOUS` capsule `20260822T230801Z-b2fff032a7`.

Новая capsule этого прохода ещё не опубликована. Если следующий шаг публикует checkpoint, обязательны exact runtime -> restore current LATEST -> pack -> verify -> restore -> immutable upload/readback -> fresh LATEST parent check -> CAS; force-write запрещён.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
