# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний проверенный общий PR head: `25c1347588ea9621a0ff5cf11a08c5df488cce00`.
Core V6 `d58a7aa6ed7e5c8fd1b50e78d50ad4fb11af7439` остаётся предком текущей линии.
Перед следующей записью снова перечитать fresh PR head и exact blobs.

## Уже закрыто — не исследовать заново без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, exact owner checkpoint, malformed/conflicting detached owner aliases rejected before session/provider I/O.

## Новый Core-факт этого запуска — owner prompt в прямом агенте и coding-subagents
Найден отдельный дефект ниже серверного V6: `src/subagent-agent-runner.js` и `src/agent.js` принимали в owner-mode нестроковый `ownerSystemPrompt`, потому что проверяли его через неявный `String(...)`. Объект/массив/число могли превратиться в `[object Object]`, `PRIVATE`, `42` и т.п. вместо явного отказа. Это нарушало инвариант: приватный prompt владельца должен оставаться именно переданной строкой, без самовольного преобразования нашим кодом.

Исправлено:
- `53f2dc0cacf4fec2633c92cb3a2f25ed36ff3317` — `src/subagent-agent-runner.js`: owner prompt обязан быть непустой строкой; валидная строка сохраняется без `String(...)`; код ошибки `QWEN_SUBAGENT_OWNER_PROMPT_INVALID`.
- `8a7af9d2af9e1541cd4dfaaed4ef58607b3df56c` — новый `scripts/subagent-owner-prompt-validation-test.js`.
- `e558e8dc286a283eee3b75680bf4968ce0a346b5` — этот тест подключён к обычному `npm test`.
- `4254364dae026cf9c4c6f19e5183a7ccbbe8ee1a` — `src/agent.js`: прямой agent owner-mode тоже отвергает нестроковый/пустой prompt и передаёт валидную строку без преобразования; код `QWEN_AGENT_OWNER_PROMPT_INVALID`.
- `25c1347588ea9621a0ff5cf11a08c5df488cce00` — существующий `agent-system-prompt-mode-test.js` расширен malformed cases и проверкой `provider_calls=0` для невалидного owner prompt.

`compare f0b88980… → 25c13475…` подтверждает узкие изменения Core-файлов: `src/agent.js` +7/-5, `src/subagent-agent-runner.js` +9/-7, плюс тесты/package wiring. В этом же интервале параллельный исполнитель добавил независимый `scripts/restart-failover-replay-safety-test.js`; его не считать частью этой Core-правки.

Проверено на ChatGPT hosted машине без provider/CI:
`QWEN_SUBAGENT_OWNER_PROMPT_TARGET_PASS malformed=4 empty=3 exact=1 engineer=1`.
Полный exact-tree `npm test` в этом запуске не выполнялся; не объявлять весь PR зелёным по targeted PASS.

## Следующий точный шаг
1. Перечитать fresh PR head.
2. На hosted машине материализовать exact owner/subagent cluster и выполнить минимум:
   - `node scripts/agent-system-prompt-mode-test.js`
   - `node scripts/subagent-owner-prompt-validation-test.js`
   - `node scripts/subagent-agent-runner-test.js`
   - соседние restart/session tests, которые реально удаётся материализовать exact-byte.
3. Если cluster green — искать следующий воспроизводимый Core-дефект в restart/tool-result/OpenCode/subagents/skills/errors; узкую механику cooldown/account selection не забирать у QWEN_RELIABILITY.
4. Финальный большой рубеж после офлайн exact-tree проверки: один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; уже доказанные provider-прогоны не повторять.

## Постоянная память
Старт этого запуска:
- LATEST blob SHA `a19e0ff35d548058c9fac980dc70bb6e1b8582ea`;
- capsule `20260822T005305Z-0f5e9b4388`;
- archive SHA-256 `61ba2e546e9748827ad41c4ff0ee6d64c25946e9398e5119a3e2fd625b98f4ef`;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- exact v4 verify + restore: PASS.

После работы:
- первая immutable попытка `20260822T015730Z-8d59c62ffc` признана INVALID ORPHAN: parts были точными, но вручную переданный manifest потерял финальный newline, и Git blob не совпал с локальным. Manifest/LATEST этой capsule не использовать; существующие immutable bytes не ремонтировать поверх.
- заново выполнен exact v4 pack, новая capsule `20260822T015852Z-1450c67340`, archive SHA-256 `79a573694361065945d29438de9352c108f99c714a5b8359ca1cb1c3744215ae`.
- uploaded part Git blobs `12f85b2c67788cbf5c9320b57a5ae67e0f48e4ff` и `955611fba1153f4bcebf3f7079fd3b80177e2363` совпали с локальными `git hash-object`.
- uploaded manifest Git blob `c2acb718276ca886a060366b26452bddd5357cef` совпал с локальным; exact v4 verify после pack: PASS.
- перед CAS LATEST всё ещё имел стартовый blob `a19e0ff35d548058c9fac980dc70bb6e1b8582ea`; старый LATEST сохранён как PREVIOUS, новый опубликован без force-write.
- опубликованный новый LATEST content blob после CAS: `a98a4448ba804df73657ddfdceb0f98ced7217e1`.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовались.
