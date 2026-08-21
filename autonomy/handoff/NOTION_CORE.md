# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head этого запуска `75a4a6de243e22e0df3c15e572e7aa09977d1fcb`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` на конец этого запуска **не менялся**:
- capsule `20260821T064849Z-7b43475e0e`;
- archive SHA-256 `dfb7f2bd1bbbc8e0247a1f513f9e806bd8bb20c1b4715501ca91cabaadf82d83`;
- `LATEST.json` Git blob `0f26decace9e2bf2b3a3d688f803b24582066523`.

На старте эта capsule была заново восстановлена через v4 и прошла проверку архива/workspace. После новой работы был собран новый локальный v4 checkpoint, но первая immutable-публикация дала несовпадение Git blob одного part при обязательном read-back. Проверка поймала это до CAS, поэтому новый `LATEST` намеренно **не публиковался** и старый валидный указатель сохранён. Незавершённый immutable каталог не считать текущей capsule.

Новые долговечные доказательства при этом сохранены отдельно в control-ветке: `autonomy/evidence/notion/20260821T0755Z_durable_rendered_replay_v7_evidence.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В этом запуске все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый диагностический fanout.

## Runtime restore atomicity

Кандидат v3 остаётся актуален: decrypt во временный sibling-файл, fail-closed destination checks, cleanup temp при decrypt/promotion failure, секрет только через stdin. Linux verdict `RUNTIME_RESTORE_ATOMICITY_V3_LINUX_PASS`; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V7

V6 нельзя применять как финальный вариант: в локальном точном кандидате найдены ещё две blocking-проблемы.

1. `response_request_fingerprint()` не связывал повтор с `client_metadata.turn_id`. Два намеренно разных Codex-turn с одинаковым текстом, моделью, tools и `request_kind` давали одинаковый fingerprint. Значит новый turn мог получить старый сохранённый ответ вместо нового обращения к модели.
2. Один слот `latest replay` на conversation недостаточен. После того как turn B заменил replay turn A, запоздалый retry A мог промахнуться по replay и снова запустить планирование старого tool-call.

V7-кандидат исправляет границу:
- request fingerprint включает `turn_id` и `request_kind` вместе с полями, влияющими на ответ;
- retry того же turn сохраняет fingerprint;
- предыдущие уже опубликованные fingerprints сохраняются как ограниченные tombstones (только хэши, максимум 64), чтобы поздний старый retry закрывался ошибкой, а не повторным планированием;
- durable tool replay требует устойчивый conversation id и реальное persistent store;
- при ошибке NCM28-публикации новое состояние не остаётся доступным даже в памяти;
- legacy v2 exact retry остаётся fail-closed.

Локальный store verdict: `DURABLE_RENDERED_REPLAY_V7_IDENTITY_AND_STALE_RETRY_PASS`.

Отдельная server-ordering модель на реальном V7 store прошла `DURABLE_RENDERED_REPLAY_V7_SERVER_ORDERING_MODEL_PASS`: fresh tool response + exact retry вызывает provider один раз и сохраняет `response_id/item_id/call_id`; отдельный same-text turn вызывает provider снова; delayed old retry tombstoned; forced disk failure не публикует tool response/cache; stream до durable commit выдаёт только identity-free comment, после commit использует один канонический response.

Граница доказательства: это пока локальная интеграционная модель, а не применённый полный `payload/server.py`. Настоящая совместимость текущего Codex CLI с ранними identity-free SSE comments тоже не доказана — `codex` binary в hosted машине отсутствует.

Evidence: `autonomy/evidence/notion/20260821T0755Z_durable_rendered_replay_v7_evidence.json`.

## Codex shell-env safety

Fresh exact `tools/run_real_codex_cli_project_probe.py` всё ещё blob `2f6d5873606975771b5ab418d5f9d45cd602304c` и не ограничивает окружение локальных shell-команд Codex.

Подготовлен локальный кандидат:
- `[shell_environment_policy] inherit="core"`;
- `ignore_default_excludes=false`;
- явные excludes `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Offline contract verdict `CODEX_PROBE_SHELL_ENV_V2_OFFLINE_PASS`: ключи не попадают в моделируемое окружение child shell и значения секретов не записываются в `config.toml`. Живой Codex до фактического включения этой защиты не запускать.

## Следующий порядок

1. На старте восстановить текущий валидный v4 `LATEST` и read-only проверить существующий Windows digest; не перезапускать.
2. Собрать apply-ready exact patch `payload/conversation_segments.py + payload/server.py` из V7 и прогнать максимально полный локальный fixture: same-process retry, restart, distinct same-text turn, delayed stale retry, tool call, forced NCM28 write failure, stream/non-stream, size/eviction. Обязательное условие для tool replay: `provider call_count=1` и неизменные IDs.
3. Встроить shell-environment safety в exact локальный Codex probe fixture и проверить config/child-env; product-push под ZERO-MINUTE не делать.
4. Отдельно исправить процесс публикации новой v4 capsule: новый immutable каталог, обязательный byte/blob read-back каждого part; CAS только после полного совпадения. Не продвигать каталог с несовпавшим part.
5. После Core safety gates — один bounded уже-авторизованный `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

В этом запуске PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
