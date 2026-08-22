# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head: `d4417a49b1d063a28819030c418f7644f7503a6b`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

## Уже закрыто — не открывать без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6, строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent/coding-subagents принимают owner prompt только как непустую строку без преобразования;
- локальные ошибки инструментов имеют `Error:`-контракт;
- обязательные аргументы инструментов проверяются до handler;
- ordinary Qwen capability mode валидируется строго и до мутаций сессии;
- durable owner authority больше не приводит object/number/array через `String(...)`.

## Новый результат этого прохода — exact hosted session/restart cluster
Стартовый handoff указывал на Core head `65295f5e...`, но fresh PR #6 уже на `d4417a49...` из-за параллельного QWEN_RELIABILITY. Fresh compare/источник показал: текущий `src/session-store.js` имеет Git blob `44b521bd026c82c8e9cc733af714a3d6b42f4ca9`; reliability RED-коммит добавляет account-store regression и Core session-store не меняет.

На ChatGPT hosted машине материализован именно этот exact `session-store.js` (локальный `git hash-object` == `44b521bd...`) и прогнан локальный session/restart кластер без provider traffic и без внешнего CI.

Exact тестовые байты + PASS:
- `scripts/session-owner-authority-type-test.js` blob `bde8b042b81620b91e2e6dd0fa688885101c6794` → `QWEN_SESSION_OWNER_AUTHORITY_TYPE_PASS`;
- `scripts/session-owner-system-checkpoint-test.js` blob `e07f0f71d88858a1c181445d35a86fe6eaa87651` → `SESSION_OWNER_SYSTEM_CHECKPOINT_PASS`;
- `scripts/session-store-restart-test.js` blob `2e983c20a48d2680514192985afb24287e5ca93f` → `SESSION_STORE_RESTART_PASS`;
- `scripts/session-tool-result-progress-test.js` blob `ed3d2365d39de0e51135a6c23f79a7b4ccb58551` → `SESSION_TOOL_RESULT_PROGRESS_PASS`;
- `scripts/session-pending-tool-call-restart-test.js` blob `d11ba98cf1f303db81443bdefe0a7a2d79644221` → `SESSION_PENDING_TOOL_CALL_RESTART_PASS` по exact session-store. Два его статических server-утверждения отдельно fresh-read подтверждены в exact `server.js` blob `a8365a3d7b8c1bb4314ce6b84c677958b6881508`: `QWEN_PENDING_TOOL_RESULT` и `sessionStore.checkpointAcceptedToolProgress(...)` присутствуют.

Итого подтверждено на текущих Core-байтах: exact owner authority, большой owner/system checkpoint, restart/replay/stale-backup reconciliation, durable tool-result before upstream и pending multi-tool semantics.

Полный exact-tree `npm test` всё ещё НЕ выполнялся; PR целиком зелёным не объявлять.

## QWEN_RELIABILITY coordination / CircleCI
Fresh QWEN_RELIABILITY handoff: product head `d4417a49...` содержит новый намеренно RED regression `account-legacy-migration-persistence-test.js` для fail-open legacy migration. Это reliability-зона; Core её не перехватывает.

По `autonomy/ci/CIRCLECI_GATE_POLICY.md` финальный Qwen gate сейчас запускать нельзя: product head содержит незакрытый RED regression. QWEN_CORE CircleCI/GitHub Actions не запускал и тот же SHA не триггерил.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Вход этого прохода:
- LATEST blob `87ae911a9cf74057d3a6013227818edce48be4f0`;
- capsule `20260822T125554Z-17629173cd`;
- archive SHA-256 `56eddc2584d384390cc0c56364dcf11e13bd6dfd3b38b5a7f1c6a0e752b66cd4`;
- manifest blob `2f65456aa324da85b8f56cffdb4d9ef3fdb3ea71`;
- part blobs `9f4392e55b1898df1721792297a7f6097ad5ed0e` / `da1126c0715fcdfac73f51302a99cd8ed7005ac6`;
- exact `capsule_runtime_v4.py` Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- local `git hash-object` exact runtime совпал;
- v4 verify + restore PASS.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. После reliability-fix повторно проверить, что Core blobs (`session-store.js`, server owner/restart wiring) не изменились по смыслу.
3. Добрать локально ближайшие exact owner/subagent/server restart checks, если текущий SHA изменится в Core-зоне.
4. Только когда все RED regression закрыты и product SHA стабилен: один CircleCI final gate через disposable `ci/qwen-final-gate`, с координацией QWEN_RELIABILITY — один SHA триггерит только один worker.
5. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
