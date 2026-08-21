# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 06:30 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежие головы источников

- Qwen PR #6: `73083123db9f3e18ea70fe06397b3bb4c84f83e2`.
- Notion PR #8: `75a4a6de243e22e0df3c15e572e7aa09977d1fcb`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Свежие handoff четырёх основных работников перечитаны перед работой. Их текущие узкие зоны не перехватывались:
- Qwen Core — streaming/session durability на границе checkpoint и исчезнувшего клиента;
- Qwen Reliability — canonical preferred account/cooldown и очистка `operationCandidates()` без потери thread affinity;
- Notion Agent — materialization ordinary Responses dynamic reservation + transport provenance;
- Notion Core — durable rendered parent Responses replay и pending native-Windows auth rollback.

## Новый стыковой дефект — Notion child restart может повторить локальный side effect

Fresh exact blobs на PR #8:
- `payload/delegated_tool_loop.py` = `ee789e92c5c3f63296923fc6584c55a44c082798`;
- `payload/subagent_lifecycle.py` = `c90ff249e2199dcdc43002dfb3277fc60fc63b53`;
- `payload/delegation_policy.py` = `cc50fc7373578262e6051e76716563a98f8f4935`.

Текущий `DelegatedToolLoopSession` держит history, seen call ids, completed model turns и final text только в памяти процесса. `SubagentLifecycle` тоже держит active child identities только в памяти. Поэтому процесс может умереть после того, как локальный `write/edit/shell` уже изменил проект, но до того, как появился долговечный child result/function output. После restart та же логическая дочерняя задача выглядит свежей и может повторить изменение.

Детерминированный offline probe:
1. child `(notion,parent-A,child-1)` принимает mutating tool-call;
2. локальное изменение происходит;
3. моделируется process death до durable tool result;
4. новый процесс запускает ту же логическую child identity как свежую;
5. изменение выполняется второй раз.

Наблюдение текущей семантики: `side_effects = 2`.

Candidate contract probe:
- перед входом в потенциально изменяющий executor долговечно записать `tool_inflight_mutating` + call id/tool name;
- restart переводит такой inflight в `uncertain`;
- автоматический повтор той же parent-scoped identity блокируется;
- `side_effects = 1`.

Материалы:
- `autonomy/v3/tools/integration_notion_delegated_restart_side_effect_probe.py`;
- `autonomy/evidence/integration/20260821T0630Z_notion_delegated_restart_side_effect_gap.json`.

Обязательный контракт для владельца Notion:
1. стабильная identity `(target, parent_turn_id, task_id)` — в согласовании с уже найденным parent-scope gap;
2. долговечное child-state отдельно от provider account/thread state;
3. accepted assistant tool batch сохранить до локального исполнения;
4. mutating tool inflight сохранить до executor;
5. restart: inflight mutating => `uncertain`, без автоматического replay;
6. durable tool result/history сохранить до следующего model call;
7. read-only retry может иметь отдельную доказанную политику; mutating tools нельзя считать безопасно повторяемыми.

Продуктовый PR #8 не переписывался: оставлена только независимая регрессия/evidence для владельца линии.

## Продвинут предыдущий Qwen gap — проверен кандидат межпроцессной сериализации batch store

Свежий `src/subagent-batch-store.js` = blob `f384b57e52d54e298d466b858831eedb2a0dc4f1`. Предыдущим запуском доказан global lost-update: `readState -> clone -> mutate -> whole-file replace` не сериализован между процессами.

В этом запуске добавлен независимый support candidate, не product rewrite. Два настоящих Node-процесса намеренно перекрывали изменения разных batch. Кандидат берёт один store-wide lock ДО `readState` и держит его до atomic replace.

Offline PASS:
- оба независимых update сохранены;
- dead-owner lock восстанавливается через атомарный rename lock-directory, а не blind delete;
- release сверяет PID + random ownership token, поэтому старый releaser не может удалить lock преемника;
- ожидание ограничено timeout и fail-closed.

Материалы:
- `autonomy/v3/tools/integration_qwen_batch_store_interprocess_lock_candidate.js`;
- `autonomy/evidence/integration/20260821T0630Z_qwen_batch_store_interprocess_lock_candidate.json`.

Статус: support candidate, НЕ apply-ready product fix. Linux process semantics доказаны; если выбран именно directory-lock, native Windows semantics ещё требуют отдельного доказательства. Product `src/subagent-batch-store.js` не менялся.

## Ранее доказанные стыки — не дублировать

Сохраняются: Qwen same-task claim race; global store lost-update; process-global tool workspace; persisted workspace identity; Notion rebind global parallelism и same-account overlap; parent-scoped child identity; stable Qwen taskId/batchId/sessionPrefix; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; explicit delegated prompt policy; Notion 24 vs Qwen 12 turns; successful Qwen result с пустым text; selected-skill content fingerprint; delegated tool-capability policy; cross-parent bare task-id conflict.

## Следующий безопасный интеграционный шаг

1. После product store-wide serialization от Qwen-владельца прогнать единый offline restart harness: same task => один executor; unrelated batches не теряют updates; done/uncertain нельзя откатить stale writer; restart не повторяет side effect.
2. Для Notion подготовить минимальный durable child-state design/regression поверх текущего `DelegatedToolLoopSession`, не смешивая его с Notion Core parent Responses replay и provider thread/account state.
3. Затем объединить это с уже подготовленными parent identity / prompt policy / typed result / workspace identity / tool-policy контрактами будущего Notion→Qwen adapter.

## Ограничения и постоянная память

Run-start `LATEST.json`: capsule `20260821T054341Z-e45fead477`, archive SHA-256 `e21ac51d8884aa1970c0cc072e36aa2a1b422379400126ec0bb87cad3f3904b7`, Git blob SHA `ffc3e9d98b387fe9cb9cdb76fae80050027468cd`. Manifest и 7 parts получены отдельно; их длины/SHA совпали, archive size/SHA совпали, workspace восстановлен.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.
