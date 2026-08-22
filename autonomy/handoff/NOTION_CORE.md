# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим и Windows

Сначала exact-source Linux/Python проверки. Production, секреты и живой Notion/Codex не трогать до локальных safety gates.
CircleCI использовать только как bounded final evidence через disposable `ci/notion-core-windows-final-gate` после exact-local composed green. Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать.

Fresh read этого прохода: все пять исторических checks (`auth/codex/migration/runtime/outside-digest`) всё ещё `pending`; это не PASS и не текущий final gate.

## Постоянная память v4

Fresh canonical `LATEST`:
- capsule `20260822T194513Z-61fd941485`;
- archive SHA-256 `eb9e5f87f4618d63058e67fd2c3a467eff8ffb7e448e85567ddb32914b1ada3b`;
- pointer blob `ae813ed8e6810557ab3457cd8b634fc5e36bfa58`.

LATEST/PREVIOUS/CAS обязательны. Unknown bytes не реконструировать; force-write запрещён.

## Stage A — закрыт

`V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.
Legacy-state v2 `unsupported/corrupt/persistence_blocked` после load/get fail-closed до Notion и в `/v1/responses`, и в `/v1/responses/compact`. Новый durable-state epoch нельзя вводить без этого rollback floor.

## Stage B store — зелёная основа

`V34_V35_EXACT_CLASS_INTEGRATED_PASS`:
- отдельный strict `provider_intent`;
- exact durable replay с сохранёнными IDs;
- restart;
- detached `get()`;
- duplicate unresolved fail-closed;
- forced NCM28 final-write failure сохраняет intent и блокирует persistence;
- TTL cleanup + replay-unavailable tombstone.

Целевой порядок Core:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## Agent no-replay blocker — исправлен и локально доказан

Старый V49-статус «ждём Agent fix» УСТАРЕЛ.

Fresh exact history после regression `78e0642002af6e8eafa6a7fcafe5dae134a99ae2`:
- product fix `a22c1ff43c6e997a863a7cd9e022243341388566` — durable `<state>.pending` guard вокруг canonical replace;
- regression strengthening `678696f2590e76e7d7ff48d7325df05e53698e0b`;
- safe pre-replace recovery semantics `97bcec500757afcc412cb4fb0d866acdd58b1478`;
- stale/symlink/hardlink restart coverage `f588e9706e69ab84965099190323bbfbde6bd557`;
- current head `ee0ae241...` меняет только текст ожиданий cancellation lifecycle, no-replay assertions не ослаблены.

Fresh `NOTION_AGENT.md` сообщает локальные exact результаты:
- tombstone + mandatory regression + guard-path cluster: `16/16 PASS`;
- focused server restart/tombstone integration: `2/2 PASS`;
- delegated cancellation lifecycle: `4/4 PASS`.

Exact current blobs, обязательные для следующей композиции:
- `payload/subagent_tombstone_store.py` — `c2a3f8e74a94b15325423bfdb8f3437141233996`;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` — `0dc3e95cb987da326b63712c981138e8f1c976e1`;
- `tests/test_delegated_cancellation_lifecycle.py` — `142ec6c64366c195aca8c8d8d615bd17062a6592`;
- `tests/test_subagent_tombstone_store.py` — `7c383e234cfa8828db753caa89145f11546d0d2f`;
- `tests/test_server_subagent_tombstone_restart.py` — `aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee`.

## V50 — current exact composition materializer

Новый materializer:
`autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`
Git blob: `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

Он заменяет stale V49 wait и поверх V48:
1. требует exact checkout PR #8 head `ee0ae241...`;
2. замораживает current fixed tombstone store + mandatory regressions/restart tests;
3. замораживает Core preimages:
   - `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
   - `payload/account_pool.py` `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
   - `payload/reservation_aware_lease.py` `c77b4d5214911def1729243516aec73e43f8d425`;
   - `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
4. вызывает V48, который отдельно фиксирует пять current Agent transformation helpers и выполняет Agent pair/tombstone materialization + V41/V45;
5. fresh-verifies exact Codex probe/test preimages и обязательный shell-env patch;
6. в `--apply` режиме применяет shell-env patch только после `git apply --check`, компилирует изменённые Python-файлы и печатает readback blob hashes.

Сам V50 до публикации прошёл `py_compile` и CLI smoke. Его Git readback blob совпал с локально рассчитанным. **Это ещё не composed PASS**: exact checkout PR #8 в текущем контейнере не материализован, поэтому V50 `check/apply` и объединённая матрица ещё обязательны.

## V41–V45 — доказанные границы

- V41: `AccountLease.run(..., allow_failover=True)`; default сохраняет Agent failover, protected Core после intent использует `false`.
- V42: protected transport error выходит напрямую и не попадает в старый outer retry через `AccountPoolExhausted`.
- V43: protected mode обязателен для initial/continuation Responses, planner correction и compaction.
- V44: stream/non-stream — только проекции одного уже долговечно сохранённого canonical Responses object; disconnect после provider-entered не отменяет commit-critical task.
- V45: `allow_failover=false` должен проходить через `DynamicReservationLeaseSession.run_selected/run` и one-shot wrappers.

## Codex shell-env safety — preimage fresh

Fresh exact current source всё ещё:
- `tools/run_real_codex_cli_project_probe.py` blob `2f6d5873606975771b5ab418d5f9d45cd602304c`;
- `tests/test_real_codex_cli_probe_contract.py` blob `2958fac16ecf6ded815c6dfc12aa1060319a62e8`.

Current source не содержит shell environment policy. Обязательный patch остаётся exact-applicable по preimage:
`autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`, blob `5ae2079725886a180e130cfbb729365be56d8b59`.

Требуемая политика до live:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

V50 проверяет эти preimages и patch до композиции и применяет patch только в disposable `--apply` checkout.

## Обязательная composed матрица

На одних и тех же V50-composed bytes прогнать:
- Agent pair-materializer/journal/backup/recovery/tombstone/dynamic-reservation;
- V41/V45 protected no-failover;
- Stage-B strict intent/finalize;
- canonical Responses + compaction;
- retry/restart/exact replay;
- stream/non-stream/disconnect;
- ambiguous transport;
- removed persisted account без ghost reservation/подмены;
- TTL/size/oversize/stale retry (>32);
- legacy/rollback floor;
- shell-env contract.

Не объявлять composed PASS по отдельным старым зелёным тестам.

## Fresh publication boundary — 2026-08-23 01:xx MSK

Контроллер правильно заметил, что GitHub connector теперь имеет lossless low-level путь `create_blob -> create_tree -> create_commit -> update_ref(force=false)`. Это закрывает техническую проблему атомарного Git-коммита, но **не снимает текущий owner freeze на CircleCI**.

Fresh exact `.circleci/config.yml` PR #8 показывает, что любой обычный push именно в `autonomy/notion-prompt-modes-20260819` соответствует пяти Linux workflows (`agent-contracts`, `server-wiring-rehearsal`, `prompt-contracts`, `routing-contracts`, `delegation-contracts`). Поэтому сейчас нельзя просто сдвинуть ref PR #8 materialized-pair коммитом: такой push способен запустить Circle и нарушить более свежий прямой запрет владельца.

CircleCI документирует `[ci skip]`, но тип текущей GitHub↔Circle интеграции в этом проходе не доказан; при owner freeze не использовать skip-tag как неподтверждённый обход запрета.

Fresh Agent v4 capsule `20260822T220058Z-f18a1b833d` тоже не является byte bridge для pair: её manifest содержит только `CHECKPOINT.json` и `README.md`, а не materialized `payload/account_pool.py`/`payload/server.py`. Поэтому hashes `c9ca6f3b...` / `ba52edc7...` доказаны, но сами exact transformed bytes сейчас не лежат в долговечном handoff-объекте, доступном Core без повторной материализации.

Безопасный путь до снятия Circle freeze:
1. не двигать PR #8 ref;
2. заново получить exact transformed pair на disposable local executor из frozen preimages/toolchain и проверить blobs `c9ca6f3b...` / `ba52edc7...`;
3. сохранить сами exact transformed bytes в v4 capsule/другом долговечном content-addressed handoff (или создать Git blobs/tree/commit без обновления ref — это не VCS push event);
4. Core собирает и гоняет composition/Stage-B на этих байтах;
5. после явной owner-разморозки Circle — один fast-forward product ref update и только затем финальные disposable gates.

Дополнительная обязательная поправка финального экзамена: `tests/test_subagent_tombstone_post_replace_sync_failure.py` существует и локально зелёный, но текущие штатные Circle Agent suites его не запускают. Финальный composed local suite и будущий disposable gate обязаны включить этот regression явно; зелёный gate без него не считать приёмкой.

## Следующий порядок

1. Materialize exact PR #8 `ee0ae241...` в disposable checkout **без сдвига product ref во время Circle freeze**.
2. Запустить V50 без `--apply`; любой blob/head mismatch = STOP и fresh re-freeze, а не patch-by-guess.
3. На копии выполнить V50 `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core cluster выше; исправлять только воспроизводимый корневой дефект.
5. Зафиксировать exact materialized/composed bytes долговечно через v4/CAS; не публиковать их в Circle-triggering product ref до явной разморозки владельца.
6. После явной owner-разморозки: fast-forward exact product materialization, readback; затем один disposable `ci/notion-core-windows-final-gate` и bounded native Windows Server 2022 proof с exact logs/artifacts.
7. Windows FAIL считать реальным дефектом; повторять только после релевантного изменения байтов. Старые pending/no-step результаты не считать PASS.
8. После Windows PASS — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с доказанным stable conversation id через initial/tool-result/retry/restart.
9. После composed+Windows green собрать и на том же native Windows gate проверить owner-facing PowerShell doctor, который выдаёт `NOTION_WINDOWS_READY` либо первый точный blocker и не печатает секреты.

Product PR #7/#8, live Notion/Codex, секреты и пользовательские данные в текущем Core-проходе не менялись.
