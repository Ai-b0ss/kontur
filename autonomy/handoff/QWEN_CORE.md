# Qwen — агентное ядро

## 2026-08-19

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `d22bbfb55907e5bd6b531e0d028713459b4380ee`.

Сделано:
- Заново проверены оба репозитория и свежие PR. `qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.
- Межаккаунтный tool-loop остаётся в исправленном виде: хранится пара `upstream chatId + accountId`; старый тред не уходит соседнему аккаунту; при failover полная локальная история один раз переносится в свежий тред нового аккаунта, затем снова идут короткие ходы.
- OpenCode/OpenAI путь в `server.js` сохраняет ту же привязку треда к аккаунту и фактический новый `response.chatId` после failover.
- Офлайн-регресс по-прежнему проверяет `read_file → result → смена аккаунта/треда → полный rebase → bash → result → final`.
- У внутреннего автономного агента снят слишком ранний жёсткий предел в 6 модельных ходов. Теперь по умолчанию разрешено 12 ходов, можно задать `settings.maxRounds`/`QWEN_AGENT_MAX_ROUNDS`, а жёсткий верхний предел остаётся 24. Это даёт агенту закончить более длинную цепочку инструментов, но не превращает цикл в бесконечный.
- При исчерпании лимита агент явно сообщает о безопасной остановке и сохраняет локальную историю, чтобы работу можно было продолжить, а не маскирует остановку под обычный ответ.
- Тест дополнен проверкой допустимого значения, нижней границы, жёсткого потолка и безопасного значения по умолчанию.
- Два режима system prompt сохранены: обычный инженерный и owner-passthrough без примеси OpenCode persona.
- One-shot live bridge и Windows one-shot снова выключены по умолчанию, поэтому новые push не размножают дорогие/живые проверки.

Проверено:
- Новый head `d22bbfb…` полностью зелёный в обычном CircleCI: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success, workflow `dcc6234f-e0bf-4022-bce6-dda197ab7769`.
- Нативная Windows Server 2022 проверка остаётся доказанным PASS на той же продуктовой линии: trigger `a88b4586f895d75e3d61c1f53842598c92add875`, workflow `0e9a0fcf-1aa9-4535-a6cf-ccce14bb182a`, job `3398e251-3d43-42ef-bd31-c723f178865e` — success.
- CAPTCHA остаётся локальной проблемой аккаунта с 10-минутным cooldown и безопасным sibling failover; provider-wide WAF/trust/pressure остаются fail-closed.

Важно:
- Живой многошаговый прогон на текущей усиленной линии всё ещё не доказан. One-shot trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` реально существовал, но доступная GitHub-поверхность по-прежнему не показывает ни его status contexts, ни итог downstream-run; второй provider soak вслепую не запускать.
- PR #6 сейчас отстаёт от `main` на 5 коммитов и остаётся `mergeable=false`. Разница со стороны `main` сосредоточена в `.circleci/config.yml` и новом `.github/workflows/qwen-secret-bridge.yml`; продуктовые файлы агента там не расходятся.
- При будущем сведении нельзя просто перенести `qwen-secret-bridge.yml` из `main` как есть: в нём сейчас GPG passphrase передаётся через аргументы процесса (`--passphrase "$RUNTIME_STATE_KEY"`), тогда как текущая ветка уже специально закрыла этот канал утечки и проверяет его регрессом.

Следующее:
1. Найти фактический результат уже разрешённого live bridge `4de8bdae…` через доступный источник; не дублировать provider traffic.
2. Если та попытка не состоялась либо доказанно не дошла до провайдера — запустить ровно один bounded live PASS на актуальном коде: `read_file → tool result → новый модельный ход → bash → tool result → final`, затем restart и безопасный failover незавершённой цели.
3. После live PASS аккуратно свести PR #6 с актуальным `main`, сохранив CAPTCHA-ротацию, security gates, Windows PASS, более длинный bounded tool-loop и оба режима system prompt; отдельно безопасно переписать secret bridge без passphrase в argv.
