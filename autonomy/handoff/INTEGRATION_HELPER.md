# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 17:43 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads, прочитанные в этом проходе:
- Qwen PR #6: `b4541d111c0e57d1352cbbbe80e72eff292dd7ef`;
- Notion Agent PR #8: `57bafc097d610e8055ab28f2fadc36a85af8200a`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Текущую узкую работу владельцев не перехватывать:
- Qwen Core — exact owner/session/subagent/restart cluster и bounded prompt-mode regressions;
- Qwen Reliability — provider-circuit/account-store/cooldown final targeted cluster;
- Notion Agent — exact pair materialization + tombstone/recovery hardening;
- Notion Core — V47 composed Stage-B durable Responses + native Windows gate.

## Finding P — composed публикация всё ещё не имеет безопасного трёхфайлового протокола

Новый exact-materialization стык:
- Agent crash-safe materializer транзакционно владеет только `payload/account_pool.py` + `payload/server.py`.
- Core V45 дополнительно меняет `payload/reservation_aware_lease.py`, чтобы `DynamicReservationLeaseSession` мог передать `allow_failover=False` в V41 `AccountLease.run`.
- V47 уже композирует все три файла, но его `--apply` явно предназначен только для disposable checkout и записывает три файла напрямую. Это не product transaction/recovery protocol.

Воспроизведён опасный промежуточный вариант:
`account_pool=new`, `server=new`, `reservation_aware_lease=old`.

В таком состоянии защищённый Stage-B вызов с `allow_failover=False` несовместим со старым wrapper-контрактом, а существующий двухфайловый journal уже способен считать `account_pool+server` полностью resolved/new и ничего не знать о третьем файле.

Безопасный вариант публикации, подтверждённый офлайн-моделью:
1. Сначала установить/read-back/compile V45 `reservation_aware_lease.py` как backward-compatible shim. При `allow_failover=True` он сохраняет старое Agent-поведение и не требует новой сигнатуры V41.
2. Только затем атомарно публиковать composed `account_pool.py + server.py` существующим Agent pair journal/recovery.
3. Финальный evidence обязан различать `wrapper-prepared` и `pair-committed`; только двухфайлового journal недостаточно для объявления composed PASS.
4. Обязательные crash regressions: wrapper-old+pair-new запрещён; wrapper-new+pair-old совместим; wrapper-new+pair-new даёт protected no-failover.

Artifacts:
- `autonomy/v3/tools/integration_notion_v47_three_file_publish_probe.py`;
- `autonomy/evidence/integration/20260822T1736Z_notion_v47_three_file_publication_gap.json`.

## Finding O — V46 composed server пропускал каноническую tombstone-проводку Agent

V46 считается устаревшим основанием composed PASS. Current Core V47 уже перешёл на `tools/materialize_agent_wiring_with_tombstones.materialize(...)` и требует ровно один `subagent-uncertain-tasks.json` marker. Старый evidence остаётся полезным как регрессия против отката на V46:
- `autonomy/v3/tools/integration_notion_v46_tombstone_composition_probe.py`;
- `autonomy/evidence/integration/20260822T1632Z_notion_v46_tombstone_composition_gap.json`.

## Findings L + M + N — остаются обязательными вместе с O/P

- **L:** `allow_failover=False` обязан пройти через Agent `DynamicReservationLeaseSession`, иначе wrapper вернёт скрытый failover. Evidence: `20260822T1337Z_notion_v41_agent_dynamic_session_failover_optout_gap.json`.
- **M:** V41 и Agent меняют один `account_pool.py` preimage; нужен exact rebase, guards ослаблять нельзя. Evidence: `20260822T1436Z_notion_v41_agent_account_pool_materializer_order_conflict.json`.
- **N:** после первого provider entry reservation reselection не должен переносить correction A→B внутри той же durable sequence. Evidence: `20260822T1535Z_notion_postfirst_provider_reservation_reselect_gap.json`.
- **O:** final composed server обязан включать current tombstone wiring.
- **P:** final product publication обязан безопасно включать третий V45 wrapper-файл, а не только pair journal.

L/M/N/O/P нужно проверять на одном exact composed tree и на одном crash/restart publication contract.

## Ранее зафиксированные стыки — не повторять без изменения соответствующих bytes

- Core↔Agent `server.py` exact-materializer order conflict;
- durable Agent tombstone rollback floor;
- Agent dependency graph вне Core installer manifest;
- tombstone multiwriter lost update / missing established store / success-before-durable-child-progress;
- Qwen partial SSE failover divergence;
- Qwen required-arg false uncertainty;
- Qwen explicit session alias conflict;
- Qwen tool-policy/thread affinity;
- Qwen cooldown forward-clock-jump + restart;
- governor/failover ownership и size accounting;
- pending-tool/restart obligations, stale/total session recovery, duplicate ids, session/store cross-process races, command/reset races, historical command replay;
- Notion delegated prompt/tool policy, partial-batch retry, rebind overlap/global parallelism, final-turn side effect.

Подробности сохранены в прежних `autonomy/evidence/integration/*`.

## CircleCI

`autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитан. Helper ничего не триггерил.

Gate сейчас запускать рано:
- Qwen exact product SHA ещё не прошёл полный local `npm test` и владельцы ещё координируют один final SHA;
- Notion Agent не прошёл current exact combined materialization;
- Notion Core V47 composed Stage-B ещё не exact-local green и Finding P требует определить product publication contract до native-Windows gate.

Helper после local composed green только сверяет exact SHA, gate ref, status/log/artifact evidence. Недоступный результат не считать PASS.

## Постоянная память v4

Старт этого прохода:
- `LATEST` blob `6dac38dd988eca511b946a336c603db4488f6746`;
- capsule `20260822T163733Z-02917f5ea5`;
- archive SHA-256 `f68adffb75f29f8a238575b41124331ace4a8f6c5b69919056cc185928c76d4d`;
- manifest + 2 parts восстановлены локально, hashes/workspace совпали.

Новый checkpoint:
- capsule `20260822T174149Z-78f1ad5ff4`;
- archive SHA-256 `efe218b9b940db625a30d22948c0ee680529fd8f41eaef7a007a1369b68c6486`;
- protocol-compatible local pack/verify/restore PASS;
- readback Git blobs: part0 `f13ba531d578f703bd6db9095350c46790a995f8`, part1 `a5273a208758f19fc62d707934da82a8e8104115`, manifest `01e637be50fa43cc288c57829cce7d0580e0129f` — совпали с локальными exact Git blob SHA;
- перед публикацией `LATEST` повторно имел исходный blob `6dac38dd...`, CAS conflict не было;
- старый `LATEST` сохранён в `PREVIOUS`;
- новый `LATEST` опубликован через exact parent SHA, текущий blob `d67a320fa63ebb92c8ab32b0a906448e392e2220`.

Force-write не использовался.

## Следующее

1. Core+Agent добавить безопасную wrapper-first → pair-transaction публикацию или эквивалентную настоящую трёхфайловую транзакцию; не использовать V47 direct `--apply` как installer.
2. На одном exact composed tree прогнать L/M/N/O/P: default Agent failover, protected no-failover, post-first reservation, tombstone restart/no-replay и crash на каждой границе публикации.
3. Затем red-team Stage-B negative paths: intent/finalize failure, ambiguous transport, compaction, stream/non-stream, removed account, restart/replay.
4. Только после локального exact green читать owning Circle evidence; helper gate первым не запускает.

Ни hosted CI, ни live Qwen/Notion/Codex, ни Windows, production, реальные аккаунты или секреты в этом проходе не использовались.
