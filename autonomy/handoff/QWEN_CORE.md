# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после этого прохода: `7fb0fbb1b046c1d365e8c387b16a7571a613d967`.
- На product head добавлен только новый RED-regression; source-fix пока не перенесён.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует и перекрывает обычную Circle policy: CircleCI и gate branches не запускать/не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, OWNER_INTENT/CURRENT, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Новый серьёзный RED: nested durable session corruption может снять replay guard
Исходный exact `src/session-store.js` blob: `5d644421fe8d10aedc571dcbc9ee9652a0422a48`.

Exact hosted reproduction показал три malformed primary record, которые loader всё ещё считал доверенным primary snapshot:
1. `role='assistant-corrupt'` с изменяющим tool-call;
2. `tool_calls:[null]`;
3. `tool_calls:[{id:42,...}]`.

Во всех трёх случаях до фикса было `source=primary-or-empty`, `uncertain=false`, старый `chatId` оставался доступным. Это restart/replay риск: повреждение роли/id способно скрыть уже принятый pending tool-call от `findPendingToolCalls()` и разрешить продолжить старый upstream Qwen thread при недостоверной локальной истории.

Дофиксовый proof на exact source:
`accepted=unknown-role,null-tool-call,nonstring-tool-id`.

### Постоянный RED-regression
`qwen-free-api/scripts/session-store-nested-record-schema-test.js`
- commit `7fb0fbb1b046c1d365e8c387b16a7571a613d967`;
- blob `c48f7beb21dad31d3c5fe4b0a60e8329ddd739c1`.

Он намеренно пока НЕ включён в `npm test`: product source красный. После root-fix targeted green его надо немедленно подключить в штатный `npm test`; не оставлять standalone.

### Root-fix кандидат уже проверен
Patch: `autonomy/patches/qwen_core_session_nested_schema_20260823.patch`.

Семантика:
- durable history role только `system|user|assistant|tool`;
- каждый элемент `tool_calls` обязан быть обычным объектом с непустым строковым `id`;
- существующая проверка `tool_call_id` сохраняется.

На exact GitHub source + patch локально PASS:
- `QWEN_SESSION_NESTED_RECORD_SCHEMA_PASS malformed=3 backup_fail_closed=3 stale_thread_blocked=3`;
- расширенная локальная версия старого schema regression: `malformed_primary_rejected=8 backup_fail_closed=8 legacy_string=1`;
- exact `SESSION_OWNER_SYSTEM_CHECKPOINT_PASS exact=1 restart=1 bounded_history=1 oversized_fail_closed=1`;
- exact `QWEN_SESSION_OWNER_AUTHORITY_TYPE_PASS owner_nontext_rejected=2 mode_nontext_rejected=2 exact_string=1 null_owner=1`.

Почему source-fix ещё не в product: доступный Contents-write требует полную замену ~25KB `session-store.js`; в этом проходе большой активно меняющийся файл не реконструировался вручную для записи. Следующий проход должен fresh-read head/blob и применить уже доказанный минимальный patch к exact bytes безопасным способом.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- оставшийся Reliability proof gap: exact `scripts/provider-safety-test.js` на настоящем locked dependency tree с `axios`.

Core не меняет `account-store`, cooldown или provider-circuit.

## Что осталось до финиша
1. Перенести nested-schema root patch в product branch.
2. Новый RED -> GREEN и сразу wire regression в `npm test`.
3. Fresh exact Core cluster: session/restart/stale-backup/pending-tool/owner/subagent.
4. Reliability exact provider-safety proof на тех же product bytes.
5. Full exact-tree Linux `npm test` на стабильном общем SHA.
6. Пока Circle freeze действует — максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.
7. После явной разморозки — один native Windows Server 2022 final gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
8. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness с `QWEN_WINDOWS_READY` либо первым точным blocker; проверить его в native Windows Circle.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Нормативный runtime fresh-read и локально materialized exact:
`6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Входной `LATEST`:
- capsule `20260823T011225Z-36bfb3c9f8`;
- archive SHA-256 `c03776090372b1407adaf8b9d7f50b5f77c17c08b79b4a3b5de085a4c09ce60d`;
- pointer blob `5f9f8af4f7cd4688b434d87b8e0aac196c2ad5de`.

Входная capsule прошла exact `verify + restore`.

Новая нормативная capsule:
- `20260823T020839Z-962adaf5ec`;
- archive SHA-256 `dac6b8c190a89d6d77a995caeedcd1ad831a4e3247de0c597ef17c81f3bb2781`;
- source_ref `7fb0fbb1b046c1d365e8c387b16a7571a613d967`.

Локально прошли `pack -> verify -> restore`; `CHECKPOINT.md` и `EVIDENCE.txt` после restore побайтно совпали. Immutable upload перечитан:
- manifest blob `64181b0f084cef9b1c1be8cf6a2d030b61784c9a`;
- part-0000 blob `070484f82f8971dae1af39f8e0050d86edc3b8c4`;
- part-0001 blob `1f9bf1275bb8997e226a4663df8c10e5e66ab1d6`.

Перед CAS `LATEST` всё ещё имел исходный blob `5f9f8af4...`. Старый указатель сохранён как `PREVIOUS`; новый `LATEST` опубликован без force-write и имеет blob `724ced4314fa1c9397fd9796545b207a5bf52acf`.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
