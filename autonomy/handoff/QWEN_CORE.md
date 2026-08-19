# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `5e12b452c0d499ac2d91b6e520ee38d4b05b5a9f`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true. Текущий `orchestrator/cache.mjs` заново просмотрен; изменений в workspace в этом проходе не было.

Сделано:
- Сначала снят реальный итог прошлого head `d706f3ea...`: все три обычные CircleCI-проверки были зелёными.
- Найден дефект агентного терминала: команда с ненулевым exit code могла вернуться модели обычным результатом, потому что `runCommand()` терял отдельный `stderr`, а обработчик `bash` проверял уже пустое поле. Для coding-agent это опасно: упавшие тесты/сборка могли выглядеть как успех.
- `src/tool-executor.js` теперь сохраняет stderr и любой реально запущенный shell-процесс с ненулевым кодом возвращает `Error: command failed (exit N)` с выводом команды. Даже тихий `process.exit(9)` считается ошибкой.
- Сохранён прежний контракт защиты workspace: локально отклонённый `cwd` с кодом 126 по-прежнему возвращается как `Error: Path escapes workspace...`, а не маскируется под обычное падение команды.
- Добавлен `scripts/tool-command-failure-test.js`: успешная команда остаётся успехом; stderr+exit 7 и тихий exit 9 обязаны быть ошибками. Тест включён в общий `npm test`.
- Первый вариант исправления поймал настоящий регресс старого workspace-boundary теста; исправлено без отката новой семантики ошибок.

Проверено:
- Exact head `5e12b452...` полностью зелёный в CircleCI, workflow `49ba84d6-3cd8-4692-b3ed-83602c552553`: `qwen-offline-regression=success`, `qwen-runtime-secret-gate=success`, `qwen-long-soak-policy-gate=success`.
- CAPTCHA-ротация, provider-wide fail-closed, привязка Qwen-треда к аккаунту, многошаговый tool-loop, checkpoint/restart и два режима системного промпта не ослаблены.
- `system-prompt-mode-test.js` заново просмотрен: explicit owner prompt идёт без переписывания; generic owner prompt не режется по буквальному `<mcp_instructions>`; OpenCode-wrapper выделяется только при положительной идентификации; engineer mode сохраняет базовый инженерный prompt отдельно от project/tool content.
- Новый provider traffic не запускался. Старый one-shot live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не дублировался.

Следующее:
1. Главный недоказанный рубеж — один настоящий живой многошаговый путь в уже авторизованной среде: `read_file → tool result → следующий ход Qwen → bash → tool result → final`, затем restart и безопасный failover незавершённой цели.
2. Сначала восстановить фактический результат старого разрешённого live bridge `4de8bdae…`; второй provider-run запускать только если доказано, что прежний до провайдера не дошёл.
3. После live PASS аккуратно свести PR #6 с актуальным `main`, не потеряв безопасный канал секретов, CAPTCHA-ротацию, provider-circuit, prompt-режимы, checkpoint и строгую привязку треда к аккаунту.
4. После сведения продолжать усиливать именно автономность coding-agent: реальные многошаговые задачи, самовосстановление после ошибок инструментов и полезные возможности веб-Qwen.
