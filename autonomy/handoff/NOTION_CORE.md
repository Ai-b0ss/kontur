# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head этого запуска `f89d85b0b67faf3188c444d1ea52268783a722cd`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Канонический проверенный v4 `LATEST` на конец этого запуска **не менялся**:
- capsule `20260821T064849Z-7b43475e0e`;
- archive SHA-256 `dfb7f2bd1bbbc8e0247a1f513f9e806bd8bb20c1b4715501ca91cabaadf82d83`;
- `LATEST.json` Git blob `0f26decace9e2bf2b3a3d688f803b24582066523`.

На старте указатель и manifest перечитаны. Полный part-0000 через текущий connector был обрезан лимитом ответа, поэтому неизвестные bytes капсулы не реконструировались и `LATEST` не переключался. Exact source для текущей полезной работы материализован чтением свежих GitHub-файлов.

Новые долговечные доказательства: `autonomy/evidence/notion/20260821T0755Z_durable_rendered_replay_v7_evidence.json` и `autonomy/evidence/notion/20260821T0841Z_durable_replay_v8_reservation_ordering.json`.

## NCM28 / Windows

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В этом запуске все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый диагностический fanout.

## Runtime restore atomicity

Кандидат v3 остаётся актуален: decrypt во временный sibling-файл, fail-closed destination checks, cleanup temp при decrypt/promotion failure, секрет только через stdin. Linux verdict `RUNTIME_RESTORE_ATOMICITY_V3_LINUX_PASS`; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — V8 ordering

V7 сохраняет правильную identity/tombstone модель, но свежая сверка exact `server.py` выявила ещё одну обязательную lifecycle-границу.

Текущий сервер для tool-producing Sol round сначала делает `foreground_account_reservations.reserve(...)`, затем `turn_affinities.put(...)`, затем `conversation_segments.put(...)`, а окончательный `responses_payload()` с `response_id/item_id/call_id` создаёт только после выхода из этого блока. Текущий `ConversationSegmentStore._save_locked()` при NCM28 write failure лишь ставит `persistence_blocked` и не сообщает ошибку вызывающему коду.

Для durable replay это недопустимо. После перевода записи в fail-closed режим сбой durable commit при старом порядке оставит «призрачную» foreground reservation для tool-call, который Codex вообще не получил; memory-only TurnAffinityStore также нельзя считать авторитетным до durable commit.

Обязательный порядок V8:
1. provider completion/correction;
2. один раз построить канонический Responses payload со всеми `response_id/item_id/call_id`;
3. одной NCM28-атомарной записью опубликовать progress + rendered replay; ошибка записи должна быть видна вызывающему коду;
4. только после успеха обновить memory-only TurnAffinityStore;
5. только после успеха reserve/clear foreground account по уже каноническому rendered item;
6. только после успеха отдавать identity-bearing HTTP/SSE события Codex.

Инвариант отказа: при ошибке durable publication наружу и во внутреннее авторитетное состояние не должны попасть tool-call, response/call IDs, affinity cache entry или foreground reservation этого запроса.

Evidence: `autonomy/evidence/notion/20260821T0841Z_durable_replay_v8_reservation_ordering.json`.

Граница зоны: rotation/prompt modes/delegation/account-thread affinity не перерабатываются; Core меняет только crash/lifecycle ordering на стыке.

## Codex shell-env safety

Fresh exact `tools/run_real_codex_cli_project_probe.py` ранее оставался без ограничения окружения локальных shell-команд Codex.

Подготовлен локальный кандидат:
- `[shell_environment_policy] inherit="core"`;
- `ignore_default_excludes=false`;
- явные excludes `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Offline contract verdict `CODEX_PROBE_SHELL_ENV_V2_OFFLINE_PASS`: ключи не попадают в моделируемое окружение child shell и значения секретов не записываются в `config.toml`. Живой Codex до фактического включения этой защиты не запускать.

## Следующий порядок

1. На старте снова read-only проверить существующий Windows digest; не перезапускать.
2. Собрать apply-ready exact patch `payload/conversation_segments.py + payload/server.py` уже по V8: V7 identity/tombstones + observable durable failure + canonical render before commit + post-commit affinity/reservation. Прогнать same-process retry, restart, distinct same-text turn, delayed stale retry, tool call, forced NCM28 write failure, stream/non-stream, size/eviction. Для tool replay: `provider call_count=1`, неизменные IDs и при forced write failure отсутствие reservation/cache/tool response.
3. Встроить shell-environment safety в exact локальный Codex probe fixture и проверить config/child-env; product-push под ZERO-MINUTE не делать.
4. Новую v4 capsule публиковать только если каждый part можно полностью перечитать byte-for-byte; CAS только после полного совпадения. Не продвигать непроверенный каталог.
5. После Core safety gates — один bounded уже-авторизованный `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

В этом запуске PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
