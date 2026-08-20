# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Свежий Agent head, снятый read-only: `37abfaa5f0b972a84736c7da669432cd2ed08075`.

## Режим исполнения

Действует ZERO-MINUTE MODE: CircleCI/GitHub Actions/Cloudflare и другие hosted CI не запускать, trigger-push ради CI не делать. Бесплатные Linux/Python/offline проверки — через ChatGPT/container. Native Windows не имитировать через Linux/Wine. Production, реальные пользовательские данные, Notion traffic и секреты не трогать без отдельного уже разрешённого live gate.

Зона `NOTION_AGENT` не дублируется: ротация, prompt modes, delegation и account/thread affinity остаются PR #8. Core касается их только в точке совместимости lifecycle/Codex.

## Постоянная рабочая капсула NOTION_CORE

Текущий проверенный v4 `LATEST`:
- capsule: `20260820T225631Z-94b0ef88fe`;
- archive SHA-256: `1a6cbec858476279027ad2551a87026179139b4c6038d284ea5b83f338be88cd`;
- parts: 1;
- `LATEST.json` Git blob SHA после CAS-публикации: `967a929fa5eabe7610284f6dba8c802c7330671a`.

Единственный part после публикации перечитан из GitHub: size `9768`, Git blob SHA `87ddb09f3cc0352100b31388fc6fdb4cb4aff456`, что совпало с локально рассчитанным blob SHA. Manifest перечитан: size `3141`, Git blob SHA `fa24a9c3fbb113e1ccd478107a4d3e363916cf0e`, также совпал. Предыдущий `LATEST` `20260820T214540Z-d76b548d33` сохранён как `PREVIOUS` перед CAS-переключением указателя.

В начале этого запуска capsule `20260820T214540Z-d76b548d33` была восстановлена из exact part через v4: part/archive/workspace verification прошёл. Linux runtime-restore v4 regression после восстановления снова дал `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

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
- свежий read-only combined status в этом запуске: все пять по-прежнему `pending`.

Нового Windows/hosted запуска не было. Linux-результаты не объявлялись доказательством NTFS/NCM28.

Если digest-разрез позже даст точный callsite/outside-digest, уже существует подготовленный call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. После точного callsite: минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + полный `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore atomicity — кандидат v4

Exact Core `RESTORE_RUNTIME_STATE.sh` / `.ps1` уже не светят `RUNTIME_STATE_KEY` в argv/child env: ключ идёт через stdin `--passphrase-fd 0`. Исходники PR #7 всё ещё расшифровывают прямо в конечный путь и потому небезопасны при частичной ошибке `gpg`.

Кандидат v4 закрывает на Linux: partial final, temp cleanup, directory/symlink destination, restore-root symlink, restore-root regular file, создание отсутствующего root с mode 700, сохранение exit codes и отсутствие секрета в argv/env. Вердикт повторно подтверждён: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Долговечные материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point и overwrite/atomic replace semantics **не доказаны**. Это объединить с одним будущим разрешённым Windows Core gate вместе с точным `auth-rollback` callsite; отдельный fanout не создавать.

## Codex Core / lifecycle

Exact Core `payload/server.py` уже содержит `/v1/responses`, streaming/non-streaming, function/custom tools, Responses Lite `additional_tools`, incremental tool-result continuation, persistent `ConversationSegmentStore` и turn affinity.

Ранее доказан Core integration gap на точном PR #7: persistent segment identity хеширует только Responses input items, поэтому после restart изменившийся tool/runtime contract мог ошибочно продолжить старую Notion-ветку. PR #8 уже независимо закрывает эту границу: prompt-policy fingerprint, engineer instructions, tools/tool_choice и structured-output contract входят в persistent segment identity, а `tests/test_prompt_policy_identity.py` покрывает tool catalog, structured output, engineer context и owner policy. Этот фикс вручную в Core не переносить; перед `NOTION_CORE_DONE` combined Core+Agent exact head обязан пройти restart/tool-result regression.

### Новый Core/Codex security gap: окружение shell в реальном Codex probe

На свежем PR #8 точный `tools/run_real_codex_cli_project_probe.py` пишет временный `config.toml` с `NOTION_BRIDGE_API_KEY` как `env_key` провайдера, но вообще не задаёт `shell_environment_policy`. В текущем upstream Codex default для shell policy — `inherit=all` и `ignore_default_excludes=true`. Значит model-reachable shell может унаследовать окружение процесса Codex, включая `NOTION_BRIDGE_API_KEY`, если явно не задать более строгую политику.

Подготовлен bounded integration-only кандидат, не затрагивающий ротацию/prompt/delegation:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Он сохраняет только базовые системные переменные, а стандартный фильтр Codex вырезает имена с `KEY/SECRET/TOKEN`. Локальная модель `populate_env` на exact текущей семантике Codex показала, что `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый `AWS_SECRET_ACCESS_KEY` не доходят до shell. Вердикт: `CODEX_PROBE_SHELL_ENV_POLICY_CANDIDATE_PASS`.

Долговечные материалы:
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy.json`;
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy_candidate.patch`.

Product PR #8 из-за ZERO-MINUTE не менялся: его push может запустить hosted CI. Перед настоящим уже-авторизованным Codex probe сначала материализовать/применить этот integration-only patch локально либо после снятия ZERO-MINUTE, затем прогнать его contract test. Живой probe до этого не запускать.

Core live probe пока не запускался. После снятия Windows/Core safety blockers нужен один bounded уже-авторизованный проектный прогон:
`codex exec → bridge → Notion → локальный tool call → конкретный verifier FAIL → tool result → исправление → повтор verifier → VERIFY_OK`.
После него отдельно проверить restart/recovery незавершённой Core-цепочки без повторения уже выполненного локального side effect и с combined contract-identity regression выше.

## Следующий порядок

1. В начале следующего запуска восстановить `NOTION_CORE` из v4 `LATEST` и read-only проверить существующий Windows digest — не перезапускать.
2. Если digest всё ещё pending, продолжать бесплатный Core: применить Codex probe shell-env hardening к materialized exact PR #8 probe и прогнать targeted offline contract; затем combined restart/tool-result harness и rollback invariants. Не дублировать Agent prompt/rotation/delegation код.
3. При первом разрешённом native Windows Core gate совместить: точный `auth-rollback` callsite + PowerShell restore-root/destination reparse rejection + overwrite semantics. Не делать новый диагностический fanout.
4. После зелёных Core gates — один настоящий bounded Codex project tool-loop с защищённым shell environment, затем restart/recovery proof на combined Core+Agent contract.

Product PR #7/PR #8 в этом запуске не менялись; hosted CI и provider traffic не запускались.
