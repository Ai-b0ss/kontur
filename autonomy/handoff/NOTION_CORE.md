# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; fresh read-only head `cba70d87c2fad9736f4f2cefa1854b3efbf7636d`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T144727Z-c4035ee1d1`;
- archive SHA-256 `010a9b171e7a7c1fcaca57d29383152bff4ff239d396cddfba7b5aca6ba85fd9`;
- 4 parts: 800/800/800/304 chars;
- manifest Git blob `58d08917ea3f6f1ceb357e70454ebd107d1fef42`;
- part blobs: `b46ed5a3daef95a09cbac7370f6b33ce41fe13d9`, `38dce6cb69940543977a6b18e6607e0794fdb9b0`, `3eccdb2ae85ca52c28dbca37ab85b9aac53f9c12`, `e2ec1d4860905ccee8dfb53095fbf5854716647e`;
- expected `LATEST.json` blob after CAS: `1262a49abe2e057c575f70528e37b367ac0b2a42`.

На старте восстановлена предыдущая capsule `20260821T124611Z-ddaa375745` exact `capsule_runtime_v4.py`: verify + restore PASS, archive SHA `76b94e212550f618b94c9a8b10aebaf795ef9bc364a71d7a3c8c937ccfe150b8`.

Новая capsule упакована exact v4 после checkpoint. Все четыре part перечитаны и совпали с локальными Git blob SHA. Первичная публикация manifest имела другое форматирование, обязательная проверка это поймала; manifest заменён exact local bytes и повторно прочитан с blob `58d08917...`. Перед переключением `LATEST` указатель перечитан и остался на parent blob `9d177ee7...`; старый LATEST сохранён как PREVIOUS, новый опубликован CAS-обновлением.

Новые долговечные материалы:
- `autonomy/evidence/notion/20260821T1448Z_durable_replay_v11_stale_account_rehydration.json`;
- `autonomy/evidence/notion/20260821T1458Z_durable_replay_v11_server_guard_candidate.patch`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В fresh read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый diagnostic fanout. Runtime restore v3 остаётся Linux-PASS; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8/V9/V10 база

Exact blobs на свежей интеграционной границе PR #8 не изменились:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/turn_affinity.py` `f4bc004ec08cbaf3f1118dec0926015ab41b8bd3`.

V8: strict durable store, outer state version остаётся `2`; exact rendered replay переживает restart; `turn_id`/`request_kind` участвуют в identity, `stream` нет; stale retry tombstone-ится; >512 KiB fail-closed; 6h TTL / 8 MiB total / 32 stale fingerprints; forced NCM28 write failure наблюдаем и откатывает память через deep copy.

V9: нынешний `stream_openai_responses()` неидемпотентен, потому что создаёт новый `rs_*` и вставляет request-local reasoning item в `response.completed`. После commit stream/non-stream должны быть проекциями одного persisted canonical Responses payload. До durable publication нельзя выдавать `resp_`, `call_`, `fc_`, `ctc_`, `msg_` или `rs_`. Предпочтительная post-commit проекция — deterministic `responses_sse()`.

V10: после durable commit memory-only cache/reservation надо восстановить до client output. Persisted tool-call => восстановить reservation persisted account; persisted final response => clear stale reservation. Post-commit reconstruction failure не разрешает второй provider call: retry восстанавливает ephemeral state из durable record и возвращает тот же response.

Local verdict V10: `DURABLE_REPLAY_V10_EPHEMERAL_REHYDRATION_PASS`.

## V11 — stale owner account после restart

Новый Core-дефект подтверждён на exact текущей семантике. `ForegroundAccountReservations.reserve()` принимает произвольный `account_id`, а `wait_for_turn_route()` сравнивает число уникальных зарезервированных id с `pool_size`. Если persisted tool-call принадлежал аккаунту, который между процессами исчез/был заменён, слепое восстановление reservation создаёт «призрачный» id. В one-account pool unrelated work может ждать до TTL 300s, хотя реально настроенный replacement account свободен.

`NotionAccountPool.status()` уже возвращает текущие `accounts[].id`, поэтому Core может валидировать persisted owner локально без provider traffic и без изменения политики ротации.

Обязательное правило V11:
1. после strict durable publication, но до identity-bearing replay получить set текущих configured account ids из уже созданного pool;
2. persisted tool-call owner присутствует => восстановить reservation ровно этого account_id;
3. owner отсутствует => clear stale in-memory reservation и fail closed; не подставлять другой account/thread молча;
4. если NOTION_AGENT позже предоставляет доказанный full-history rebase на другой легитимный слот, интегрировать его отдельно на стыке, не изобретать в Core.

Local verdict: `DURABLE_REPLAY_V11_STALE_ACCOUNT_REHYDRATION_LOCAL_PASS`.
Проверены: ghost-block current semantics, missing-owner fail-closed, present-owner exact restore, no silent replacement.

Кандидат guard сохранён отдельным patch-файлом; product PR не менялся.

## Codex shell-env safety

Product probe всё ещё должен получить `[shell_environment_policy]`: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY` и `RUNTIME_STATE_KEY`. Предыдущий local verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`; живой Codex до product integration этой защиты не запускать.

## Следующий порядок

1. Read-only проверить Windows digest; не перезапускать.
2. Сделать один apply-ready exact-source patch для `ConversationSegmentStore + server`: V8 strict store + V9 canonical stream projection + V10 ephemeral rehydration + V11 current-account validation.
3. Exact local tests: same retry / restart / distinct turn / stale retry / tool / final / forced NCM28 write / post-commit reservation failure / account removed across restart / stream↔non-stream / size+TTL eviction. После successful durable replay provider call_count = 1. При write failure: zero cache, zero reservation, zero identity-bearing response.
4. Отдельно наложить shell-environment policy на exact Codex probe и расширить контрактный тест.
5. Product push не делать при ZERO-MINUTE. После Core safety gates — один bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 в этом запуске не менялись, hosted CI и provider traffic не запускались.
