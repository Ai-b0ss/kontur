# Qwen — агентное ядро

Обновлено: 2026-08-21 20:03Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6.

На старте Core-работы head был `5c8fc5299f77a1c3502082da8827b6d3f20e7592`. Исправление Core закончено на `db0ef41550cdc8c7d1e74f3fc8f6aa8773f404de`. После этого соседний исполнитель продвинул общий PR до `5cc928607cf4d001cbf9adbc007277dccbdefe4b`; его два коммита затронули `src/session-store.js` и `scripts/session-store-primary-fsync-test.js`, но проверка текущих байтов показывает, что Core-исправление system prompt осталось на месте.

## Закрытый дефект: большой owner system prompt больше не режется в checkpoint

Ранее `checkpointMessages()` применял `CHECKPOINT_MESSAGE_MAX_CHARS = 12000` ко всем сообщениям, включая `role=system`. Поэтому большой приватный промпт владельца после restart восстанавливался уже переписанным с `...[checkpoint truncated]`.

Исправлено в `src/session-store.js`:
- `system`-контент сохраняется без нашего сокращения;
- несколько system-блоков сохраняются в исходном порядке;
- общий жёсткий бюджет checkpoint 60 000 символов остаётся;
- если system-инструкции целиком не помещаются в этот бюджет, возникает явный локальный `QWEN_SYSTEM_CHECKPOINT_REJECTED` вместо тихого обрезания/удаления;
- обычные `user/assistant/tool` сообщения по-прежнему ограничиваются прежним 12k-лимитом;
- сравнение checkpoint-истории (`checkpointMessageKey`) тоже использует точный system-контент, чтобы recovery/overlap не сравнивали урезанные копии.

Коммиты Core:
- `616eb0e1635bcfa3df0e61649dc6d049ec635f09` — продуктовый fix;
- `62f7c86d3c9527e9cdc9bafb29de4be2d33986df` — новый regression `session-owner-system-checkpoint-test.js`;
- `db0ef41550cdc8c7d1e74f3fc8f6aa8773f404de` — подключение regression в обычный `npm test`.

Сравнение `5c8fc529… → db0ef415…`: ровно 3 файла — `src/session-store.js` (+18/-3), новый тест (95 строк), одна правка test-chain в `package.json`. Посторонних изменений нет.

Новый regression покрывает:
- owner prompt >12k без изменения байтов;
- второй project/system-блок и порядок system-инструкций;
- сохранение через session-store, перезапуск и короткое `continue`;
- сохранение прежнего ограничения обычной истории;
- fail-closed для system prompt, который превышает общий 60k budget.

На hosted-машине без Qwen и без внешнего CI целевая семантика прошла:

`QWEN_OWNER_SYSTEM_CHECKPOINT_TARGET_PASS exact=1 order=1 ordinary_bounded=1 oversized_fail_closed=1`

Полный exact-tree `npm test` пока не заявлен: весь приватный репозиторий целиком не материализован в hosted filesystem.

## Постоянная память

Стартовый `LATEST` этого запуска: blob `64a3d5855efddf993898dcd8b7400c5f2d4026d7`, capsule `20260821T185121Z-843f98abcc`, archive SHA-256 `28606a683d23f71f7675a816249256e1e5693be8844991fd29cdb6e1516baae1`.

Стартовая capsule восстановлена exact нормативным `capsule_runtime_v4.py`; Git blob runtime — `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. `verify + restore` — PASS.

После Core-работы собрана новая v4 capsule `20260821T195934Z-4b6ed4f0b7`, archive SHA-256 `0f5faaf70d7e5793efb2f506cd9111784a6f7f829f5328a6f56a5ccd83ef055e`, source_ref `db0ef41550cdc8c7d1e74f3fc8f6aa8773f404de`.

Immutable upload перепроверен после записи:
- manifest Git blob `24fda69963d951045d20bf8e19ae1ae0ab95c4a0`;
- part0 Git blob `773db3f29af476271940d63dfdba3e4767004229`;
- part1 Git blob `1da89249a5a99042aeb8c37996596c8dcd194ce3`.

Локальный exact runtime повторно дал `verify PASS` и `restore PASS`, восстановленные `CHECKPOINT.md`/`EVIDENCE.txt` совпали с manifest SHA-256.

Перед публикацией `LATEST` был перечитан и всё ещё имел исходный parent blob `64a3d585…`, поэтому CAS выполнен штатно. Старый LATEST сохранён в `PREVIOUS`, новый `LATEST` указывает на `20260821T195934Z-4b6ed4f0b7`; его blob — `bdfbc91f0af8ff9034619ba8eedb3829e073b7c5`.

## Граница доказанного

- Дефект silent truncation owner system prompt исправлен в текущей PR-линии и защищён постоянным тестом.
- Целевая hosted-проверка семантики зелёная.
- Full exact-tree `npm test` на текущем общем PR-head НЕ заявлен.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. Если появится безопасный побайтовый способ материализовать приватный tree на hosted-машине, выполнить новый `session-owner-system-checkpoint-test.js` вместе с ближайшим session/restart-кластером без внешнего CI.
2. Проверить внешний non-stream контракт `QWEN_SYSTEM_CHECKPOINT_REJECTED`: streaming-путь уже передаёт локальный код checkpoint-ошибки, а общий non-stream catch сейчас, вероятно, превращает его в безликий HTTP 500.
3. Чинить только после воспроизводимого нарушения; узкую механику cooldown/account selection не трогать, если она не пересекается с Core.
