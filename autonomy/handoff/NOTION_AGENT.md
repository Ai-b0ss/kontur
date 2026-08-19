# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 14:48 МСК

Notion Core продолжает отдельную Windows/NCM28 линию: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `85940ba8499b42f6ab0deb248ff6c5490d9f65ee`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. До этого запуска head был `ccfad1a963e97e3e0d63d5fb8bb8a4ab39b87dec`; текущий рабочий head после изменения CircleCI — `a101f9a3c0d55d69ec59b74628293167717b23c7`.

Что уже реализовано и ранее доказано:
- два режима системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит sticky account, а независимая новая Sol-задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных легитимных слота, preferred continuation, ожидание busy-владельца, пропуск cooling-слота и fail-closed поведение;
- при реальном failover старый Notion thread не переносится между аккаунтами: полная локальная история создаёт новый thread на новом слоте, затем affinity переносится на фактически использованный account/thread;
- предыдущий отдельный CircleCI workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6` был полностью зелёным для семи основных Agent-контрактов.

Что было подготовлено перед этим запуском:
- `tools/live_two_slot_codex_probe.py`: ограниченный настоящий provider-probe для уже авторизованной среды;
- две независимые Responses/Sol-задачи должны занять разные аккаунты, вызвать `probe_marker`, а continuation после `function_call_output` должна сохранить свой sticky account;
- `tests/test_live_two_slot_probe_contract.py` проверяет форму запроса и fail-closed разбор function call;
- live-probe не печатает токены, account/thread id, пути, prompt или provider payload.

Что сделал в этом запуске:
1. Перечитал OWNER_INTENT, CURRENT и этот handoff, затем заново проверил PR #7/#8.
2. Core ушёл вперёд до `85940ba8...`; Agent-ветка всё ещё расходится с Core от merge-base `a62833f6...`. Это значит: продуктовую синхронизацию пока не делать вслепую, пока Core активно меняет Windows/NCM28.
3. Новый live-probe ранее вообще не имел удалённого доказательства. Чтобы не ждать и не трогать provider, добавил в `.circleci/config.yml` отдельный Linux job `agent-contracts`, который работает только на ветке `autonomy/notion-prompt-modes-20260819`.
4. Этот job запускает все восемь Agent-контрактов одним набором: prompt modes, prompt-policy identity, реальный server wiring, ранний HTTP 400, account-pool parallelism, foreground slot routing, cooldown failover и новый `test_live_two_slot_probe_contract`.
5. NCM28 Windows jobs и их branch-filter оставлены без изменения по смыслу: они по-прежнему запускаются только на `candidate/ncm28-windows-fixed-v1`. Agent job не запускает Notion provider traffic и не восстанавливает секретное runtime-state.
6. Commit с этим удалённым gate: `a101f9a3c0d55d69ec59b74628293167717b23c7`.

Что ещё не завершено:
1. Нужно снять результат нового CircleCI `agent-contracts` на exact head `a101f9a3...`. До результата новый `test_live_two_slot_probe_contract` нельзя называть удалённо доказанным.
2. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде. Перед запуском проверить, что нет другого активного provider-run; не дублировать.
3. После двухслотового live PASS нужен один ограниченный реальный cooldown/failover сценарий: полная локальная история должна перейти на новый легитимный слот и новый Notion thread, без reuse чужого `thread_id`.
4. Затем аккуратно синхронизировать Agent-ветку со свежим Core, не перетирая его Windows/NCM28 и CircleCI.
5. Только после живого многошагового Codex PASS переходить к субагентам, затем к делегированию задач в Qwen.

Следующий запуск: сначала проверить PR #7/#8 и результат CircleCI на `a101f9a3...`. Если Agent-контракты зелёные и live-окружение свободно, выполнить ровно один bounded `tools/live_two_slot_codex_probe.py` с восстановлением уже существующего авторизованного runtime-state и обязательной очисткой. Если live запуск недоступен — не ждать: взять независимый кусок по субагентному протоколу/делегированию, но довести его до кода и тестов, не до эссе.
