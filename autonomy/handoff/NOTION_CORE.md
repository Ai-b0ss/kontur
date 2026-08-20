# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head, снятый read-only в этом запуске: `a0f4c4082e9ef356522d441eb7b3172a3f5fdd47`.

## Режим исполнения

Действует ZERO-MINUTE MODE: CircleCI/GitHub Actions/Cloudflare и другие hosted CI не запускать, trigger-push ради CI не делать. Бесплатные Linux/Python/offline проверки — через ChatGPT/container. Native Windows не имитировать через Linux/Wine. Production, реальные пользовательские данные, Notion traffic и секреты не трогать без отдельного уже разрешённого live gate.

Зона `NOTION_AGENT` не дублируется: ротация, prompt modes, delegation и account/thread affinity остаются PR #8. Core касается их только в точке совместимости lifecycle/Codex.

## Постоянная рабочая капсула NOTION_CORE

Текущий проверенный v4 `LATEST`:
- capsule: `20260820T194136Z-c433b9037d`;
- archive SHA-256: `5ed3f3cbe7f55a32bb8aef8f7aa46d6557717dbba37edabb3206385edb5673d3`;
- parts: 2;
- `LATEST.json` Git blob SHA после CAS-публикации: `fd520a6ebfebf93b21d9592ed0ea7e03be141775`.

Перед публикацией оба part и manifest были перечитаны из GitHub; их Git blob SHA совпали с локально рассчитанными. Старый `LATEST` `20260820T184305Z-6692ad6e1c` сохранён как `PREVIOUS`.

На старте этого запуска capsule `20260820T184305Z-6692ad6e1c` был восстановлен через `capsule_runtime_v4.py`; проверка архива и workspace прошла.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Native Windows write primitive без нового точного Windows-доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся аварийный `auth-rollback`;
- возврат обычных managed files и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` исключён как источник этого `PermissionError`.

Существующий digest-разрез НЕ перезапускать:
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- задачи `auth`, `codex`, `migration`, `runtime`, `outside-digest`;
- read-only combined status в этом запуске: все пять по-прежнему `pending`.

Нового Windows/hosted запуска не было. Linux-результаты не объявлялись доказательством NTFS/NCM28.

Если digest-разрез позже даст точный callsite/outside-digest, уже существует подготовленный call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. После точного callsite: минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore atomicity — кандидат v3

Exact Core `RESTORE_RUNTIME_STATE.sh` / `.ps1` уже не светят `RUNTIME_STATE_KEY` в argv/child env: ключ идёт через stdin `--passphrase-fd 0`. Но исходники всё ещё расшифровывают прямо в конечный путь и потому небезопасны при частичной ошибке `gpg`.

В предыдущем кандидате v2 найден дополнительный shell-gap:
1. если `gpg` успешен, но финальный `mv` падает, plaintext temp мог остаться;
2. обычный `mv temp out` при существующем `out`-каталоге может переместить plaintext **внутрь каталога** вместо безопасного отказа.

Подготовлен v3:
- существующий destination разрешён только как обычный non-symlink файл; directory/symlink fail-closed;
- decrypt только в случайный sibling temp;
- gpg exit code сохраняется;
- temp удаляется и при decrypt failure, и при promotion failure;
- promotion только после decrypt exit 0;
- PowerShell: existing non-leaf destination отклоняется, temp cleanup в `finally`, promotion через `[System.IO.File]::Move($tmp,$out,$true)`.

Бесплатный Linux harness на v3 прошёл:
- success replaces existing regular final — PASS;
- failed decrypt preserves old final — PASS;
- failed decrypt with no prior final publishes nothing — PASS;
- gpg rc=7 preserved — PASS;
- directory destination rejected before decrypt — PASS;
- symlink destination rejected before decrypt — PASS;
- forced `mv` failure preserves old final — PASS;
- forced `mv` rc=9 preserved — PASS;
- plaintext temp cleaned after promotion failure — PASS;
- secret absent from child env/argv and present only on stdin — PASS.

Вердикт: `RUNTIME_RESTORE_ATOMICITY_V3_LINUX_PASS`.

Долговечные материалы:
- `autonomy/evidence/notion/20260820T1937Z_runtime_restore_atomicity_v3_evidence.json`;
- `autonomy/evidence/notion/20260820T1937Z_runtime_restore_atomicity_v3_candidate.patch`.

Native Windows PowerShell replace semantics **не доказаны**. Это объединить с одним будущим разрешённым Windows Core gate, не создавать отдельный fanout.

## Codex Core / lifecycle

Core live probe пока не запускался. После снятия Windows/Core safety blockers нужен один bounded уже-авторизованный проектный прогон:
`codex exec → bridge → Notion → локальный tool call → конкретный verifier FAIL → tool result → исправление → повтор verifier → VERIFY_OK`.

После него отдельно проверить restart/recovery незавершённой Core-цепочки без повторения уже выполненного локального side effect.

PR #8 сейчас базируется на Core `b6f4eef…` и ушёл до `a0f4c408…`; его prompt/rotation/delegation изменения не переносить в Core вручную до стабилизации Core. Проверять только совместимость интерфейсов.

## Следующий порядок

1. В начале следующего запуска восстановить `NOTION_CORE` из v4 `LATEST`, запомнить blob SHA указателя и read-only проверить существующий Windows digest — не перезапускать.
2. Если digest всё ещё pending, продолжать бесплатные Core-задачи: materialize exact source/patch, targeted rollback invariants, Codex project harness, lifecycle/restart подготовка.
3. При первом разрешённом native Windows Core gate совместить: точный `auth-rollback` callsite + PowerShell runtime-restore atomic replace proof. Не делать новый диагностический fanout.
4. После зелёных Core gates — один настоящий bounded Codex project tool-loop и затем restart/recovery proof.

Product PR #7 в этом запуске не менялся; hosted CI и provider traffic не запускались.
