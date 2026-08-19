# Qwen — надёжность, пул аккаунтов и расширение возможностей

Обновлено: 2026-08-19.

Текущая рабочая линия: `Ai-b0ss/qwen-free-api`, ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, head `ca7918b021b5a7e4f349f6d408b76ed19f766097`.
`Ai-b0ss/qwen-workspace` PR #5 без изменений: `468733b2e3c8a2fb9bc04220fb6fd909ae0a4e80`, mergeable=true.

Что сделано в этом запуске:
- заново прочитаны owner intent/current/handoff и проверены обе Qwen-линии; пересекающейся свежей записи в `qwen-workspace` нет;
- фактический Windows результат найден: one-shot trigger `a88b4586f895d75e3d61c1f53842598c92add875` прошёл в CircleCI. `qwen-windows-parity` = success, workflow `0e9a0fcf-1aa9-4535-a6cf-ccce14bb182a`, job `3398e251-3d43-42ef-bd31-c723f178865e`. Значит нативный Windows Server 2022 + Node 22 + полный `npm test` закрыты зелёным доказательством;
- найден реальный риск restart/state recovery: `src/session-store.js` раньше писал `opencode-sessions.json` прямо поверх файла. Падение процесса/машины во время записи могло оставить битый JSON, после чего следующий запуск молча стартовал с пустой картой сессий и терял незавершённую tool-chain;
- исправлена запись session checkpoint: уникальный временный файл, `fsync`, затем замена основного файла; последняя полностью записанная копия хранится как backup. При повреждённом основном JSON startup восстанавливает состояние из backup;
- добавлен офлайн-регресс `scripts/session-store-restart-test.js`: он сохраняет историю с `tool` result, намеренно портит основной файл, заново загружает session store и проверяет, что chat/account/history восстановились, а частичный `continue` получает прежний tool-result. Затем проверяет, что новый успешный persist чинит primary и только после этого обновляет backup;
- тест включён в обычный `npm test`;
- live Qwen/provider запуск не дублировался.

Проверки/доказательства:
- Windows parity: PASS на trigger `a88b4586...`;
- текущий head `ca7918b...`: обычный CircleCI полностью зелёный — `qwen-offline-regression`, `qwen-runtime-secret-gate`, `qwen-long-soak-policy-gate`, workflow `f9b253e5-09ef-4526-8c8c-16faea8f50b8`;
- значит новый crash-safe restart checkpoint и его регресс проходят на Linux CI вместе со всем текущим offline-набором;
- прежний live bridge trigger `4de8bdae6d0c28789181f31b6212f97e6e283333` не повторялся. Через GitHub для него сейчас нет status contexts, поэтому нельзя честно говорить ни PASS, ни FAIL, ни что он вообще дошёл до provider job;
- `qwen-workspace` PR #5 остаётся отдельной стабильной линией кэша, его не трогать без отдельной причины.

Следующий полезный шаг:
1. При первой удобной возможности сделать один bounded Windows offline прогон уже на `ca7918b...`, потому что session-store изменился после прежнего Windows PASS. Не запускать provider traffic ради этой проверки.
2. Установить судьбу уже отправленного live bridge `4de8bdae...` через CircleCI/GitHub run evidence. Не запускать второй provider run вслепую.
3. Если прежняя live попытка не состоялась, сделать ровно один bounded live сценарий `read_file → tool result → следующий модельный ход → bash → tool result → final`, затем restart и failover незавершённой цели на другой доступный легитимный аккаунт.
4. После живого PASS аккуратно свести PR #6 с актуальным `main` и только потом расширять feature-gap обычного веб-Qwen: сначала веб-поиск, большие документы/мультимодальность и субагенты.
