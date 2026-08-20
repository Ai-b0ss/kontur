# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head, снятый read-only: `e12ab315cb365650f56dc1e48551f04e55e5276c`.

## Режим исполнения

Действует ZERO-MINUTE MODE: CircleCI/GitHub Actions/Cloudflare и другие hosted CI не запускать, trigger-push ради CI не делать. Бесплатные Linux/Python/offline проверки — через ChatGPT/container. Native Windows не имитировать через Linux/Wine. Production, реальные пользовательские данные, Notion traffic и секреты не трогать без отдельного уже разрешённого live gate.

Зона `NOTION_AGENT` не дублируется: ротация, prompt modes, delegation и account/thread affinity остаются PR #8. Core касается их только в точке совместимости lifecycle/Codex.

## Постоянная рабочая капсула NOTION_CORE

Текущий проверенный v4 `LATEST`:
- capsule: `20260820T204431Z-bee456b329`;
- archive SHA-256: `b6c2eadbc7674688aa19659e9aa22884b6f95fa8f1863c4ebe12668beb70a87d`;
- parts: 4;
- `LATEST.json` Git blob SHA после CAS-публикации: `fbb1d00abada53290e380a6d4bd7e6deb4f04144`.

Все четыре part и manifest после публикации перечитаны из GitHub и совпали с локально рассчитанными Git blob SHA. Старый `LATEST` `20260820T194136Z-c433b9037d` сохранён как `PREVIOUS`.

На старте этого запуска `20260820T194136Z-c433b9037d` был реально восстановлен через `capsule_runtime_v4.py`; архив и workspace прошли проверку.

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
- свежий read-only combined status: все пять по-прежнему `pending`.

Нового Windows/hosted запуска не было. Linux-результаты не объявлялись доказательством NTFS/NCM28.

Если digest-разрез позже даст точный callsite/outside-digest, уже существует подготовленный call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. После точного callsite: минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore atomicity — кандидат v4

Exact Core `RESTORE_RUNTIME_STATE.sh` / `.ps1` уже не светят `RUNTIME_STATE_KEY` в argv/child env: ключ идёт через stdin `--passphrase-fd 0`. Исходники PR #7 всё ещё расшифровывают прямо в конечный путь и потому небезопасны при частичной ошибке `gpg`.

В v3 уже были закрыты: partial final, temp cleanup, directory/symlink destination и сохранение exit code. В этом запуске динамически воспроизведён ещё один отдельный дефект v3: если `$HOME/runtime-state-restored` сам является symlink на внешний каталог, успешная расшифровка проходит и plaintext публикуется в target этого symlink.

Подготовлен v4:
- shell: существующий restore root допускается только как реальный non-symlink directory; отсутствующий root создаётся отдельно с mode 700;
- destination по-прежнему только обычный non-symlink file;
- decrypt только в случайный sibling temp;
- temp удаляется при decrypt/promotion failure, сохраняются exit codes;
- secret остаётся только на stdin gpg;
- PowerShell: restore root и destination отклоняются при `ReparsePoint`/неподходящем типе; temp cleanup в `finally`; promotion через `[System.IO.File]::Move($tmp,$out,$true)`.

Бесплатный Linux harness v4 прошёл: success, decrypt failure с/без старого final, gpg rc=7, directory destination, destination symlink, restore-root symlink с отсутствием plaintext в target, restore-root regular file, создание отсутствующего root, forced mv failure + cleanup, отсутствие секрета в argv/env.

Вердикт: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Долговечные материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point и overwrite/atomic replace semantics **не доказаны**. Это объединить с одним будущим разрешённым Windows Core gate вместе с точным `auth-rollback` callsite; отдельный fanout не создавать.

## Codex Core / lifecycle

Core live probe пока не запускался. Exact Core `payload/server.py` уже содержит `/v1/responses`, streaming/non-streaming, function/custom tools, Responses Lite `additional_tools`, incremental tool-result continuation, persistent content-free `ConversationSegmentStore` и turn affinity. Это позволяет готовить restart/tool-result harness бесплатно, не заходя в Agent-owned rotation/prompt/delegation.

После снятия Windows/Core safety blockers нужен один bounded уже-авторизованный проектный прогон:
`codex exec → bridge → Notion → локальный tool call → конкретный verifier FAIL → tool result → исправление → повтор verifier → VERIFY_OK`.

После него отдельно проверить restart/recovery незавершённой Core-цепочки без повторения уже выполненного локального side effect.

PR #8 базируется на Core `b6f4eef…` и ушёл до `e12ab315…`; его prompt/rotation/delegation изменения не переносить в Core вручную до стабилизации Core. Проверять только совместимость интерфейсов.

## Следующий порядок

1. В следующем запуске восстановить `NOTION_CORE` из v4 `LATEST` и read-only проверить существующий Windows digest — не перезапускать.
2. Если digest всё ещё pending, продолжить бесплатный Core: exact-source Codex project harness, restart/tool-result lifecycle и rollback invariants.
3. При первом разрешённом native Windows Core gate совместить: точный `auth-rollback` callsite + PowerShell restore-root/destination reparse rejection + overwrite semantics. Не делать новый диагностический fanout.
4. После зелёных Core gates — один настоящий bounded Codex project tool-loop и затем restart/recovery proof.

Product PR #7 в этом запуске не менялся; hosted CI и provider traffic не запускались.
