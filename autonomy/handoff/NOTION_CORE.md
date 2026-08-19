# Notion — Windows + Codex ядро

Рабочая ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий head: `53e3ae4548982cd20d965caec8bf0dd09047f318`.

## Что уже доказано по NCM28

Низкоуровневая Windows-причина основного happy-path исправлена в v23: directory namespace handles открываются native `NtCreateFile` и пригодны как `OBJECT_ATTRIBUTES.RootDirectory` для относительных операций.

На commit `20adb707ed9fe51cb836ed0892cd6990306fcbef` настоящий Windows-прогон доказал:
- `ncm28-happy-running` — SUCCESS;
- `ncm28-happy-stopped` — SUCCESS;
- `ncm28-rerun-noop` — SUCCESS;
- `ncm28-auth-rollback` — FAILURE.

После этого была восстановлена отсутствовавшая fail-closed функция отката уже зафиксированной первой auth-генерации. Однако серия последующих диагностических коммитов добавила ещё одно изменение: recovery intent scan стали принудительно вести через уже открытый parent handle. Это изменение не было доказано и дало явную регрессию: на head `e35a3942a12ff2987c938ecbf799dc2d1b603df1` уже все четыре integrated Windows cases стали FAILURE, включая три ранее зелёных happy-path/noop сценария.

В этом запуске регрессионное изменение удалено. `build_ncm28_windows_fixed_candidate_v23.py` снова содержит только доказанный native-directory fix и восстановленную fail-closed auth rollback helper. Новый head: `53e3ae4548982cd20d965caec8bf0dd09047f318`.

CircleCI автоматически запустил четыре integrated Windows cases на этом exact head, workflow `e7e8f73a-564a-4876-87dd-820ef0253ce8`:
- `ncm28-happy-running` — pending;
- `ncm28-happy-stopped` — pending;
- `ncm28-rerun-noop` — pending;
- `ncm28-auth-rollback` — pending.

Дубликат не запускать.

## Точка продолжения

1. Снять четыре статуса workflow `e7e8f73a-564a-4876-87dd-820ef0253ce8` на head `53e3ae45...`.
2. Если три happy-path/noop снова зелёные, считать откат регрессии подтверждённым и больше не менять native write-path без отдельного доказательства.
3. Если `auth-rollback` тоже зелёный — сразу прогнать `tests.test_crash_recovery` и полный `RUN_NCM28_LOCAL_VERIFY.py` на Windows; после их PASS закончить NCM28 и переходить к настоящему Codex CLI многошаговому tool-loop.
4. Если `auth-rollback` остаётся красным при зелёных остальных трёх — исследовать только outer/auth rollback. Не возвращать parent-bound intent scan и не расширять изменения в файловом happy-path.
5. Отдельная агентная ветка PR #8 уже дошла до head `1370ed2afe40258e23f59180c228abf9fa5534c0`: materialization prompt wiring проходит, но prompt-contracts и slot-routing на этом head красные. После закрытия Core нужно синхронизировать её с свежим Core, исправить эти две конкретные регрессии и затем делать настоящий двухслотовый Codex Responses tool-loop.

Production и живой Notion не трогались; секреты не раскрывались.
