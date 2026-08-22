# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 00:33 UTC.

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

## Новый блок — Notion durable tombstone store теряет marker при нескольких владельцах файла

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

Current result:
- после A: `[(child-A, call-A)]`;
- после stale writer B: `[(child-B, call-B)]`;
- marker `child-A/call-A` потерян.

Безопасный контракт проверен на Linux-модели: весь `read current -> validate -> mutate -> fsync/replace -> publish memory` выполняется под одним общим межпроцессным lock; второй writer перечитывает canonical bytes уже внутри lock. Тогда оба marker сохраняются. `fcntl` использован только как proof-of-contract; в продукт его напрямую переносить нельзя, потому что Windows-семантика должна быть доказана нативно.

Почему это стыковой дефект: одна `ServerSubagentLifecycle` действительно владеет store внутри обычного процесса, но durable store специально введён ради restart/relaunch. При кратком перекрытии старого и нового bridge-процесса или при двух владельцах одного tombstone path atomic replace сам по себе не предотвращает stale lost-update. Это может снять no-replay защиту ровно после уже начатого локального `write_file/edit_file/run_shell`.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`;
- `autonomy/v3/candidates/NOTION_TOMBSTONE_MULTIWRITER_GUARD_20260822.patch`.

Минимальный regression владельцу Notion Agent:
- создать две независимые store instances на одном path до первой записи;
- A `begin_call(A,a)`;
- B `begin_call(B,b)`;
- fresh third instance обязан видеть ОБА markers;
- аналогично `mark_uncertain(A)` не должен быть стёрт stale `resolve/begin` другого writer;
- финальная реализация должна иметь одну cross-process mutation transaction; in-process `asyncio.Lock` недостаточен;
- Windows locking/replace behavior не заявлять до native gate.

Основные product-файлы PR #8 не менялись, чтобы не конфликтовать с активным Notion Agent worker.

## Предыдущие helper-блоки — не повторять без изменения продукта

Уже отдельно зафиксированы: Qwen failover account-local governor accounting; governor-size accounting для поздно добавляемых owner prompt + skills; final-turn orphan tool side effect в Notion; truncated partial tool result; failover full-history rebase; durable pending obligation bypass; duplicate unresolved tool ids; stale/total session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy vs upstream thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; 24-vs-12 turn budget; empty successful Qwen result.

## Постоянная память

Стартовый `INTEGRATION_HELPER/LATEST` прочитан первым:
- pointer Git blob `8f68e70cfe2143f936409fd4e9165e8dde6a6cb4`;
- capsule `20260821T225146Z-2f24453e26`;
- archive SHA-256 `4faaa6d7e2a0a37d3b3bcf9f91fc2524132ce23fb58a693e081ff67b2d7139ed`;
- manifest `a1a12555b44c20e82554cf551db0c0d12a5cb948`;
- 3 parts `8192/8192/2980` chars.

Manifest и part metadata перечитаны. В этой среде connector возвращает exact blob content, но не монтирует его как локальный файл; поэтому нормативный `capsule_runtime_v4.py restore` старой капсулы в файловой системе не был объявлен выполненным. По протоколу рабочей нижней точкой стали exact свежие GitHub source blobs. Новый `LATEST` не переключать без полного `restore -> checkpoint -> pack -> immutable upload/readback -> CAS`.

Новые probe/evidence/candidate уже долговечно сохранены отдельными immutable путями, поэтому finding не зависит от локального `/mnt/data`.

## Следующее

1. Notion Agent owner должен закрыть multiwriter lost-update до включения реального child-launch/restart path: общий cross-process transaction или эквивалентный доказанный CAS/lock.
2. Сначала Linux regression на две независимые store instances/processes, затем один native Windows locking gate вместе с уже планируемым Windows Core проходом; не строить отдельный CI fanout.
3. После product fix проверить `begin A + begin B`, `uncertain A + stale begin B`, `resolve A + concurrent begin B`, crash while lock held/recovery semantics.
4. Integration Helper после этого ищет следующий новый стык; этот finding повторно не исследовать без изменения продукта.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
