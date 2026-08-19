# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `a62833f68c2119c0879137fa457c47569c079c70`.

## Что установлено по NCM28

Предыдущий native Windows-разрез остаётся действующим: `.ncm25-origin.json` и `installed.json` исключены, падал `other-target` (`d22be720...`, CircleCI `7bd6cc8b-2755-42c2-9291-7cb6aef6ccf7`). По исходнику это сводит проблему к публикации долговечной резервной копии в `_write_durable_backups()` внутри только что созданного transaction-directory guard.

В этой смене проверен контракт самого Windows rename. Microsoft прямо указывает для `FILE_RENAME_INFORMATION`, что при переименовании внутри того же каталога `RootDirectory` должен быть NULL; переданный `RootDirectory` может заставить Windows дополнительно открыть каталог назначения. На этом основании сделан кандидат v21: для direct-child rename через `ParentBoundOps` используется same-directory rename с `RootDirectory=NULL`, без повторного открытия guarded-каталога. Файл: `tools/build_ncm28_windows_fixed_candidate_v21.py`, первый commit `6c28a6bc...`.

Первый настоящий Windows happy-path после этого изменения (`5caf1ef014076813a95597740bfe6dddf214ccde`, CircleCI workflow `a7c89d7c-56c6-4343-b488-307e57a1df02`) всё равно завершился FAILURE. Значит один только `RootDirectory=NULL` проблему не закрывает.

Чтобы не возвращаться к широкому стековому поиску, сделан ровно тот узкий разрез, который был нужен из предыдущего handoff: native Windows ABSENT-write внутри только что созданного и удерживаемого guarded transaction directory. Первый такой целевой тест на `5c33374d...` также дал FAILURE для `ncm28-guarded-absent-write`. Это доказывает: проблема действительно находится в низкоуровневой операции `atomic_write_from_snapshot` для отсутствующего direct-child target под freshly-created `DirectoryGuard`, а не выше в auth/migration/installed/stable-owner.

Текущий head `a62833f...` делит этот один примитив на три независимых native Windows стадии без новых product-изменений:
- `ncm28-create` — создать и flush-нуть direct-child файл через уже открытый tx guard;
- `ncm28-rename` — same-directory handle rename с `RootDirectory=NULL`;
- `ncm28-atomic` — полный `capture absent -> atomic_write_from_snapshot`.

CircleCI workflow: `f7c505b2-81d4-44b6-8b1d-f881bcbfc40e`. На момент handoff все три jobs ещё PENDING. Их status contexts достаточно, чтобы установить точную сломанную операцию даже без доступа к приватному CircleCI log.

## Что делать следующим

1. Сначала прочитать три статуса workflow `f7c505b2-81d4-44b6-8b1d-f881bcbfc40e`; НЕ запускать ещё один разрез до этого.
2. Если `create` красный — чинить права/контракт `create_file_new_relative` для freshly-created directory handle. Если `create` зелёный, а `rename` красный — чинить именно native same-directory rename. Если оба зелёные, а `atomic` красный — проблема остаётся в intent/recovery/delete части `atomic_write_with_ops`, и разбирать только эту короткую часть.
3. После минимального исправления нужен один Windows integrated happy-path. При PASS сразу recovery/restart + полный relevant Windows suite.
4. После устойчивого Windows PASS прекращать NCM28-археологию и переходить к настоящей цели: реальный Codex CLI сценарий `tool call -> локальное действие -> tool result -> следующий модельный ход`, несколько шагов подряд, затем restart/failover.

Никаких production/Notion live writes в этой смене не было. Секреты и авторизованный runtime не раскрывались.
