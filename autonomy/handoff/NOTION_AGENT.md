# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 15:46 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `85940ba8499b42f6ab0deb248ff6c5490d9f65ee`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этого запуска: `c01e6ded0c2ec72a5d1db84c54878e4ed8fc5340`.

Что уже реализовано и ранее доказано:
- два режима системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит sticky account, независимая новая Sol-задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных слота, preferred continuation, ожидание busy-владельца, cooldown и fail-closed поведение;
- при failover старый Notion thread не переносится между аккаунтами: полная локальная история создаёт новый thread на новом слоте;
- предыдущий отдельный CircleCI workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6` был полностью зелёным для семи основных Agent-контрактов;
- `tools/live_two_slot_codex_probe.py` готовит ограниченную настоящую проверку двух независимых Responses-задач и sticky continuation;
- `.circleci/config.yml` на Agent-ветке имеет отдельный `agent-contracts`, который не запускает provider traffic и не вмешивается в Windows/NCM28 jobs Core.

Что сделал в этом запуске:
1. Заново прочитал OWNER_INTENT/CURRENT/handoff и проверил PR #7/#8. Core остаётся в Windows/NCM28, Agent PR #8 открыт отдельно; синхронизацию с Core сейчас не делал.
2. Удалённый результат нового `agent-contracts` через доступный GitHub-интерфейс получить нельзя, а отдельного CircleCI-коннектора в этой сессии нет. Поэтому не стал объявлять его PASS и не стал запускать provider вслепую.
3. Вместо ожидания начал следующий независимый кусок — основу субагентов/будущего делегирования в Qwen.
4. Добавлен `payload/delegation_policy.py`: единый provider-neutral envelope `DelegationRequest` для дочерней задачи. Дочерняя задача обязана иметь собственный `task_id`, отдельный от parent turn; parent id используется только для связи результатов, но не наследует account/thread affinity.
5. Для Notion дочерняя задача должна входить в обычный account-pool как новая независимая foreground-работа и занимать свободный легитимный слот. Для будущего Qwen используется тот же envelope, но отдельный conversation key `delegate:qwen:*`; Notion account/thread id в него не попадают.
6. Бюджет дочерней задачи ограничен 1..24 модельными ходами, пустая цель/идентичность и неизвестный target закрываются ошибкой.
7. Добавлены 5 регрессий `tests/test_delegation_policy.py`: изоляция от parent affinity, общий envelope для Qwen, запрет reuse parent turn id, запрет пустой цели, bounded budget.
8. Коммиты: `601d2c0caf0dcb494d1f5d3bb6a7301f7d56d7db` (policy) и `c01e6ded0c2ec72a5d1db84c54878e4ed8fc5340` (tests). Эти новые тесты ещё не называю удалённо зелёными.

Что ещё не завершено:
1. Снять реальный результат `agent-contracts` и добавить туда `tests.test_delegation_policy` перед тем, как считать новый контракт доказанным удалённо.
2. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде; не дублировать другой provider-run.
3. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
4. После живого Codex-ядра подключить `DelegationRequest` к реальному диспетчеру субагентов: parent получает только структурированный результат, а child lifecycle/affinity остаются независимыми.
5. Затем добавить Qwen-adapter под тот же envelope, не смешивая provider state.
6. Аккуратно синхронизировать Agent-ветку со свежим Core только когда это не перетрёт Windows/NCM28.

Следующий запуск: проверить свежие PR/head и внешний результат `agent-contracts`. Если provider-среда свободна и контрактный gate зелёный — выполнить один bounded live two-slot probe. Если live всё ещё недоступен, подключить новый delegation policy к тестовому subagent dispatcher и добавить его в `agent-contracts`, не трогая Core Windows-файлы.
