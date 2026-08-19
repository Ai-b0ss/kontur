# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19 09:36 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head `2072688b6b3e4c3f5af5b411dbc1b4584d317a40`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

Что уже сделано в линии надёжности:
- убран искусственный предел `MAX_ACCOUNTS_PER_OPERATION = 2`. Бюджет локального переключения аккаунтов задаётся через `QWEN_ACCOUNT_FAILOVER_BUDGET`, по умолчанию 4, минимум 1, жёсткий потолок 6;
- обычные CAPTCHA/rate limit/expired auth остаются проблемой конкретного аккаунта и позволяют продолжить через следующий подходящий аккаунт; provider-wide WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему немедленно останавливают дальнейшее прощупывание пула;
- регресс на шести тестовых аккаунтах доказывает, что после CAPTCHA A, rate limit B и expired auth C операция доходит до здорового D, не открывая общий provider circuit;
- crash-safe checkpoint OpenCode сохраняет сессию атомарно и умеет восстановиться из последней целой копии после повреждённой записи;
- tool-loop умеет продолжать после tool result и после ошибок инструмента, сохраняет связь Qwen chatId с аккаунтом-владельцем и при смене аккаунта один раз переносит полную локальную историю в новый тред;
- обычный автономный цикл имеет запас 12 модельных ходов с жёстким потолком 24;
- реализованы два режима системного промпта: `engineer` и `owner`, без смешивания приватного owner prompt с большой инженерной персоной;
- runtime/profile recovery не передаёт ключ GPG через argv и не печатает расшифрованные пути/секреты.

Что проверено в этом запуске:
- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и проверены обе Qwen-линии;
- PR #6 с прошлого продуктового head `80a196429ca56a65aa873ed571290fffb66b7ddf` продвинулся только двумя одноразовыми изменениями `.circleci/config.yml`: `0c9a4cd751f4c79f4706e2b243849ed06f09489b` включил Windows parity, `2072688b6b3e4c3f5af5b411dbc1b4584d317a40` сразу выключил его обратно. Продуктовые файлы между `80a19642...` и текущим head не изменялись;
- нативный Windows Server 2022 parity для этого exact продуктового дерева теперь реально PASS: CircleCI workflow `b5ebf45d-a4d9-489c-b8fb-366996678132`, job `qwen-windows-parity` `2355b4dd-2fed-4318-be8e-f749f71cf5e7`; `serial-start` и `serial-end` тоже success;
- на том же trigger-коммите обычные `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` также success в workflow `549b250b-b1b1-45b5-a43f-411c3a863e55`;
- текущий head `2072688b...` после обратного выключения one-shot Windows-триггера тоже полностью зелёный по обычным проверкам: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success, workflow `09f90960-e0ea-4fb7-9e1e-8dec85cb0872`;
- значит Windows-паритет нынешнего продуктового состояния с новым failover budget закрыт; повторять этот дорогой офлайн-прогон без новых Windows-чувствительных изменений не нужно;
- старый разрешённый live trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` повторно проверен. Коммит действительно включал `run_qwen_live_bridge=true`, а конфиг должен был запустить one-shot `qwen-live-bridge`, но GitHub по-прежнему не содержит ни одного status context для этого commit. Поэтому результат живого запуска не доказан, и второй provider-run вслепую не запускался;
- live/provider traffic в этом запуске = 0;
- `qwen-workspace` PR #5 остаётся open, mergeable=true, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`; его кэш-линия не тронута.

Свежий feature-gap:
- официальная документация Qwen Code в июле–августе 2026 уже описывает полноценные subagents: отдельный контекст, настраиваемые инструменты, автономное выполнение и параллельный запуск через `agent` tool;
- там же есть Agent Skills (`.qwen/skills/.../SKILL.md`) и Extensions, которые могут упаковывать prompts, MCP, skills и subagents;
- в наших `qwen-free-api` / `qwen-workspace` собственного слоя `subagent/agent tool/skills/extensions` пока нет. Это реальный пробел возможностей, но до закрытия живого restart/failover лучше не добавлять новый сложный слой. Первым после ядра брать Skills, затем ограниченное делегирование субагентам.

Следующий полезный шаг:
1. Windows parity на нынешнем продукте считать закрытым и не перезапускать без причины.
2. Не повторять live provider-run, пока не установлена судьба `4de8bdae...` или не доказано, что тот pipeline не состоялся. Если прежняя попытка точно не состоялась — выполнить ровно один bounded live сценарий `read_file → tool result → следующий модельный ход → bash → tool result → final`.
3. После одного живого многошагового PASS проверить настоящий `restart → восстановление незавершённой цели → аккаунт A недоступен → продолжение через B` с сохранением tool history.
4. После этого аккуратно свести PR #6 с актуальным `main`, не смешивая отладку provider path с конфликтами основной ветки.
5. Затем feature-gap: сначала Skills/расширяемые инструкции как низкорисковый слой; после этого bounded subagents/agent tool. Веб-поиск и большие документы/мультимодальность — следующие крупные направления.
