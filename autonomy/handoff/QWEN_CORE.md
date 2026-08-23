# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head: `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` действует и перекрывает обычную Circle policy: CircleCI и gate branches не запускать/не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, OWNER_INTENT/CURRENT, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Закрыт серьёзный restart/replay дефект: nested durable session corruption
До исправления exact `src/session-store.js` blob был `5d644421fe8d10aedc571dcbc9ee9652a0422a48`.

Exact hosted reproduction показал три malformed primary record, которые loader ошибочно считал доверенным primary snapshot:
1. `role='assistant-corrupt'` с изменяющим tool-call;
2. `tool_calls:[null]`;
3. `tool_calls:[{id:42,...}]`.

Во всех трёх случаях было `source=primary-or-empty`, `uncertain=false`, старый `chatId` оставался доступным. Это restart/replay риск: повреждение роли/id способно скрыть уже принятый pending tool-call от `findPendingToolCalls()` и разрешить продолжить старый upstream Qwen thread при недостоверной локальной истории.

Дофиксовый proof:
`accepted=unknown-role,null-tool-call,nonstring-tool-id`.

### Исправление и постоянная проверка
- RED regression `scripts/session-store-nested-record-schema-test.js`: commit `7fb0fbb1b046c1d365e8c387b16a7571a613d967`, blob `c48f7beb21dad31d3c5fe4b0a60e8329ddd739c1`;
- root fix: `e0193713378eb7b10e561b6436c06e15fb3dc807`;
- текущий `src/session-store.js` blob: `accd62da1814060069642832326fd3cf280c8156`;
- regression включён в штатный `npm test`: `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`, current `package.json` blob `665d9751ef51c35baafb4b4f94a5aaaab80a4db1`.

Root fix узкий: durable history role только `system|user|assistant|tool`; каждый элемент `tool_calls`, если поле присутствует, обязан быть обычным объектом с непустым строковым `id`; прежняя проверка `tool_call_id` сохранена. Commit diff подтверждает только эти изменения плюс завершающий перевод строки.

### Targeted Core proof на exact текущих bytes
На hosted-машине без provider/CI прошли:
- `QWEN_SESSION_NESTED_RECORD_SCHEMA_PASS malformed=3 backup_fail_closed=3 stale_thread_blocked=3`;
- `QWEN_SESSION_OWNER_AUTHORITY_TYPE_PASS owner_nontext_rejected=2 mode_nontext_rejected=2 exact_string=1 null_owner=1`;
- `SESSION_OWNER_SYSTEM_CHECKPOINT_PASS exact=1 restart=1 bounded_history=1 oversized_fail_closed=1`;
- интеграционный Core restart proof: `QWEN_CORE_SESSION_RESTART_TARGET_PASS pending=1 tool_result_durable=1 owner_prompt=1 stale_backup_fail_closed=1 nested_corruption_fail_closed=3`.

Новый invariant test больше не standalone: он реально входит в обычный `npm test`.

## QWEN_RELIABILITY — не пересекать
Fresh handoff:
- account/cooldown/index/filename cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- оставшийся Reliability proof gap: exact `scripts/provider-safety-test.js` на настоящем locked dependency tree с `axios`.

Core не меняет `account-store`, cooldown или provider-circuit.

## Что осталось до финиша
1. Fresh exact Core cluster на стабильном head: canonical session/restart/stale-backup/pending-tool/owner/subagent tests, насколько exact bytes удаётся материализовать локально.
2. Reliability exact provider-safety proof на тех же product bytes.
3. Full exact-tree Linux `npm test` на стабильном общем SHA.
4. Пока Circle freeze действует — максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.
5. После явной разморозки — один native Windows Server 2022 final gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
6. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness с `QWEN_WINDOWS_READY` либо первым точным blocker; проверить его в native Windows Circle.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Нормативный runtime fresh-read и локально materialized exact:
`6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Предыдущий `LATEST` перед финальной публикацией:
- capsule `20260823T020839Z-962adaf5ec`;
- archive SHA-256 `dac6b8c190a89d6d77a995caeedcd1ad831a4e3247de0c597ef17c81f3bb2781`;
- pointer blob `724ced4314fa1c9397fd9796545b207a5bf52acf`.

Он прошёл exact `verify + restore` перед упаковкой следующего checkpoint.

Текущий нормативный `LATEST`:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

Локально прошли `pack -> verify -> restore`; `CHECKPOINT.md` и `EVIDENCE.txt` после restore побайтно совпали. Immutable upload перечитан:
- manifest blob `bcd6c894c708c14623b56b3692ed84c49dd74827`;
- part-0000 blob `49d172d5d5f31eeb05edc2438af5cf4f03483bd8`;
- part-0001 blob `413f847eaec80b54a5358ef75b1909338dddff71`.

Перед CAS `LATEST` всё ещё имел parent blob `724ced4314fa1c9397fd9796545b207a5bf52acf`. Старый указатель сохранён как `PREVIOUS`; новый `LATEST` опубликован без force-write.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
