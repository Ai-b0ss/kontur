# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head `249a639be210cf8f2f4682bd7b9b4b7b0e4a1455`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T095818Z-2a04c03b2d`;
- archive SHA-256 `dde2f1be4d49956ef1c617d4c12c06152ad1224702fc1bd80cb05a6b6d8690c0`;
- one part, 980 chars;
- manifest Git blob `0b63b3c017702e4193872b0450247cce96877d03`;
- part Git blob `a176bbbebf7e59bb2e32f2dfc7dcf880e5deaa3f`;
- `LATEST.json` Git blob `4fe1fe0d71a39d491403ed65e70c073ef4c8986c`.

Manifest и part перечитаны после публикации и их Git blob SHA совпали с локальными exact bytes. Старый `LATEST` `20260821T064849Z-7b43475e0e` сохранён как `PREVIOUS`. Переключение `LATEST` выполнено CAS с exact parent blob `0f26decace9e2bf2b3a3d688f803b24582066523`.

На старте старая capsule не была реконструирована: её 8000-character part connector обрезал. По v4 fallback exact source был прочитан прямо из GitHub.

Долговечное evidence этого запуска: `autonomy/evidence/notion/20260821T0955Z_core_v8_ordering_and_codex_env_local.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В свежей read-only проверке все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый диагностический fanout.

Runtime restore v3 остаётся Linux-PASS: decrypt во временный sibling-файл, fail-closed destination checks, cleanup temp при decrypt/promotion failure, секрет только через stdin. Нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8

Fresh PR #8 exact blobs:
- `payload/conversation_segments.py` `553bd3496c21a7949c3a5dfa03f33b9e09293213`;
- `payload/server.py` `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `tools/run_real_codex_cli_project_probe.py` `2f6d5873606975771b5ab418d5f9d45cd602304c`.

Текущий store при NCM28 write failure только ставит `persistence_blocked`, но не сообщает ошибку вызывающему коду. Текущий server до durable save делает foreground reservation и memory-only affinity, а окончательные `response_id/item_id/call_id` создаёт только после save. Streaming ещё раньше отправляет `response.created`.

Обязательный порядок V8:
1. provider completion/correction;
2. один canonical Responses payload со всеми IDs;
3. одна NCM28-атомарная публикация progress + rendered replay, write failure observable;
4. только после успеха memory-only TurnAffinityStore;
5. только после успеха reserve/clear foreground account;
6. только после успеха identity-bearing HTTP/SSE.

Локальный verdict: `DURABLE_REPLAY_V8_ORDERING_HARNESS_PASS`.
Доказано: same-turn retry и restart-style reload сохраняют IDs при `provider call_count=1`; same-text новый `turn_id` вызывает provider заново; старый delayed retry tombstoned; forced disk failure не оставляет cache/reservation/tool response; blocked persistence закрывает повтор до второго provider call; tool response без стабильных `conversation_key + turn_key` fail-closed; `stream` не входит в replay fingerprint.

До durable publication streaming может использовать только identity-free heartbeat; совместимость ранних SSE comments с текущим Codex пока `UNPROVEN`. Outer conversation-state version оставить `2`, replay schema хранить внутри entry.

## Codex shell-env safety

Fresh exact probe всё ещё не ограничивает окружение локальных shell-команд Codex. Подготовлен exact-target candidate:
- `[shell_environment_policy]`;
- `inherit="core"`;
- `ignore_default_excludes=false`;
- `exclude=["NOTION_BRIDGE_API_KEY","RUNTIME_STATE_KEY"]`.

Локальный verdict `CODEX_PROBE_EXACT_SHELL_ENV_CONFIG_PASS`; значения секретов в config не пишутся. Живой Codex до включения защиты не запускать.

## Следующий порядок

1. Read-only проверить существующий Windows digest; не перезапускать.
2. Превратить V8 harness в apply-ready exact patch `payload/conversation_segments.py + payload/server.py`: V7 identity/tombstones, observable durable failure, canonical render before commit, post-commit affinity/reservation, fail-closed legacy retry, 6h TTL, 512 KiB per response, 8 MiB total.
3. На exact локальных классах прогнать retry/restart/distinct-turn/stale-retry/tool/forced-write/stream-nonstream/size-eviction.
4. Встроить shell-environment policy в exact локальный Codex probe fixture; product-push под ZERO-MINUTE не делать.
5. После Core safety gates — один bounded уже-авторизованный `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
