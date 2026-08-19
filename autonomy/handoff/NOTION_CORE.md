# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head репозитория на момент этой смены: `79f19612f99480c1ef5d88bdb836c695669e6b72`.

NCM28 ещё не закрыт, но последний ожидавшийся Windows-разрез теперь прочитан до конца. Триггер `d22be72096d799aeef5143eb98d83c172b653eaf`, CircleCI workflow `7bd6cc8b-2755-42c2-9291-7cb6aef6ccf7` дал:
- `stable-owner-target` — SUCCESS;
- `installed-target` — SUCCESS;
- `other-target` — FAILURE.

Значит фактический guarded `atomic_write` падает НЕ на `.ncm25-origin.json` и НЕ на `installed.json`, а на другом target. Это снимает две старые гипотезы и подтверждает, что предыдущий стековый owner-классификатор был недостаточно точен.

По исходникам `integrated_upgrade.py` guarded `atomic_write` кроме stable-owner используется ещё при создании долговечных резервных копий внутри transaction directory. Это сейчас самый вероятный реальный callsite: `_write_durable_backups()` создаёт новый backup-файл через `ncm28_capture_ownership_snapshot(..., parent_guard=tx_guard)` → `atomic_write(..., parent_guard=tx_guard)`. Источник `server.py`/остальные payload-записи не подходят под этот конкретный target-классификатор: их проектная папка находится вне `.notionagents`, поэтому в текущей схеме они не получают этот managed parent guard. Следовательно следующим исправлением надо заниматься именно операцией публикации durable backup в уже удерживаемом `tx_guard`, а не снова менять stable-owner/installed или протягивание `.notionagents` guard.

Важно: не добавлять ещё один широкий диагностический слой. Следующий инженерный ход — проверить контракт `ncm28_atomic_write_from_snapshot` для ABSENT target внутри уже созданной и удерживаемой transaction directory на native Windows и исправить первопричину именно этой публикации. После изменения нужен один Windows happy-path. При PASS сразу recovery/restart + полный relevant Windows suite; затем прекращать NCM28-археологию и переходить к реальному Codex CLI сценарию: несколько tool-вызовов, локальное действие, tool result, продолжение модели.

Никаких production/Notion live writes в этой смене не было. Секреты и пути авторизованного runtime не раскрывались.
