# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-23.

## Текущая линия
- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh product head после текущего Core-исправления: `5fdcbb3a10ccfc1413baa3b0a25b155e23b36258`.
- OWNER TEMPORARY CIRCLE FREEZE из `kontur#9` всё ещё действует: CircleCI/gate branches не запускать и не двигать до явной разморозки владельцем.

Перед новой записью fresh-read PR #6, `autonomy/OWNER_INTENT_RU.md`, `autonomy/CURRENT_RU.md`, QWEN_RELIABILITY, issue #9, Circle policy, v4 runtime, LATEST/PREVIOUS.

## Новый закрытый Core-дефект: coding-subagent терял явно заданную идентичность сессии

На предыдущем exact `src/subagent-agent-runner.js` blob `4a4097c558751f4620fad428fcbf9e53267877bb` функция `safeSessionPrefix()` делала `String(value || random).trim()`.

Из-за этого явно переданные плохие значения `sessionPrefix` — `''`, пробелы, `null`, `false`, `0` — могли молча превратиться в новый случайный `subagent-agent-<uuid>` вместо локального отказа. Для возобновляемого coding-subagent это серьёзный replay/session defect: владелец/оркестратор мог думать, что продолжает конкретную сессию, а код незаметно начинал новую.

Plain `subagent-dispatcher` уже имел fail-closed семантику; coding-subagent от неё отставал.

### Исправление
- root fix commit `bd6e01aa7d280e57413370bdbf4f43de66c7edcf`;
- follow-up compatibility fix `5fdcbb3a10ccfc1413baa3b0a25b155e23b36258`;
- current `src/subagent-agent-runner.js` blob `724cb5bed51f243805294906630530e57c02938b`.

Новая семантика:
- поле `sessionPrefix` отсутствует -> генерируется новый `subagent-agent-<uuid>`;
- поле явно передано -> обязано быть непустой безопасной строкой;
- `''`, whitespace-only, `null`, `false`, `0`, object -> `QWEN_SUBAGENT_SESSION_ID_INVALID` до запуска agent/provider;
- прямой экспорт `safeSessionPrefix('valid-prefix')` сохраняет прежнюю ожидаемую семантику и валидирует переданную строку, а не генерирует случайный id.

Hosted targeted check без provider/CI:
`QWEN_CODING_SUBAGENT_SESSION_PREFIX_TARGET_PASS invalid=6 omitted_random=2 direct_valid=1 wired_valid=1`.

## Канонический regression очищен и усилен

Существующий `scripts/subagent-agent-runner-test.js` уже входил в штатный `npm test`, поэтому новый invariant не оставлен standalone. В него добавлены 6 bad-prefix cases и проверка `agent/provider calls = 0` на каждом таком отказе.

Заодно в этом же тесте исправлены две устаревшие проверки, которые уже противоречили действующему продукту и отдельным свежим regression:
- owner prompt invalid/blank теперь ожидает `QWEN_SUBAGENT_OWNER_PROMPT_INVALID`, как и `subagent-owner-prompt-validation-test.js`;
- read-only round-limit теперь ожидает `uncertain=false`, потому что `read_file` не является потенциальным side effect и такой незавершённый read-only ход безопасно повторяем.

Отдельно созданный временный `subagent-agent-session-prefix-test.js` был удалён после переноса invariants в уже штатный canonical runner test, чтобы не накопить standalone regression вне `npm test`.

Текущий canonical runner-test blob после синхронизации: `e0061a19600ba008076f0e4744d02ebc9c3953f0`.

## Сохраняющий силу Core restart/session proof
До текущего прохода на exact session-store bytes были зелёными:
- nested durable session schema fail-closed;
- owner authority type checks;
- большой owner-system checkpoint/restart;
- tool-result durable-before-next-Qwen;
- pending multi-tool restart;
- stale-backup fail-closed.

Текущий проход менял только `src/subagent-agent-runner.js` и его canonical regression; `session-store`, `server`, `chat-adapter`, tool-result/restart bytes не затронуты. Эти proof сохраняют силу.

## QWEN_RELIABILITY — не пересекать
Fresh handoff перед работой:
- account/cooldown/index/filename cluster: 8/8 exact PASS;
- provider-circuit cluster: 7/8 exact PASS;
- единственный Reliability proof gap: exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree с axios; shim/reconstructed dependency proof не принимается.

Core не менял `account-store`, cooldown или provider-circuit.

## Что осталось до финиша
1. На свежем стабильном общем SHA локально прогнать exact Core cluster: owner/session/restart/stale-backup/pending-tool + plain/coding subagent + stream/tool-result, включая обновлённый canonical `subagent-agent-runner-test.js`.
2. Reliability exact `provider-safety-test.js` на том же product SHA.
3. Full exact-tree Linux `npm test` на стабильном общем SHA.
4. Пока Circle freeze действует — максимум `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`.
5. После явной разморозки — один native Windows Server 2022 final gate на тех же product bytes, locked install + полный offline suite, без provider/live/secrets/production.
6. Только после Linux + native Windows green — PowerShell owner-doctor/acceptance harness с `QWEN_WINDOWS_READY` либо первым точным blocker; проверить harness в native Windows Circle.

`QWEN_CORE_DONE` пока нет.

## Постоянная память / v4 CAS
Последний нормативно подтверждённый pointer из предыдущего handoff:
- capsule `20260823T021610Z-f761e59acb`;
- archive SHA-256 `78be915380698f3af3b6d4806b54bcbca4dd8ba428cca46165a4d7593517e3d6`;
- source_ref `04b9f75f62da4d5380e3b5a5dfee76e7d18180cb`;
- pointer blob `df27abdb99b66f68dc3a68aa8b95c93fc304a717`.

В этом проходе новый v4 pointer не публиковался: фактический путь LATEST/PREVIOUS/runtime через доступную GitHub-поверхность по-прежнему не разрешён надёжно. Force-write и pseudo-v4 запрещены, поэтому существующий pointer не подменялся.

Provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI в этом проходе = 0.
