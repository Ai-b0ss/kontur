# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `dfcf897a40ccff6d07f8a7f835c5f1718ddb6dd5`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. В этом запуске workspace не менялся.

Сделано:
- Заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и живые PR обоих Qwen-репозиториев. Старый handoff сильно отставал: PR #6 уже был на `a154afdd…`.
- Найден реальный дефект в `src/provider-circuit.js`: `trip()` писал новый provider-wide circuit через `rename`, а если последующий `fsync` каталога падал, функция возвращала ошибку, но новый circuit уже оставался каноническим на диске. Получалось опасное расхождение между тем, что думает вызывающий код, и фактическим safety-state после перезапуска.
- `atomicWriteState()` переведён на схему temp → backup старого файла → установка нового → подтверждение каталога. Если подтверждение не удалось, новый файл удаляется, старый возвращается из transaction-backup, а ошибка пробрасывается наружу.
- Сохранена существующая fail-closed семантика повреждённого provider-circuit и уже добавленная crash-safe очистка через tombstone.
- Усилен `scripts/provider-circuit-persistence-test.js`: теперь он отдельно ломает именно `fsync` каталога после замены, требует исключение, проверяет восстановление прежнего circuit и отсутствие `.tmp`/`.txn-backup` мусора. Отдельно остаётся проверка rollback при неудачной durable-очистке.

Коммиты этого запуска в `qwen-free-api`:
- `3a02ef1615fe1d493391c8463a181da8ff5e1340` — crash-safe rollback для записи provider circuit;
- `dfcf897a40ccff6d07f8a7f835c5f1718ddb6dd5` — regression на неудачный directory fsync при `trip()` и `clear()`.

Проверено:
- PR #6 действительно указывает на `dfcf897a…`, остаётся draft/open и `mergeable=false` относительно текущего `main`.
- `qwen-workspace` PR #5 по-прежнему `468733b2…`, `mergeable=true`.
- CAPTCHA-ротация, bounded failover, provider-wide circuit, account/thread affinity, tool-loop, checkpoint и два режима system-prompt не откатывались.
- Живой Qwen в этом запуске не трогался; старый разрешённый provider-run не дублировался.
- Через доступный GitHub status CircleCI на exact head `dfcf897a…` пока не виден, поэтому полный regression зелёным не объявлять без результата исполнителя.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `dfcf897a…`; если красный — чинить конкретную ошибку, не откатывая CAPTCHA-ротацию и новый durable-state слой.
2. После зелёного офлайн-набора сделать один bounded Windows offline parity на exact продуктовой линии без provider traffic.
3. Главный следующий продуктовый дефект уже подтверждён в `server.js`: streaming OpenCode-путь сохраняет `chatId/accountId` сразу после `response.status=true`, а `retryEmpty` делает то же до того, как SSE доказал пригодный ответ. Нужно убрать ранний checkpoint: держать выбранный route только в памяти, а `sessionStore.set(...)` делать после успешного завершения принятого stream; при retry фиксировать route именно успешной попытки.
4. После этого — один реальный многошаговый `read_file → Qwen → bash → Qwen → final`, затем restart + безопасный failover незавершённой цели. Второй живой запуск не делать, пока не установлена судьба уже разрешённой прежней попытки.
