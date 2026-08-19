# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19 08:48 МСК.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. Текущий head `80a196429ca56a65aa873ed571290fffb66b7ddf`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

Что сделано в этом запуске:
- заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и проверены обе Qwen-линии;
- перед изменениями подтверждено, что другой Qwen-рабочий продвинул PR #6 до `9ffd5c36...`, но его свежие изменения не затрагивали `src/qwen-client.js` и `scripts/provider-safety-test.js`, поэтому взята независимая линия пула;
- убран искусственный предел `MAX_ACCOUNTS_PER_OPERATION = 2`. Теперь бюджет account-local failover настраивается через `QWEN_ACCOUNT_FAILOVER_BUDGET`, по умолчанию равен 4, минимум 1, жёсткий потолок 6;
- логика выбора кандидатов вынесена в `operationCandidates()`, и оба пути — создание нового Qwen chat и отправка chat completion — используют один и тот же bounded budget;
- provider-wide классы не ослаблены: WAF/trust restriction, provider pressure и неоднозначный timeout по-прежнему немедленно останавливают дальнейшее прощупывание соседних аккаунтов;
- обычные локальные CAPTCHA/rate limit/expired auth по-прежнему выводят только конкретный аккаунт в cooldown/неактивность и позволяют перейти к следующему;
- `provider-safety-test.js` расширен до шести тестовых аккаунтов. Регресс теперь явно доказывает, что после трёх подряд локальных проблем (CAPTCHA A, rate limit B, expired auth C) пул всё ещё доходит до здорового D, при этом provider-wide circuit не открывается;
- тот же тест фиксирует default budget=4 и hard cap=6, чтобы будущая правка не превратила ротацию в безграничный перебор;
- обычный CircleCI на exact head `80a19642...` полностью зелёный: `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate` — success; workflow `338c2c1c-349b-4f4d-8b6a-9c6e871ae172`;
- live Qwen/provider вызовов не было. Старый live trigger `4de8bdae...` повторно проверен: у commit по-прежнему нет GitHub status contexts, поэтому второй provider-run вслепую не запускался;
- `qwen-workspace` не тронут.

Проверки/доказательства:
- PR #6 сейчас open/draft, head `80a196429ca56a65aa873ed571290fffb66b7ddf`, mergeable=false относительно текущего main;
- продуктовый коммит пула: `35ee1bf795564695c3a4a3d9001d2e4c06bd09d8`;
- регрессионный коммит: `80a196429ca56a65aa873ed571290fffb66b7ddf`;
- `src/account-store.js` остаётся без изменений: CAPTCHA = 10 минут локального cooldown, rate limit = 6 часов локального cooldown;
- `src/qwen-client.js`: default account-local budget 4, hard cap 6, provider-wide stop-classes не изменены;
- CircleCI statuses на `80a19642...`: все три обычных job success;
- live/provider traffic в этом запуске = 0.

Свежий feature-gap:
- официальная документация Qwen Code в июле–августе 2026 уже описывает полноценные subagents: отдельный контекст, настраиваемые инструменты, автономное выполнение и параллельный запуск через `agent` tool;
- там же есть Agent Skills (`.qwen/skills/.../SKILL.md`) и Extensions, которые могут упаковывать prompts, MCP, skills и subagents;
- в наших `qwen-free-api` / `qwen-workspace` по целевому поиску сейчас нет собственного слоя `subagent/agent tool/skills/extensions`. Это реальный пробел возможностей, но добавлять его до закрытия live restart/failover не стоит: сначала доказать ядро, затем лучше всего начать с лёгкого совместимого слоя Skills, потом bounded subagent delegation.

Следующий полезный шаг:
1. На exact head `80a19642...` выполнить один bounded Windows offline parity без provider traffic; старый Windows PASS относится к более ранней линии.
2. Не повторять live provider-run, пока не установлена судьба `4de8bdae...` или не доказано, что тот pipeline не состоялся.
3. После одного живого многошагового PASS проверить настоящий restart + восстановление незавершённой цели + недоступность аккаунта A + продолжение через B с сохранением tool history.
4. После этого аккуратно свести PR #6 с актуальным `main`.
5. Затем feature-gap: сначала Skills/расширяемые инструкции как низкорисковый слой; после этого bounded subagents/agent tool. Веб-поиск и большие документы/мультимодальность остаются следующими крупными направлениями, но не должны ломать основное агентное ядро.
