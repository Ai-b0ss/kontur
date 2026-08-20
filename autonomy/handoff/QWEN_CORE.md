# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `5022f1b921b15ca49829d0cac25804d411deac94`, PR остаётся draft/open и `mergeable=false` относительно текущего `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, `mergeable=true`. В этом запуске не менялся; `orchestrator/cache.mjs` и его тесты заново просмотрены.

Что сделано сейчас:
- В начале заново прочитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff и живые PR/исходники обоих Qwen-репозиториев. Старый handoff был устаревшим: до начала этого запуска PR #6 уже дошёл до `03d722c3…`; последние два чужих коммита добавили нормальный стандартный layout skills (`name/SKILL.md`) и проверки границ skill-пути.
- Найден реальный дефект двухрежимного system-prompt passthrough. В режиме `owner` приватный prompt действительно не смешивался с инженерной персоной, но вместе с клиентской персоной код выбрасывал и явные проектные правила `Instructions from: ...` (например AGENTS/PROJECT из OpenCode). Владелец получал чистый приватный prompt ценой потери технических инструкций проекта.
- `src/qwen-v3-capabilities.js` теперь разделяет эти вещи. Приватный owner prompt остаётся главным и передаётся без переписывания; обычная клиентская/OpenCode-персона удаляется; только явные `Instructions from:` сохраняются отдельным нейтральным техническим контекстом. Это работает и для `owner_system_prompt`, и для OpenCode owner-mode, где приватный prompt выделяется из `<mcp_instructions>`.
- Добавлен `extractProjectInstructionBlocks()`. Неразмеченный system-текст код намеренно не пытается угадывать как «правила проекта»: в owner-mode он может оказаться конкурирующей персоной и поэтому не подмешивается.
- Усилен `scripts/system-prompt-mode-test.js`: отдельно проверяются точный приватный prompt + AGENTS, удаление клиентской персоны, OpenCode owner-mode + PROJECT rules и реальный путь через `chatAdapter.preparePublicPayload()` до итогового Qwen payload.

Коммиты этого запуска в `qwen-free-api`:
- `92dc9ef3939a2b4b129af40379980ebc12b830e3` — сохранить проектные правила рядом с приватным owner prompt;
- `5022f1b921b15ca49829d0cac25804d411deac94` — регресс на owner/OpenCode project context.

Что проверено:
- PR #6 действительно указывает на `5022f1b9…`.
- `system-prompt-mode-test.js` уже входит в общий `npm test`, поэтому новый регресс автоматически входит в обычный CircleCI.
- `qwen-workspace` PR #5 по-прежнему `468733b2…`, `mergeable=true`.
- CAPTCHA-ротация, account/thread affinity, многошаговый tool-loop, checkpoint, vision и provider-safety этим изменением не затрагивались.
- Новый живой запрос к Qwen не запускался; прежний разрешённый provider-run не дублировать вслепую.
- GitHub status для exact head `5022f1b9…` пока не показывает CircleCI contexts, поэтому полный regression зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический обычный CircleCI/`npm test` на `5022f1b9…`. Если красный — чинить конкретную ошибку, не откатывая CAPTCHA-ротацию и account/thread семантику.
2. Проверить найденную при чтении `server.js` границу eligibility: сейчас `preparePublicPayloadGoverned()` и выбор `preferredAccount` ещё имеют fallback на `accountStore.current()`. Если все аккаунты временно в cooldown, это может передать V3/vision текущий, но уже неразрешённый аккаунт до того, как `qwen-client` отфильтрует кандидатов. Нужен fail-closed выбор только из `accountStore.candidates()` и отдельный regression без provider traffic.
3. После зелёного офлайн-набора — один bounded Windows offline parity на exact продуктовой линии без provider traffic.
4. Затем восстановить результат прежней разрешённой live-попытки. Второй provider-run вслепую не запускать.
5. Если прежняя попытка до провайдера не дошла, провести ровно один живой многошаговый проход `read_file → Qwen → tool result → bash → Qwen → final`, затем проверить restart и безопасный failover незавершённой цели.
6. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret-bridge/checkpoint решения.
