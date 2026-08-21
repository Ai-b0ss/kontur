# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head в этом запуске `1d80d4f2939b4c76a43313b722e4e80c1041564c`. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T040846Z-acb0adfd7d`;
- archive SHA-256 `9dd89a8f1ce07a2ec5fe10e858f318417f7bf5ba6e2fed32956b34b4324f484a`, size 8209, 6 parts;
- part Git blobs: `c46e0366a66a2681039cd6949eca3ea47a084fdf`, `5c1d8ac3af3e9abc0f46797322b5c63df6394d4f`, `a363d65dbc04d87ded827a857282b57d2d969d5c`, `1b6e25937d7b148e2ef64574076c45a79f8af7c0`, `284d82e0074453a3259aef9e119bf2988afe22d9`, `3e81638d7300238a80c1fa72feaf2db56b56bf15`;
- manifest Git blob `85b37fd0297c61fe2270f5e728119822c1e391e8`;
- `LATEST.json` Git blob после CAS: `71f46ae1bdc98f133a1e1e51b3c6b76091350027`;
- `PREVIOUS.json` сохранён на capsule `20260821T015251Z-9afa256e7a`.

Все 6 parts и manifest после публикации перечитаны из GitHub; Git blob SHA совпали с локально рассчитанными. Старый LATEST был повторно прочитан непосредственно перед CAS и всё ещё имел ожидаемый blob `be2508d8ef972de25f3a0ace409f817b9288db8a`.

Важно: каталог `20260821T040429Z-dde6714f39` — невалидный orphan после неуспешной readback-проверки первой части. Он никогда не публиковался в LATEST и не должен использоваться для restore.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа — v23. Native Windows write primitive без нового точного Windows evidence не менять.

Уже доказано настоящим Windows: `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят; аварийный `auth-rollback` остаётся красным; managed-file rollback и non-target preservation проходят; auth/stable rollback падают с `PermissionError`; `remove_plain_tree` исключён как источник.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Read-only status в этом запуске снова показал все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) как `pending`. Hosted Windows/CI не запускался.

Когда появится новый точный callsite/outside-digest: использовать готовый call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4` → минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore v4

Linux-кандидат v4 закрывает partial final, temp cleanup, directory/symlink destination, unsafe restore root, создание root mode 700, сохранение exit codes и утечку `RUNTIME_STATE_KEY` в argv/child env. Вердикт: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point + overwrite/atomic replace semantics НЕ доказаны; объединить с будущим единственным разрешённым Windows Core gate и auth-rollback callsite.

## Codex shell-env safety

Real Codex project probe всё ещё нуждается в integration-only hardening:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Локально доказано, что эта политика не пропускает `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый AWS secret в model-reachable shell. До применения защиты живой Codex/Notion probe не запускать.

## Core lifecycle: durable rendered Responses replay

Fresh PR #8 сохраняет два старых Core-дефекта:
1. same-process `TurnAffinityStore` хранит только `completion_text`; cache hit заново вызывает `responses_payload()`, поэтому меняются `response_id`, output item id и tool `call_id`;
2. persistent `ConversationSegmentStore` хранит progress/thread/fingerprints, но не готовый Responses result. После restart exact replay может иметь persisted progress без replayable protocol result.

В этом запуске доказаны ещё три обязательные границы реализации.

### 1. Streaming preflight должен решить replay ДО первого SSE-байта

`stream_openai_responses()` сейчас создаёт свежий `response_id` и сразу отправляет `response.created`, а только затем фоново вызывает `handle_openai_responses()`. После введения durable replay это способно дать один id в `response.created` и сохранённый старый id в `response.completed`/tool output.

Требование: replay/miss определяется под той же сериализацией conversation+turn **до** первого SSE event. На replay поток строится напрямую из сохранённого canonical response. На miss новый `response_id` создаётся только после решения, что replay нет. Сохранять существующий порядок блокировок, не вводить обратный lock order.

### 2. Durable publication сейчас нельзя подтвердить вызывающему коду

`ConversationSegmentStore._save_locked()` ловит `FilesystemOwnershipError/OSError`, ставит `_persistence_blocked=True` и ничего не возвращает. `put()` поэтому не знает, достигла ли запись диска. Для tool-call это блокирующая проблема: нельзя показать Codex действие, если progress+replay существует только в памяти.

Требование: `put()` должен явно вернуть durable success либо поднять отдельную ошибку. При неудаче публикации восстановить предыдущее in-memory значение, чтобы недолговечное новое состояние не выглядело как сохранённое. До выдачи tool-call — fail closed.

### 3. Exact replay key должен быть отдельным full-request fingerprint

`response_input_fingerprints()` смешивает request context в каждый input-item и нужен для prefix/continuation. Но при `input=[]` результат — пустой tuple, поэтому equality tuple недостаточна для exact replay. Хранить отдельно `replay_request_fingerprint=response_input_fingerprint(body)`; per-item fingerprints оставить для prefix semantics.

### Доказанный минимальный инвариант v2

Одна атомарная conversation record должна одновременно содержать:
- существующий segment progress/account/thread metadata;
- `replay_request_fingerprint`;
- уже отрендеренный completed Responses payload с окончательными `response_id`, item id и `call_id`.

Legacy v2 нельзя просто сделать невидимым bump-ом версии: если старый record показывает exact progress, но не имеет replay, запрос должен fail closed (например 409), а не тихо повторно вызвать модель.

Offline harness прошёл:
- crash до atomic publication → provider retry разрешён;
- crash после publication до HTTP/SSE return → тот же stored response, provider call_count остаётся 1;
- same-process exact retry → те же response/item/call ids;
- process restart exact retry → те же ids;
- stream/non-stream строятся из одного canonical response;
- legacy exact progress-without-replay → fail closed;
- changed request → replay miss;
- failed durable publication → success наружу не выдаётся.

Вердикт: `DURABLE_RENDERED_REPLAY_V2_LOCAL_PASS`.

Материал: `autonomy/evidence/notion/20260821T040221Z_durable_replay_stream_preflight_evidence.json`.

### Реализационный нюанс безопасности

До product patch отдельно решить объём сохраняемого replay. `ConversationSegmentStore` исторически был content-free, а полный rendered response может содержать текст ответа. Минимально необходимая долговечность точно нужна для tool-call round, чтобы не повторить side effect после crash. Не превращать content-free state в бесконтрольный transcript-кэш без явного решения; предпочтителен минимальный canonical replay, достаточный для exact protocol replay, с bounded TTL/cleanup.

## Следующий порядок

1. Не перезапускать pending Windows digest; только read-only проверять новый факт.
2. На exact свежем PR #8 локально подготовить bounded Core patch: durable success signal/rollback в `ConversationSegmentStore`; separate replay fingerprint; render-before-one-atomic-save; exact replay до semantic affinity cache; fail closed legacy progress-without-replay.
3. Перестроить streaming entry так, чтобы replay preflight происходил до `response.created`, не нарушая lock order.
4. Локально прогнать реальные классы store/server helper: same-process retry, process restart, stream/non-stream, tool call, final text, empty-input exact key и forced persistence failure; provider stub `call_count=1` после durable publication.
5. Держать shell-env hardening для real Codex probe; product push не делать до снятия ZERO-MINUTE.
6. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore proof; без нового fanout.
7. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery без повторного локального side effect.

Product PR #7/PR #8 не менялись; hosted CI, provider traffic и реальные пользовательские данные не трогались.
