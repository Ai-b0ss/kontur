# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head `249a639be210cf8f2f4682bd7b9b4b7b0e4a1455`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` пока не менялся:
- capsule `20260821T064849Z-7b43475e0e`;
- archive SHA-256 `dfb7f2bd1bbbc8e0247a1f513f9e806bd8bb20c1b4715501ca91cabaadf82d83`;
- `LATEST.json` Git blob `0f26decace9e2bf2b3a3d688f803b24582066523`.

На старте указатель и manifest перечитаны. Первый part содержит 8000 символов и текущий connector снова обрезал его по лимиту ответа, поэтому неизвестные bytes не реконструировались. По протоколу v4 работа продолжена от exact GitHub source. Новый `LATEST` публиковать только после полного byte-for-byte reread каждого part.

Новые долговечные доказательства:
- `autonomy/evidence/notion/20260821T0755Z_durable_rendered_replay_v7_evidence.json`;
- `autonomy/evidence/notion/20260821T0841Z_durable_replay_v8_reservation_ordering.json`;
- `autonomy/evidence/notion/20260821T0955Z_core_v8_ordering_and_codex_env_local.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В свежей read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый диагностический fanout.

## Runtime restore atomicity

Кандидат v3 остаётся актуален: decrypt во временный sibling-файл, fail-closed destination checks, cleanup temp при decrypt/promotion failure, секрет только через stdin. Linux verdict `RUNTIME_RESTORE_ATOMICITY_V3_LINUX_PASS`; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8

Fresh PR #8 exact blobs, по которым сверялся Core:
- `payload/conversation_segments.py` blob `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `tools/run_real_codex_cli_project_probe.py` blob `2f6d5873606975771b5ab418d5f9d45cd602304c`.

Текущий store при NCM28 write failure только ставит `persistence_blocked`, но не сообщает ошибку вызывающему коду. Текущий server до durable save делает reservation и memory-only affinity, а окончательные `response_id/item_id/call_id` создаёт только после save. Streaming дополнительно отправляет `response.created` ещё до provider completion и durable publication.

Обязательный порядок V8:
1. provider completion/correction;
2. один раз построить канонический Responses payload со всеми `response_id/item_id/call_id`;
3. одной NCM28-атомарной записью опубликовать progress + rendered replay; ошибка записи обязана быть видна вызывающему коду;
4. только после успеха обновить memory-only `TurnAffinityStore`;
5. только после успеха reserve/clear foreground account по каноническому rendered item;
6. только после успеха отдавать identity-bearing HTTP/SSE события Codex.

Новый локальный lifecycle harness прошёл как `DURABLE_REPLAY_V8_ORDERING_HARNESS_PASS`. Доказано:
- same-turn retry и restart-style reload: `provider call_count=1`, те же `response_id/item_id/call_id`;
- same-text новый `turn_id` вызывает provider заново;
- запоздалый повтор старого committed turn ловится tombstone и не replans;
- forced durable write failure не оставляет cache/reservation/tool response;
- после `persistence_blocked` повтор закрывается до второго provider call;
- tool response без устойчивых `conversation_key + turn_key` fail-closed;
- `stream` намеренно не входит в replay fingerprint, чтобы stream/non-stream retry делили один canonical response.

Для pre-commit streaming допустим только identity-free heartbeat. Совместимость SSE comments с текущим реальным Codex пока `UNPROVEN`, поэтому live claim не делать.

Outer `conversation-state` version должен остаться `2`; replay schema добавлять внутри entry, чтобы не сломать уже существующий loader/migration contract.

## Codex shell-env safety

Fresh exact probe всё ещё не ограничивает окружение локальных shell-команд Codex.

Подготовлен exact-target candidate для blob `2f6d587...`:
- `[shell_environment_policy]`;
- `inherit="core"`;
- `ignore_default_excludes=false`;
- `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`.

Локальный verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`: значения секретов в config не записываются. Живой Codex до фактического включения этой защиты не запускать.

## Следующий порядок

1. На старте снова read-only проверить существующий Windows digest; не перезапускать.
2. Превратить V8 из lifecycle harness в apply-ready exact patch `payload/conversation_segments.py + payload/server.py`: V7 identity/tombstones, observable durable failure, canonical render before commit, post-commit affinity/reservation, fail-closed legacy retry, 6h replay TTL, 512 KiB per response, 8 MiB total budget.
3. На exact локальных классах прогнать same-process retry, restart, distinct same-text turn, delayed stale retry, tool call, forced NCM28 write failure, stream/non-stream и size/eviction. Для forced write failure: ни cache, ни reservation, ни identity-bearing client output.
4. Встроить shell-environment safety в exact локальный Codex probe fixture; product-push под ZERO-MINUTE не делать.
5. Новую v4 capsule публиковать только если каждый part можно полностью перечитать byte-for-byte; CAS только после полного совпадения.
6. После Core safety gates — один bounded уже-авторизованный `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

В этом запуске PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
