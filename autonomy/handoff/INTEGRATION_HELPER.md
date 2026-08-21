# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 02:35 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Перед работой перечитаны `OWNER_INTENT_RU.md`, четыре основных handoff, `CAPSULE_RUNTIME_PROTOCOL_V2.json` и `capsule_runtime_v4.py`.

Свежие product heads:
- Qwen PR #6: `36dcf2424923de926e3e04848ae2e5dfa6402645`;
- Notion PR #8: `b579a51c1f5fd93910f0059d9769f23cfd4c7d06`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать текущую узкую работу основных работников:
- Qwen Core — explicit owner authority durability + offline restart gate;
- Qwen Reliability — только V9 monotonic recovery quarantine поверх уже закрытых V4–V8;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance + текущий delegated tool-loop;
- Notion Core — durable Responses replay/compaction ordering + native Windows rollback gate.

## Новый блок — failover ломает account-local governor accounting

Fresh exact Qwen blobs на head `36dcf242...`:
- `server.js` `09a734ebe7e8abf5b7f63c4cfbd0c9998c79ea78`;
- `src/qwen-client.js` `2ee2c8dac717ffef23b5e21e43d939567e3b7cf0`;
- `src/request-governor.js` `aca56575c799ca03b01b174a2b375807b32e8b4e`;
- `src/quota-telemetry.js` `53aeb46a5c111e3d5e164f6afb83e5582a4bac96`.

Стык Core ↔ Reliability сейчас несогласован:
1. `preparePublicPayloadGoverned()` делает `requestGovernor.before(A, ...)` только для исходного preferred account A.
2. `qwenClient.sendChatRequest()` внутри того же request-wide failover может после CAPTCHA/rate-limit/auth/transport перейти A → B (и далее), причём B перед своим `/chats/new`/completion не получает `requestGovernor.before(B, ...)`.
3. После успеха B сервер перепривязывает `quotaTelemetry` к B.
4. `quotaTelemetry.finish()` отправляет единственный `requestGovernor.success(B, usage)`.

Следствие на простом A→B success:
- provider attempts: `[A, B]`;
- governor admissions: `[A]`;
- final governor outcome: `success(B)`;
- reservation A остаётся pending до TTL;
- B реально получил provider I/O без своей account-local admission/pressure wait/token reservation;
- pressure/error, который выбил A и вызвал failover, не попадает в governor как terminal outcome A.

Offline probe PASS:
`QWEN_FAILOVER_GOVERNOR_ACCOUNTING_GAP_REPRODUCED_AND_CONTRACT_PASS`.

Current semantic reproduction:
- `pendingA=1` после завершения;
- `pendingB=0`;
- `ungovernedProviderAttemptB=true`.

Candidate contract:
- каждый аккаунт, который реально может дойти до provider I/O в request-wide failover, получает собственный governor admission до первого provider call;
- каждый неуспешный account attempt закрывает именно свою admission до перехода к sibling;
- admission финального успешного аккаунта остаётся открытой до появления usage и затем закрывается `success(finalAccount, usage)`;
- outcome одного аккаунта никогда не освобождает reservation другого;
- bounded failover budget, account/thread affinity и существующая provider classification не меняются.

Artifacts:
- `autonomy/v3/tools/integration_qwen_failover_governor_accounting_probe.js`;
- `autonomy/evidence/integration/20260822T0235Z_qwen_failover_governor_account_mismatch.json`;
- `autonomy/v3/candidates/QWEN_FAILOVER_GOVERNOR_ACCOUNTING_20260822.patch`.

Минимальный regression владельцу Qwen:
`A admitted -> A CAPTCHA -> B admitted -> B success -> response finish`.
Обязательные assertions: admissions `[A,B]`; terminal outcomes `failure(A,captcha)` и `success(B,usage)`; pending A/B = 0; ни одного B provider call до `before(B)`; failover budget и account affinity без изменений.

## Предыдущий helper-блок — не повторять

Неполный governor-size accounting для поздно добавляемых exact owner prompt + selected skills уже отдельно найден и сохранён ранее. Его не смешивать с текущим account-failover accounting: первый дефект про размер одной admission, этот — про принадлежность admission/outcome при смене аккаунта.

Также уже зафиксированы и повторно не исследуются без изменения продукта: final-turn orphan tool side effect в Notion; truncated partial tool result; failover full-history rebase; durable pending obligation bypass; duplicate unresolved tool ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; prompt-policy vs upstream thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; rebind overlap/global parallelism; delegated prompt/tool policy; 24-vs-12 turn budget; empty successful Qwen result.

## Постоянная память

Стартовый `INTEGRATION_HELPER/LATEST` прочитан первым:
- pointer Git blob `8f68e70cfe2143f936409fd4e9165e8dde6a6cb4`;
- capsule `20260821T225146Z-2f24453e26`;
- archive SHA-256 `4faaa6d7e2a0a37d3b3bcf9f91fc2524132ce23fb58a693e081ff67b2d7139ed`;
- manifest `a1a12555b44c20e82554cf551db0c0d12a5cb948`;
- 3 parts `8192/8192/2980` chars.

Manifest и три immutable part blobs прочитаны из GitHub. Connector отдаёт exact blob content, но этот запуск пока не объявляет новый v4 checkpoint опубликованным до полного локального `restore -> pack -> immutable upload/readback -> CAS`. Если цепочка не будет завершена, `LATEST` оставлять нетронутым; новые probe/evidence/candidate уже долговечно сохранены отдельно.

## Следующее

1. Qwen owner интегрирует account-attempt governor lifecycle, не смешивая это с V9 monotonic quarantine или owner-authority rewrite.
2. Targeted regression обязательно должен включать A→B и A→B→C, а также final all-failed path, чтобы не осталось двойных settlement или leaked reservations.
3. После этого Integration Helper ищет следующий новый стык; данный finding повторно не исследовать без изменения продукта.

ZERO-MINUTE соблюдён: hosted CI/Cloudflare/live provider/Notion/Codex/production/реальные аккаунты/секреты не использовались.
