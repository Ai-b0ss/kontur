# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний проверенный общий PR head: `a008858b0a1777fca3d6a40d9464411b460eace8`.
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
- explicit owner V2→V6: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, exact owner checkpoint, malformed/conflicting detached owner aliases rejected before session/provider I/O;
- direct agent и coding-subagents принимают owner prompt только как непустую строку и не преобразуют объект/массив/число в текст;
- общий detached-owner helper отклоняет пустой/пробельный приватный prompt с `QWEN_OWNER_SYSTEM_PROMPT_INVALID`;
- канонический `qwen-v3-capabilities.resolveSystemPromptMode()` строго проверяет body/header aliases, конфликт, пустые/нестроковые значения и bounded error.

## Новый Core-факт этого запуска — server preflight всё ещё был мягче канонического resolver
На exact PR #6 head `a008858b0a1777fca3d6a40d9464411b460eace8` проверены:
- `server.js` blob `12369bc5aca9206ba7daabd8521e7cf642b03c88`;
- `src/qwen-v3-capabilities.js` blob `75bcc50f85a3056ddc7dafc55cb98f5995a5eac7`;
- `scripts/system-prompt-mode-alias-validation-test.js` blob `381abf2d0d262f4cce1eaa40869d30eab7b708cd`.

В `qwen-v3-capabilities.js` strict mode уже закрыт, но `server.js` до очистки сессии вызывает отдельный старый `explicitPromptMode()`. Он молча выбирал один body alias, а пустое явное значение мог считать отсутствующим. Поэтому malformed/conflicting mode мог пройти раннюю проверку, вызвать `sessionStore.clear()` / `toolMemo.clear()`, а затем быть отвергнут уже поздним strict resolver. Это нарушает собственный комментарий сервера «validate before any session mutation».

Подготовлен ограниченный кандидат:
- `autonomy/v3/candidates/QWEN_CORE_SYSTEM_MODE_PREFLIGHT_GUARD_20260822.patch`;
- evidence: `autonomy/v3/evidence/QWEN_CORE_SYSTEM_MODE_PREFLIGHT_GUARD_20260822.json`.

Семантика кандидата: ранний server preflight сначала различает «режим вообще не задан» и «режим задан явно». Если режим задан, он немедленно делегирует каноническому strict `qwenV3Capabilities.resolveSystemPromptMode()`; если не задан — возвращает `null`, чтобы не ломать наследование durable owner/engineer authority.

Exact `server.js` удалось материализовать на hosted машине побайтно: после удаления лишнего локального завершающего newline `git hash-object` совпал с GitHub blob `12369bc5...`. Кандидат наложен только на этот exact source, `node --check`: PASS.

Targeted server regression на hosted машине без provider/внешнего CI:
`QWEN_SYSTEM_PROMPT_MODE_ALIAS_VALIDATION_PASS empty_fail_closed=2 conflict_fail_closed=2 malformed_fail_closed=1 body_precedence=1 equivalent_aliases=1 bounded_error=1 server_preflight_no_mutation=4`

Проверено: четыре malformed/conflicting варианта дают HTTP 400 `QWEN_SYSTEM_PROMPT_MODE_INVALID`, при этом `sessionStore.clear=0`, `toolMemo.clear=0`, provider calls=0.

Продуктовый PR этим запуском намеренно не переписан: доступная write-поверхность для большого `server.js` требует полной замены файла; безопасный byte-preserving product commit через Git objects не был завершён. Не отправлять реконструированные байты. Следующий запуск может интегрировать именно готовый patch, если свежие head/blob SHA не изменились, либо перебазировать его на fresh exact source.

Полный exact-tree `npm test` не выполнялся; весь PR зелёным по targeted PASS не объявлять. GitHub Actions/CircleCI/provider traffic не использовались.

## Следующий точный шаг
1. Перечитать fresh PR #6 head и exact `server.js` blob.
2. Если участок `explicitPromptMode()` всё ещё старый — применить `QWEN_CORE_SYSTEM_MODE_PREFLIGHT_GUARD_20260822.patch` к fresh exact source и добавить постоянный server-level regression, который проверяет отказ **до** `sessionStore.clear`, `toolMemo.clear` и provider call.
3. На hosted машине материализовать максимально полный exact owner/session/subagent cluster и выполнить минимум:
   - `node scripts/owner-system-prompt-test.js`
   - `node scripts/system-prompt-mode-alias-validation-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/agent-system-prompt-mode-test.js`
   - `node scripts/subagent-owner-prompt-validation-test.js`
   - ближайшие restart/session tests, которые удаётся материализовать exact-byte.
4. Если кластер зелёный — искать следующий воспроизводимый Core-дефект в restart/tool-result/OpenCode/subagents/skills/errors; узкую механику cooldown/account selection не забирать у QWEN_RELIABILITY.
5. Финальный большой рубеж после офлайн exact-tree проверки: один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; уже доказанные provider-прогоны не повторять.

## Постоянная память — состояние на входе этого запуска
- LATEST Git blob SHA: `dc12d4cb68e1c9f8522025783b8135e83939cfda`;
- capsule: `20260822T035212Z-e334419500`;
- archive SHA-256: `8756ecb3a92dd097385927a512bf5e45009d96c56ad0a35b60556681e8ac3065`;
- exact `capsule_runtime_v4.py` Git blob: `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- manifest + обе parts перечитаны из GitHub и материализованы exact bytes;
- нормативный v4 `verify + restore`: PASS.

После существенной работы этому запуску ещё нужно выполнить обязательный finish-protocol: обновить restored workspace → exact v4 pack → immutable upload → reread/verify each part+manifest → reread LATEST → CAS только от сохранённого parent blob `dc12d4cb...`; при изменившемся LATEST force-write запрещён.
