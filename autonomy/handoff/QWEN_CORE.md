# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `b87793e39ba4a03571dafbaad96b099b38742cf1`, PR draft/open, `mergeable=false` относительно `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

### Текущий запуск QWEN_CORE / ZERO_MINUTE

- FREE FABRIC control-plane подтверждён: generation=1, `ZERO_MINUTE`, `STATIC_NO_CAS`, назначение `E1-QWEN-CORE -> QWEN_CORE`, work stealing запрещён.
- Одноразовый E1-v2 compute-probe реально выполнен в ChatGPT hosted Linux без hosted CI и без provider traffic. Challenge digest: `da181495e2ea060f8025ff931cebca05e04ee231b4831913181dbd90b7f47ce0`; CPU cgroup `400000 100000`, memory `4294967296`, Python 3.13.5, Node 22.16.0, Chromium `/usr/bin/chromium`, ffmpeg `/usr/bin/ffmpeg`.
- После повторной проверки owner/control state обязательный результат E1-v2 опубликован в `Ai-b0ss/kontur#16`: comment id `5355608129`, маркер `E1_V2_EXECUTABLE_COMPUTE_RESULT`, digest и сырой probe output. До публикации маркера в issue не было. Повторный provider/CI путь не использовался. Прямого Library write/replace интерфейса в этом запуске нет, поэтому `/Autonomy/FREE_FABRIC/experiments/E1/SCHEDULED_QWEN_CORE_E1_V2.json` не опубликован и не заявляется как сохранённый.
- Fresh read-only сверка PR #6 и `src/account-store.js` подтверждает узкий fail-open в `server.js`: `accountStore.candidates()` корректно фильтрует cooldown/provider-circuit, но верхний OpenCode route при пустом списке всё ещё может оживить `accountStore.current()`. Аналогично `retryEmpty` может вернуть старый `preferredAccount`, если пул стал пустым.
- Подготовлен bounded candidate без push: удалить `|| accountStore.current()` из выбора `preferredAccount`; если аккаунты настроены, но все временно недоступны — `503 QWEN_NO_ELIGIBLE_ACCOUNT`, а отсутствие аккаунтов оставить `401`; в `retryEmpty` при пустом `candidates()` возвращать `null`, не оживляя stale preferred.
- Уровень проверки кандидата пока только `STATIC_EXACT_SOURCE_REVIEW_PLUS_POLICY_CANDIDATE`: полный `npm test` на exact tree в этом запуске не выполнен, потому что приватное дерево репозитория не материализовано целиком в локальный контейнер. Не переносить patch в PR до локального regression.
- `qwen-workspace` PR #5 свежо перепроверен: exact head `ce51b26c…`, `mergeable=true`; cache source/test получены read-only. Локально выполнен только реконструированный smoke на кэш-логику, поэтому он не заменяет канонический `node --test orchestrator/test/cache.test.mjs` на exact tree и не повышает статус доказательства.
- Hosted CI, CircleCI, GitHub Actions, provider traffic, deploy и production writes в этом запуске не использовались.

### Что было сделано ранее на текущей линии

- В `src/subagent-agent-runner.js` наблюдатель событий изолирован от исполнения задачи: исключение `onEvent` больше не роняет coding-subagent и не превращает сбой UI/логирования в повтор tool-эффекта.
- Сохранён точный `taskId` в событиях, включая идентификаторы с дефисами; в `scripts/subagent-agent-runner-test.js` есть сценарий, где `onEvent` намеренно падает после `read_file`, а coding-задача обязана завершиться успешно.
- CAPTCHA-ротация, account/thread affinity, bounded failover, provider circuit, основной tool-loop, crash-safe session store и оба режима system prompt остаются частью текущей линии.
- `qwen-workspace` на `ce51b26c…` сохраняет исправленный путь `.runtime/cache.json`, очистку протухших записей и безопасные временные файлы; новых правок туда сейчас не требуется.

### Следующее

1. В бесплатном ChatGPT-container материализовать достаточный exact-tree PR #6 и прогнать локально существующие account-selection/server/session/thread regressions вместе с новым zero-minute eligibility сценарием. Hosted CI не использовать.
2. Если regression зелёный — только тогда перенести bounded patch в ветку, после повторной проверки owner/control state; push не делать ради CI.
3. Windows native validation пока считать BLOCKED согласно PLATFORM_CONTRACT (`windows.validation_os`/`windows.native_ntfs_oracle`), не подменять её hosted CI.
4. Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
5. После доказанного offline ядра и одного допустимого live-run закрыть `read_file → tool result → следующий модельный ход → bash → tool result → final`, restart и безопасный failover незавершённой задачи.
