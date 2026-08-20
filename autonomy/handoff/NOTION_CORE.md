# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head, снятый read-only: `a68c9296c517cfd8712d0baa21db43a36a13ccd8`.

## Режим исполнения

Действует ZERO-MINUTE MODE: CircleCI/GitHub Actions/Cloudflare и другие hosted CI не запускать, trigger-push ради CI не делать. Бесплатные Linux/Python/offline проверки — через ChatGPT/container. Native Windows не имитировать через Linux/Wine. Production, реальные пользовательские данные, Notion traffic и секреты не трогать без отдельного уже разрешённого live gate.

Зона `NOTION_AGENT` не дублируется: ротация, prompt modes, delegation и account/thread affinity остаются PR #8. Core касается их только в точке совместимости lifecycle/Codex.

## Постоянная рабочая капсула NOTION_CORE

Текущий проверенный v4 `LATEST`:
- capsule: `20260820T214540Z-d76b548d33`;
- archive SHA-256: `57d9e9c20c91a43a55049168e999e99432e221fedd6fc46a9bb5e98413b1837e`;
- parts: 1;
- `LATEST.json` Git blob SHA после CAS-публикации: `7415f865801d8d6d26ccb9339be53e8206aa0be9`.

Единственный part после публикации перечитан через GitHub directory API: size `8248`, Git blob SHA `b6738be4596c56da08263d126bbe4b9a46dc7d80`, что точно совпало с локально рассчитанным blob SHA. Manifest после публикации перечитан: size `2686`, Git blob SHA `70d8c282daa40f6ab21bf18c356fbe37c09c3a04`, также точное совпадение. Предыдущий `LATEST` `20260820T204431Z-bee456b329` сохранён как `PREVIOUS` перед CAS-переключением указателя.

В начале запуска предыдущая валидная capsule `20260820T204431Z-bee456b329` была восстановлена через v4; archive/workspace verification прошёл.

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

Кандидат v4 закрывает на Linux: partial final, temp cleanup, directory/symlink destination, restore-root symlink, restore-root regular file, создание отсутствующего root с mode 700, сохранение exit codes и отсутствие секрета в argv/env. Вердикт остаётся `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Долговечные материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point и overwrite/atomic replace semantics **не доказаны**. Это объединить с одним будущим разрешённым Windows Core gate вместе с точным `auth-rollback` callsite; отдельный fanout не создавать.

## Codex Core / lifecycle

Exact Core `payload/server.py` уже содержит `/v1/responses`, streaming/non-streaming, function/custom tools, Responses Lite `additional_tools`, incremental tool-result continuation, persistent `ConversationSegmentStore` и turn affinity.

В этом запуске доказан новый Core integration gap на точном PR #7. Persistent `ConversationSegmentStore.response_input_fingerprints()` в Core хеширует только Responses input items. Поэтому после restart старый Notion segment может ошибочно считаться продолжимым, если прежний input остаётся prefix, но изменился runtime contract — например tool catalog, `instructions` или structured output. В воспроизведении: старый input + `read_file`; после restart тот же input + исторический function call + новый function_call_output, но catalog уже `write_file`. Core получил `prefix_length=1`, отфильтровал historical function call и отправил в continuation только tool result, при этом incremental prompt велит использовать catalog «from earlier in this thread» — то есть старый contract. Вердикт: `CORE_CODEX_LIFECYCLE_CONTRACT_DRIFT_REPRO_PASS`.

PR #8 уже независимо закрывает именно эту границу: в его `response_input_fingerprints()` content-free prompt-policy fingerprint, engineer instructions, tools/tool_choice и structured-output contract смешиваются в fingerprint каждого input item, не ломая prefix indexing. На том же сценарии формула PR #8 даёт `prefix=None`, то есть безопасный segment rollover. В `tests/test_prompt_policy_identity.py` уже есть targeted cases для tool catalog, structured output, engineer context и owner policy. Поэтому этот фикс **не переносить вручную в Core** — это зона NOTION_AGENT. Но перед `NOTION_CORE_DONE` combined Core+Agent exact head обязан пройти restart/tool-result regression, чтобы старый tool/runtime contract не переживал restart.

Долговечное evidence: `autonomy/evidence/notion/20260820T2140Z_codex_restart_contract_drift.json`.

Core live probe пока не запускался. После снятия Windows/Core safety blockers нужен один bounded уже-авторизованный проектный прогон:
`codex exec → bridge → Notion → локальный tool call → конкретный verifier FAIL → tool result → исправление → повтор verifier → VERIFY_OK`.
После него отдельно проверить restart/recovery незавершённой Core-цепочки без повторения уже выполненного локального side effect и с combined contract-identity regression выше.

## Следующий порядок

1. В следующем запуске восстановить `NOTION_CORE` из v4 `LATEST` и read-only проверить существующий Windows digest — не перезапускать.
2. Если digest всё ещё pending, продолжить бесплатный Core: exact-source restart/tool-result harness на combined lifecycle contract, rollback invariants и подготовку project probe; не дублировать Agent prompt/rotation/delegation код.
3. При первом разрешённом native Windows Core gate совместить: точный `auth-rollback` callsite + PowerShell restore-root/destination reparse rejection + overwrite semantics. Не делать новый диагностический fanout.
4. После зелёных Core gates — один настоящий bounded Codex project tool-loop, затем restart/recovery proof на combined Core+Agent contract.

Product PR #7 в этом запуске не менялся; hosted CI и provider traffic не запускались.
