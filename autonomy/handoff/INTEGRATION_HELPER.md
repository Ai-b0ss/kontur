# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 00:51 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Свежие product heads на проверенной границе:
- Qwen PR #6: `3bc544c08d6846f9d4d5db1da3076cd81504a6e1`;
- Notion PR #8: `0ca44dd6df901fa848cede6be32e61235a75dcfb`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу владельцев:
- Qwen Core — detached owner authority / V6 alias validation;
- Qwen Reliability — V9 monotonic recovery quarantine;
- Notion Agent — ordinary Responses materialization/dynamic reservation + delegated cancellation/tombstone;
- Notion Core — durable Responses replay/compaction + native Windows rollback.

## Finding A — durable tombstone multiwriter lost-update

Fresh exact Notion blobs:
- `payload/subagent_tombstone_store.py` `6185f502fcdd7ead72237c1a0f3790b114e8a844`;
- `payload/server_subagent_lifecycle.py` `5c9017350100a10e83072cb93f1b7aaced2c9ad7`;
- `payload/server_subagent_runtime.py` `206d8cdfc0897979c981659e9edc378da08f2a78`.

`SubagentTombstoneStore` делает fsync + atomic `os.replace`, но `begin_call/resolve_call/mark_uncertain` строят новый snapshot из per-instance `_uncertain/_inflight`. Общей межпроцессной read-modify-write транзакции нет.

Детерминированный сценарий:
1. A и B загрузили один empty generation;
2. A durably пишет `(child-A, call-A)`;
3. B остаётся со старым пустым memory snapshot;
4. B durably пишет `(child-B, call-B)`;
5. canonical файл содержит только B — marker A потерян.

Verdict: `NOTION_TOMBSTONE_MULTIWRITER_RACE_REPRODUCED_AND_LOCK_CONTRACT_PASS`.

Требование: одна cross-process critical section на весь `read canonical -> validate -> mutate -> fsync/replace -> publish memory`, причём canonical bytes перечитываются уже внутри lock. In-process `asyncio.Lock`, atomic replace без lock и read-before-lock недостаточны. Linux proof-of-contract PASS; конкретная Windows lock/replace семантика не доказана.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_store_concurrent_writer_probe.py`;
- `autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`;
- `autonomy/v3/candidates/NOTION_TOMBSTONE_MULTIWRITER_GUARD_20260822.patch`.

## Finding B — missing tombstone after restart fail-open

Тот же store при любом `FileNotFoundError` создаёт новый пустой generation. Это безопасно только на самом первом install, но runtime не отличает first use от потери уже существовавшего no-replay файла.

Repro:
1. initial empty tombstone создан;
2. `begin_call(child-A, call-A)` durably записан;
3. файл исчезает между process generations;
4. новый runtime видит `FileNotFoundError` и создаёт empty store;
5. `state_uncertain=false`, child-A больше не блокируется.

Verdict: `NOTION_TOMBSTONE_MISSING_RESTART_FAIL_OPEN_REPRODUCED_AND_STRICT_INSTALL_CONTRACT_PASS`.

Требование на стыке Agent ↔ Core: initial empty generation должен создаваться внутри durable install/upgrade transaction до включения subagents. После established install отсутствие файла на runtime restart = `uncertain/fail-closed`, а не автоматическая инициализация. Rollback/upgrade не должен стирать этот no-replay generation.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_missing_restart_probe.py`;
- `autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

Оба finding переданы как regressions/contracts; основные product-файлы PR #8 helper не переписывал.

## Не повторять без изменения продукта

Уже отдельно исследованы: Qwen failover governor account ownership; governor-size accounting для owner prompt + skills; final-turn orphan tool side effect; partial/truncated tool result; failover full-history rebase; durable pending obligation; duplicate unresolved tool ids; stale/total Qwen session recovery; Qwen cross-process session/store races; command/reset races; historical command replay; prompt-policy/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## Постоянная память

Стартовый pointer этого запуска был `8f68e70cfe2143f936409fd4e9165e8dde6a6cb4` -> capsule `20260821T225146Z-2f24453e26`.

После первого finding была опубликована промежуточная v4 capsule `20260822T003922Z-99be32295b`; она теперь сохранена в `PREVIOUS`.

Финальный текущий v4 `LATEST`:
- capsule `20260822T004900Z-01bbd14e89`;
- archive SHA-256 `7cfc2cdaaf7b389f2e124298a2bd9db4b6bad16a6c8e0eca8a3441f3ec26ae2f`;
- 1 part, 1784 chars, part blob `004d2e03177eba60950598ab94ce1976f49635a6`;
- manifest blob `0f11202e134c322fd5ec596e0926695cff04e3bc`;
- `LATEST.json` blob `65ea91b001f8b7b2adfc38d46496b80f55c77676`.

Part и manifest перечитаны после upload и совпали с локально рассчитанными Git blob SHA. Перед каждым переключением `LATEST` выполнялся повторный read; CAS прошёл без force-write. Старый pointer сохранён в `PREVIOUS`.

## Следующее

1. Notion Agent owner должен закрыть оба tombstone gaps согласованно: cross-process mutation transaction + strict missing-file semantics после established install.
2. Regression matrix: `begin A + begin B`, `uncertain A + stale begin B`, `resolve A + concurrent begin B`, established file -> mutating inflight -> file missing -> restart must block.
3. Initial generation согласовать с Core install/rollback; не создавать отдельный Windows CI fanout. Один будущий native Windows gate должен проверить lock/replace/install semantics вместе с уже планируемым Core Windows проходом.
4. После product change helper перепроверяет, иначе эти findings не исследовать заново.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
