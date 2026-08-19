# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. Свежий head Core: `f1cdfa3dcff16a3d9f28d5c614502c385a7b7221`. Сверка с прежней точкой `a62833f68c2119c0879137fa457c47569c079c70` показывает 31 новый commit, но изменения всё ещё только в `.circleci/config.yml` и NCM28/Windows tooling. `payload/server.py`, `payload/prompt_modes.py`, `payload/turn_affinity.py`, `payload/conversation_segments.py` и account-pool Core не менял.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `4bd4d296cab0ee8653ae0139a983d66aebd1e0ee`, GitHub показывает `mergeable=true`.

Что уже доказано раньше по prompt-mode:
- `payload/prompt_modes.py` с режимами `engineer` и `owner`;
- `owner` требует `client_metadata.owner_system_prompt`, не переписывает его и не смешивает с большой персоной Codex;
- owner runtime-контекст приходит отдельно через `client_metadata.runtime_context`;
- `compose_responses_planner_prompt(...)` отдельно собирает нейтральный контракт tools/structured output;
- fail-closed wiring реального `responses_planner_prompt()` + compile прошёл CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907`;
- server-path prompt проверки прошли CircleCI `ca3e641a-63d0-4770-96c3-d241ad82a38b`;
- ранняя HTTP-400 проверка неправильного owner metadata/runtime_context до stream/non-stream развилки прошла CircleCI `e1fffd96-d4c6-4669-aa43-202e13129aa3` / `9a4658ac-0a15-4732-b089-6fbbc9947a57`.

Новый результат этого запуска — найден и закрыт отдельный дефект идентичности приватного prompt:
- раньше owner prompt и `runtime_context` жили в `client_metadata`, но `response_input_fingerprint(...)` их не учитывал. При том же `turn_id` был возможен cache hit на ответ, созданный под старым приватным prompt;
- persistent `ConversationSegment` тоже сравнивал только обычные input items. После рестарта тот же Codex conversation мог продолжить старый Notion thread, даже если owner prompt уже сменился;
- в `payload/prompt_modes.py` добавлен `prompt_policy_fingerprint(...)`: контент приватного prompt наружу не сохраняется, используется только SHA-256 идентичность; owner-mode связывает идентичность с точным `owner_system_prompt` и нейтральным `runtime_context`, engineer-mode не дробится из-за неиспользуемых owner-полей;
- `payload/turn_affinity.py` теперь включает эту идентичность в Responses cache key;
- `payload/conversation_segments.py` смешивает ту же идентичность в fingerprint каждого input item, не добавляя синтетический элемент. Поэтому длина tuple остаётся равна числу Responses input items и `input_prefix_length(...)` по-прежнему возвращает правильный индекс, а смена prompt-policy даёт безопасный rollover;
- добавлен `tests/test_prompt_policy_identity.py`: смена owner prompt и runtime_context инвалидирует cache/segment; неиспользуемые owner-поля в engineer mode не меняют ключ; приватный prompt не хранится как открытый identity text.

Новый результат по ротации/failover:
- в коде `handle_openai_responses()` подтверждена правильная семантика: если sticky account просто занят, continuation ждёт его; если этот account уже недоступен/на cooldown и pool выбирает другой легитимный слот, старый `thread_id` на другой аккаунт не переносится;
- при таком failover `can_continue=False`, поэтому соседний слот получает полный локальный Responses history через `initial_completion()` и создаёт новый Notion thread; затем affinity и persistent segment перепривязываются к фактически использованным account/thread;
- добавлен `tests/test_responses_cooldown_failover.py`, который проверяет именно этот серверный контракт: preferred=`account-a`, фактический lease=`account-b`, в provider call нет `thread_id=thread-a`, полный исходный запрос + tool result присутствуют в prompt, после ответа ownership записан на `account-b/thread-b`.

Что уже доказано раньше по распределению слотов:
- `ForegroundAccountReservations` не даёт независимой новой Sol-задаче забрать слот незавершённой tool-цепочки;
- `tests/test_account_pool_parallelism.py` доказывает два разных свободных слота для двух независимых задач, sticky continuation, ожидание busy preferred, пропуск cooldown для новой работы и fail-closed при reserved+cooling capacity;
- prompt + reservation + account-pool набор прошёл CircleCI `defd387f-31fc-48db-be66-a0be870bd9c2` / `17f4db31-4f8f-498b-b081-706c92363733`.

Что ещё не завершено:
- доказанный prompt wiring и ранняя HTTP-валидация всё ещё не записаны непосредственно в `payload/server.py`; сейчас они доказаны через `tools/apply_prompt_mode_wiring.py` на временном checkout. Не переписывать 110 KB `server.py` вслепую: материализовать ровно уже доказанный fail-closed diff;
- новые `test_prompt_policy_identity.py` и `test_responses_cooldown_failover.py` пока не получили новый удалённый PASS после сегодняшних commit; считать их добавленными проверками, а не зелёным доказательством;
- PR #8 отстаёт от Core по NCM28-only commit-ам, но прямого файлового конфликта сейчас нет;
- после materialized server wiring нужен bounded remote прогон prompt-mode + identity + slot/failover набора;
- затем один реальный двухслотовый Codex Responses tool-loop: две независимые foreground-задачи на разных свободных аккаунтах; tool-result continuation остаётся на своём sticky account/thread; при реальном временном отказе владельца — полный rebase на новый легитимный слот/новый Notion thread без cross-account thread reuse;
- субагенты и делегирование в Qwen — только после устойчивого этого ядра.

Следующий шаг:
1. материализовать ровно доказанный `tools/apply_prompt_mode_wiring.py` diff в настоящий `payload/server.py` и убрать зависимость проверки от временного patch-helper;
2. прогнать `test_prompt_modes.py`, `test_responses_prompt_wiring_contract.py`, `test_responses_prompt_mode_http_contract.py`, `test_prompt_policy_identity.py`, `test_foreground_slot_routing.py`, `test_account_pool_parallelism.py`, `test_responses_cooldown_failover.py` на доступном CircleCI;
3. если green — синхронизировать PR #8 со свежим Core `f1cdfa3d...` без изменения NCM28 продукта;
4. затем перейти к одному bounded реальному двухслотовому Codex tool-loop и только после него — к субагентам/делегированию.
