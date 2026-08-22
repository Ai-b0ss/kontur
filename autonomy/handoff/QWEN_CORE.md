# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний проверенный общий PR head: `0b37e8e3aa7f7defbbcca00fa1c5f760ae97a9c4`.
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
- explicit owner V2→V6: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, exact owner checkpoint, malformed/conflicting detached owner aliases rejected before session/provider I/O;
- прямой agent и coding-subagents принимают owner prompt только как непустую строку и не преобразуют объект/массив/число в текст.

## Новый Core-факт этого запуска — пустой detached owner prompt теперь fail-closed
Свежая сверка exact PR head `25c1347588...` показала отдельную несогласованность: общий `src/owner-system-prompt.js`, который используется сервером и V3-слоем, принимал явно переданный `owner_system_prompt=''` или только пробелы как валидный приватный prompt. При этом прямой агент и coding-subagents уже требовали непустую строку. Это позволяло явно запросить `owner`-режим фактически без прикладной owner-authority и расходилось с главным инвариантом режима владельца.

Исправлено:
- `e1206891ad8782229463ac375eadc51c3b608091` — `src/owner-system-prompt.js`: оба alias-поля обязаны быть строками с ненулевым содержимым после проверки `trim()`. Валидная строка возвращается исходными байтами, без обрезки/переписывания. Неверный тип, пустая/пробельная строка и конфликт alias дают `QWEN_OWNER_SYSTEM_PROMPT_INVALID`.
- `0b37e8e3aa7f7defbbcca00fa1c5f760ae97a9c4` — `scripts/owner-system-prompt-test.js`: старое ожидание «пустая строка допустима» удалено; добавлены пустой и whitespace-only случаи.

Exact blobs после записи:
- `src/owner-system-prompt.js` → `b1e99adb30e1a05a50665888ea702deae72da969`;
- `scripts/owner-system-prompt-test.js` → `d8b115dc629cebebbb1115bd61fc7d78cfa537b6`.

Проверено на ChatGPT hosted машине exact-byte материализацией этих двух файлов, без provider/CI:
`OWNER_SYSTEM_PROMPT_VALIDATION_PASS blank=2 malformed=1 alias_conflict=1 identical_alias=1 bounded_error=1`.
Полный exact-tree `npm test` в этом запуске не выполнялся; весь PR зелёным по targeted PASS не объявлять.

## Следующий точный шаг
1. Перечитать fresh PR head.
2. На hosted машине материализовать exact owner/session/subagent cluster и выполнить минимум:
   - `node scripts/owner-system-prompt-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/agent-system-prompt-mode-test.js`
   - `node scripts/subagent-owner-prompt-validation-test.js`
   - ближайшие restart/session tests, которые реально удаётся материализовать exact-byte.
3. Если кластер зелёный — искать следующий воспроизводимый Core-дефект в restart/tool-result/OpenCode/subagents/skills/errors; узкую механику cooldown/account selection не забирать у QWEN_RELIABILITY.
4. Финальный большой рубеж после офлайн exact-tree проверки: один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; уже доказанные provider-прогоны не повторять.

## Постоянная память
Старт этого запуска:
- LATEST blob SHA `a98a4448ba804df73657ddfdceb0f98ced7217e1`;
- capsule `20260822T015852Z-1450c67340`;
- archive SHA-256 `79a573694361065945d29438de9352c108f99c714a5b8359ca1cb1c3744215ae`;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- manifest + обе части материализованы точными байтами; exact v4 `verify + restore`: PASS.

После работы:
- exact v4 pack создал capsule `20260822T024825Z-35b7c606e9`, archive SHA-256 `2c06c2b52ca4ed2d4e51d5ad54d1e7c2b92ed30644f9c99f6cc752b1b718e92a`.
- uploaded part blobs после reread: `574807e4b97d8dcac0d5e20dd03c6bc70afa7fcc` и `275f03d731137be7c579e94ce661793f73cfb33b`; они совпали с локальными `git hash-object`.
- uploaded manifest blob `a1f5eae8998bccdee53edd53184c14cbc0c7d7d7` совпал с локальным; manifest снова перечитан после upload.
- непосредственно перед публикацией LATEST всё ещё имел стартовый parent blob `a98a4448ba804df73657ddfdceb0f98ced7217e1`, поэтому CAS разрешён.
- старый LATEST сохранён как PREVIOUS; новый LATEST опубликован через `update_file` именно с исходным parent SHA, без force-write.
- новый LATEST content blob: `0cbc9a1a425b6a09b627cf72ddb41a4e970a7d1f`, capsule `20260822T024825Z-35b7c606e9`.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовались.
