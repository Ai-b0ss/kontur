# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 00:47 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Перед работой перечитаны `OWNER_INTENT_RU.md`, четыре основных handoff, `CAPSULE_RUNTIME_PROTOCOL_V2.json`, `capsule_runtime_v4.py` и свежие PR.

Свежие product heads на момент проверки:
- Qwen PR #6: `3bc544c08d6846f9d4d5db1da3076cd81504a6e1`;
- Notion PR #8: `0ca44dd6df901fa848cede6be32e61235a75dcfb`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу основных работников:
- Qwen Core — malformed/ambiguous detached owner authority и V6 alias validation;
- Qwen Reliability — V9 monotonic recovery quarantine поверх уже закрытых V4–V8;
- Notion Agent — ordinary Responses materialization/dynamic reservation + новая durable delegated cancellation/tombstone линия;
- Notion Core — durable Responses replay/compaction ordering + native Windows rollback gate.

## Новый блок 1 — Notion durable tombstone store теряет marker при нескольких владельцах файла

После предыдущего Integration Helper checkpoint Notion PR #8 ушёл вперёд на 32 коммита и добавил новый `payload/subagent_tombstone_store.py`. Именно свежая дельта теперь обеспечивает durable `begin_call -> local mutating tool -> resolve/uncertain` защиту через process restart.

Fresh exact blobs:
- `payload/subagent_tombstone_store.py` `6185f502fcdd7ead72237c1a0f3790b114e8a844`;
- `payload/server_subagent_lifecycle.py` `5c9017350100a10e83072cb93f1b7aaced2c9ad7`;
- `payload/server_subagent_runtime.py` `206d8cdfc0897979c981659e9edc378da08f2a78`.

Новый store безопасно делает fsync + atomic `os.replace`, но каждая инстанция держит `_uncertain`/`_inflight` в памяти и при `begin_call/resolve_call/mark_uncertain` строит новый snapshot именно из этой локальной копии. Общей межпроцессной read-modify-write сериализации нет.

Детерминированное offline воспроизведение:
1. store A и store B загружают один durable empty generation;
2. A делает `begin_call(child-A, call-A)` — canonical файл содержит A;
3. B всё ещё имеет старый пустой memory snapshot;
4. B делает `begin_call(child-B, call-B)` — atomic replace успешен, но canonical файл теперь содержит только B;
5. marker A исчезает, хотя mutating child A уже мог перейти side-effect boundary.

Verdict:
`NOTION_TOMBSTONE_MULTIWRITER_RACE_REPRODUCED_AND_LOCK_CONTRACT_PASS`.

Безопасный контракт проверен на Linux-модели: весь `read current -> validate -> mutate -> fsync/replace -> publish memory` выполняется под одним общим межпроцессным lock; второй writer перечитывает canonical bytes уже внутри lock. Тогда оба marker сохраняются. `fcntl` использован только как proof-of-contract; в продукт его напрямую переносить нельзя, потому что Windows-семантика должна быть доказана нативно.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`;
- `autonomy/v3/candidates/NOTION_TOMBSTONE_MULTIWRITER_GUARD_20260822.patch`.

## Новый блок 2 — исчезнувший tombstone-файл после restart молча считается первым запуском

У того же свежего store есть отдельная fail-open граница на стыке Agent ↔ Core lifecycle. `_load_or_initialize()` при любом `FileNotFoundError` создаёт новый пустой generation. Это правильно только на самом первом установочном запуске, но runtime не умеет отличить его от потери уже существовавшего durable no-replay файла.

Детерминированное offline воспроизведение:
1. runtime создаёт initial empty `subagent-uncertain-tasks.json`;
2. `begin_call(child-A, call-A)` надёжно фиксируется;
3. файл исчезает между поколениями процесса — например из-за ошибочного rollback/cleanup/deletion;
4. новый runtime видит `FileNotFoundError`, снова создаёт пустой store;
5. `state_uncertain=false`, `child-A` больше не блокируется.

Verdict:
`NOTION_TOMBSTONE_MISSING_RESTART_FAIL_OPEN_REPRODUCED_AND_STRICT_INSTALL_CONTRACT_PASS`.

Правильная граница должна быть совместной с Core/install lifecycle: initial empty generation надо создавать в доказанном durable install/upgrade transaction до включения subagents. После того как installation established, отсутствие этого файла на runtime restart должно означать `uncertain/fail-closed`, а не «первый запуск». Upgrade/rollback тоже не должен законно стирать established no-replay generation.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_missing_restart_probe.py`;
- `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

Native Windows для lock/replace/install semantics НЕ заявлен: оба исправления надо совместить с одним будущим разрешённым Windows Core gate, а не плодить отдельный CI fanout.

Основные product-файлы PR #8 не менялись, чтобы не конфликтовать с активным Notion Agent worker.

## Предыдущие helper-блоки — не повторять без изменения продукта

Уже отдельно зафиксированы: Qwen failover account-local governor accounting; governor-size accounting для поздно добавляемых owner prompt + skills; final-turn orphan tool side effect в Notion; truncated partial tool result; failover full-history rebase; durable pending obligation bypass; duplicate unresolved tool ids; stale/total session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy vs upstream thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; 24-vs-12 turn budget; empty successful Qwen result.

## Постоянная память

Стартовый `INTEGRATION_HELPER/LATEST`:
- pointer Git blob `8f68e70cfe2143f936409fd4e9165e8dde6a6cb4`;
- capsule `20260821T225146Z-2f24453e26`;
- archive SHA-256 `4faaa6d7e2a0a37d3b3bcf9f91fc2524132ce23fb58a693e081ff67b2d7139ed`.

После блока 1 опубликована новая проверенная v4-капсула:
- capsule `20260822T003922Z-99be32295b`;
- archive SHA-256 `f6aef8b34bdba7addf2adf66c9f1c6f28e975be0e1d5e3bda79e5717a6ea649d`;
- manifest blob `fe5937c0acbdfecf1eb7bd44980488c83cc05003`;
- part blobs `b1f72a41dca8f6801889268790b857aba263490a`, `5dc5b17b42a803787d2d310b961ece7453c926eb`, `c6252bf839fda8fdc30832a0df7a631ba404dff0`;
- old LATEST preserved as PREVIOUS;
- CAS succeeded from exact parent blob `8f68e70c...`;
- new `LATEST.json` blob `0e8682704ee36d16003302bcdbd407a5401fc377`.

Все три uploaded parts и manifest были перечитаны; Git blob SHA совпали с локально рассчитанными байтами. Блок 2 дополнительно долговечно сохранён отдельным probe/evidence после этой capsule publication; следующий запуск должен включить его в следующую v4-капсулу, а не менять уже immutable `20260822T003922Z-99be32295b`.

## Следующее

1. Notion Agent owner закрывает оба tombstone gaps согласованно: cross-process transaction для mutation + strict missing-file semantics после established install.
2. Минимальные регрессии: две независимые store instances/processes; `begin A + begin B`; `uncertain A + stale begin B`; `resolve A + concurrent begin B`; established file -> begin mutating call -> file missing -> restart must block.
3. Initial empty generation должен появляться из Core/install transaction, а не самовольно из runtime после того, как система считается установленной.
4. Один будущий native Windows gate проверяет locking + replace + install/rollback вместе с уже планируемым Core Windows проходом.
5. Integration Helper после этого ищет следующий новый стык; эти findings повторно не исследовать без изменения продукта.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
