# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `b87793e39ba4a03571dafbaad96b099b38742cf1`, PR draft/open, `mergeable=false` относительно `main`.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

Что сделано:
- Заново прочитаны OWNER_INTENT/CURRENT/handoff, затем живые PR и исходники обоих Qwen-репозиториев. Живой `qwen-free-api` head в начале запуска был `e7d7ca50…`, как в handoff.
- Найден дефект в coding-subagents: пользовательский/диагностический `onEvent` выполнялся внутри основного agent-loop. Если такой наблюдатель падал после уже выполненного tool-события, он мог оборвать задачу и последующий повтор рисковал повторить файловый/terminal side effect.
- В `src/subagent-agent-runner.js` наблюдатель событий изолирован от исполнения задачи: исключение `onEvent` больше не роняет coding-subagent и не превращает сбой UI/логирования в повтор tool-эффекта.
- Сохранён точный `taskId` в событиях, включая идентификаторы с дефисами; промежуточная реализация сразу поправлена до записи регресса.
- В `scripts/subagent-agent-runner-test.js` добавлен сценарий, где `onEvent` намеренно бросает исключение после `read_file`; сама coding-задача обязана завершиться успешно, а событие — сохранить точные `taskId/sessionId`.
- `qwen-workspace` заново перечитан. Текущий cache-код на `ce51b26c…` сохраняет исправленный путь `.runtime/cache.json`, очистку протухших записей и безопасные временные файлы; новых правок туда не потребовалось.

Что проверено:
- PR #6 реально обновлён до `b87793e39ba4a03571dafbaad96b099b38742cf1`.
- CAPTCHA-ротация, account/thread affinity, bounded failover, provider circuit, основной tool-loop, crash-safe session store и оба режима system prompt этим изменением не ослаблялись.
- Живой Qwen не запускался и старая разрешённая provider-попытка не дублировалась.
- Через GitHub combined-status для exact head пока нет опубликованных CircleCI checks (`statuses=[]`), поэтому полный regression зелёным не объявлять без фактического результата.

Следующее:
1. Снять фактический CircleCI/`npm test` на `b87793e3…`; в первую очередь проверить `subagent-agent-runner-test.js` вместе с session-store регрессами. Если красный — чинить конкретное падение, не откатывая CAPTCHA-ротацию и observer isolation.
2. После offline green — один bounded Windows offline parity на exact продуктовой линии, без provider traffic.
3. Затем восстановить судьбу старой разрешённой live-попытки. Только если доказано, что она до провайдера не дошла, выполнить ровно один живой `read_file → tool result → следующий модельный ход → bash → tool result → final`, затем restart и безопасный failover незавершённой задачи.
4. После live PASS аккуратно свести PR #6 с текущим `main`, не возвращая старые небезопасные secret/checkpoint решения.
