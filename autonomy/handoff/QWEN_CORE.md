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
- общий detached-owner helper отклоняет пустой/пробельный приватный prompt с `QWEN_OWNER_SYSTEM_PROMPT_INVALID`.

## Новый Core-факт этого запуска — системный режим больше нельзя неоднозначно замаскировать alias/header
На свежем PR head `6eab3a8232...` воспроизведена отдельная неоднозначность `resolveSystemPromptMode()`:
- явный `system_prompt_mode=''` мог быть молча перекрыт `systemPromptMode='owner'`;
- конфликт `system_prompt_mode='engineer'` + `systemPromptMode='owner'` молча выбирал snake-case;
- пустой body-alias мог быть перекрыт transport-header;
- ошибка неизвестного режима включала в message само значение режима, поэтому огромная строка раздувала локальную ошибку.

Исправлено в PR #6:
- `6db1a07a95deb6af0beb49d6c42d0d9eedc33094` — `src/qwen-v3-capabilities.js`: body aliases и header aliases теперь валидируются fail-closed; пустое/нестроковое/неизвестное значение и конфликт aliases дают стабильный `QWEN_SYSTEM_PROMPT_MODE_INVALID` с bounded message `Unsupported Qwen system prompt mode`. Эквивалентные значения с разным регистром/пробелами разрешены. Явный валидный body mode сохраняет приоритет над header.
- `2a991b8d342038c6af2f7f81603816382e27d681` — новый `scripts/system-prompt-mode-alias-validation-test.js`.
- `a008858b0a1777fca3d6a40d9464411b460eace8` — новый regression подключён к обычному `npm test`.

Targeted-проверки на ChatGPT hosted машине без provider/внешнего CI:
- exact-byte `src/owner-system-prompt.js` blob `b1e99adb...` + exact test blob `d8b115dc...`: `OWNER_SYSTEM_PROMPT_VALIDATION_PASS blank=2 malformed=1 alias_conflict=1 identical_alias=1 bounded_error=1`;
- точный новый resolver-блок перечитан из GitHub blob `75bcc50f85a3056ddc7dafc55cb98f5995a5eac7` и выполнен локально: `QWEN_SYSTEM_PROMPT_MODE_ALIAS_TARGET_PASS empty_fail_closed=2 conflict_fail_closed=2 malformed_fail_closed=1 body_precedence=1 equivalent_aliases=1 bounded_error=1`.

Полный exact-tree `npm test` в этом запуске не выполнялся; весь PR зелёным по targeted PASS не объявлять. GitHub Actions/CircleCI/provider traffic не использовались.

## Следующий точный шаг
1. Перечитать fresh PR head.
2. На hosted машине материализовать максимально полный exact owner/session/subagent cluster и выполнить минимум:
   - `node scripts/owner-system-prompt-test.js`
   - `node scripts/system-prompt-mode-alias-validation-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/agent-system-prompt-mode-test.js`
   - `node scripts/subagent-owner-prompt-validation-test.js`
   - ближайшие restart/session tests, которые удаётся материализовать exact-byte.
3. Если кластер зелёный — искать следующий воспроизводимый Core-дефект в restart/tool-result/OpenCode/subagents/skills/errors; узкую механику cooldown/account selection не забирать у QWEN_RELIABILITY.
4. Финальный большой рубеж после офлайн exact-tree проверки: один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; уже доказанные provider-прогоны не повторять.

## Постоянная память — старт текущего запуска
- LATEST Git blob SHA: `0cbc9a1a425b6a09b627cf72ddb41a4e970a7d1f`;
- capsule: `20260822T024825Z-35b7c606e9`;
- archive SHA-256: `2c06c2b52ca4ed2d4e51d5ad54d1e7c2b92ed30644f9c99f6cc752b1b718e92a`;
- exact `capsule_runtime_v4.py` Git blob: `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- manifest + обе parts материализованы exact bytes; нормативный v4 `restore`: PASS.

После существенной работы требуется новый v4 checkpoint/pack/upload/reread/CAS. До его публикации этот раздел не считать завершённым.
