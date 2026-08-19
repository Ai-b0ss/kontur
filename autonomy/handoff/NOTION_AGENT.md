# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 01:45–02:00 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `21b46be4a649d2459883611e90cc996c6f8a32a8`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`; приватный prompt владельца не переписывается и не смешивается с большой инженерной персоной;
- приватная prompt/runtime policy входит в cache/thread identity только через SHA-256, сам текст там не хранится;
- `payload/server.py` использует общую prompt-policy;
- незавершённая tool-цепочка держит свой легитимный аккаунт, а независимая новая работа обходит зарезервированный слот;
- допустимый failover A→B не переносит старый Notion `thread_id`: B получает полную локальную историю и создаёт новый remote thread;
- delegated child-session хранит локальную историю, tool-result, использованные call id и бюджет ходов через смену слота, поэтому уже выполненный локальный side effect повторно не запускается;
- `DelegationRequest` / `DelegationDispatcher` / `SubagentLifecycle` / `SubagentEntryPoint` / `NotionDelegationAdapter` / `NotionDelegatedModelStep` уже собираются в provider-ready Notion child runtime;
- `ServerSubagentLifecycle` умеет безопасно менять поколение pool: новые child-задачи переключаются атомарно, старые успевают закончить до закрытия старых provider clients;
- на ветке уже есть fail-closed materializer `tools/apply_server_subagent_lifecycle_wiring.py` и отдельный CircleCI `server-wiring-rehearsal`, который материализует wiring на временной копии `server.py`, компилирует её и гоняет интеграционные контракты без provider traffic.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, предыдущий handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Проверил свежий PR #8: до начала моей работы head уже был `b1d546f...`; другой рабочий успел добавить `server-wiring-rehearsal` в CircleCI. Этот прогон и остальные Agent jobs на момент завершения ещё выполняются.
3. Усилил старый `tools/live_two_slot_codex_probe.py`: теперь он проверяет не только сохранение аккаунта, но и сохранение точного Notion `thread_id` после tool-result; pool всегда закрывается в `finally`, глобальный `server.account_pool` очищается. Коммит `ac6e1b672f6c553810fa059025b6334469940398`.
4. Усилил реальный проектный probe `tools/live_codex_project_probe.py`. Теперь один реальный многошаговый проект обязан использовать все три действия `read_file`, `write_file`, `bash`, пройти `verify.py`, а внутри нормального здорового хода сохранить один и тот же `(account_id, notion_thread_id)` через tool-цепочку. Pool также гарантированно закрывается. Коммит `6ea1f254bf90f1cb8a84adf77ab7ef739af649de`.
5. Добавил новый `tools/live_two_slot_codex_project_probe.py`. Это уже не искусственный `probe_marker`: создаются два независимых временных проекта с двумя неизвестными заранее токенами; обе задачи параллельно проходят настоящий `read_file → write_file → bash/verify` через общий Notion pool; после завершения требуется два разных легитимных аккаунта, два разных Notion thread и правильный результат в каждом проекте. Никакие account id/thread id/token/path не печатаются. Коммиты `a862532eb7f83917388a2a569fa617d26a845839` и `4940d1ead217aea652d2165c7ab6976aa1660f77`.
6. Расширил `tests/test_live_two_slot_probe_contract.py`: новый двухпроектный probe теперь импортируется обычным Agent-набором, а отдельный контракт запрещает ложный PASS при общем аккаунте или общем thread. Текущий head после теста: `21b46be4a649d2459883611e90cc996c6f8a32a8`.
7. На exact head `21b46be4...` CircleCI workflow `2a91d1c8-6acf-4899-9899-ec7bf3bb9ff5` уже стартовал автоматически. Jobs `agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal` на момент handoff ещё `pending`; не объявлять новый код зелёным до их результата.
8. Provider/live traffic и реальные Notion-аккаунты в этом запуске не использовались.

Главное новое понимание:
- прежний two-slot `probe_marker` был полезен как узкая проверка распределения, но недостаточен как пользовательский Codex-гейт: он не доказывал два независимых локальных проекта и настоящую работу с файлами/терминалом;
- ближайший живой гейт теперь можно сделать существенно сильнее без увеличения риска: два параллельных проекта, каждый обязан сам прочитать неизвестный токен, записать результат, запустить verifier и сохранить собственный account/thread;
- для нормального продолжения без failover нужно проверять пару `(account_id, notion_thread_id)`, а не только account id. Иначе можно пропустить тихую потерю удалённого контекста при формально правильной ротации слота.

Что ещё не завершено:
1. Снять итог CircleCI для exact head `21b46be4...`. Если `agent-contracts` красный — сначала исправить только конкретный новый контракт/импорт; если `server-wiring-rehearsal` красный — разобрать wiring до любых изменений реального `payload/server.py`.
2. После зелёного rehearsal материализовать ровно проверенный lifecycle wiring в настоящий `payload/server.py`, не меняя Windows/NCM28 файлы Core. Entry point оставить выключенным по умолчанию; создание/bind не должно запускать provider traffic или локальные инструменты.
3. Первый живой provider-run делать уже новым `live_two_slot_codex_project_probe.py`, а не старым `probe_marker`: две независимые реальные project-задачи, два свободных легитимных слота, sticky account+thread, два успешных verifier. Перед запуском убедиться, что нет другого живого provider-run.
4. Отдельно после этого выполнить один bounded failover-гейт: A после уже выполненного локального side effect становится временно недоступен; B получает полную локальную историю, создаёт новый Notion thread и продолжает без повторения уже выполненного инструмента.
5. Реальный Codex CLI по-прежнему отдельно проверяется `tools/run_real_codex_cli_project_probe.py`; после зелёного bridge-level two-slot желательно довести именно две реальные Codex CLI задачи до того же двухслотового доказательства, если это можно сделать без добавления второго диагностического реестра account/thread.
6. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала прочитать свежие PR #7/#8 и CircleCI exact head `21b46be4...`. Если Agent contracts зелёные — не добавлять ещё один синтетический probe. Переходить либо к материализации уже проверенного server lifecycle, либо к одному настоящему двухпроектному two-slot live run в авторизованной среде. Если live среда занята — взять независимый кусок: подготовить bounded failover project probe без повторения локального side effect.
