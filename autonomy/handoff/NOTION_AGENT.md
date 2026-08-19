# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. Свежий head Core на момент этого запуска: `ca39048ad67cf8f1594a1194dbc9ae8ba90c09cd`. Core всё ещё работает по Windows/NCM28; в агентной линии не трогать его filesystem/recovery-файлы.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этого запуска: `55f5bbb0c14cdee4d7aada3611f4b20ae9ac9e9e`, GitHub показывает `mergeable=true`.

Что уже доказано раньше по prompt-mode:
- `payload/prompt_modes.py` с режимами `engineer` и `owner`;
- `owner` требует `client_metadata.owner_system_prompt`, не переписывает его и не смешивает с большой персоной Codex;
- owner runtime-контекст приходит отдельно через `client_metadata.runtime_context`;
- `compose_responses_planner_prompt(...)` отдельно собирает нейтральный контракт tools/structured output;
- fail-closed wiring реального `responses_planner_prompt()` + compile прошёл CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907`;
- server-path prompt проверки прошли CircleCI `ca3e641a-63d0-4770-96c3-d241ad82a38b`;
- ранняя HTTP-400 проверка неправильного owner metadata/runtime_context до stream/non-stream развилки прошла CircleCI `e1fffd96-d4c6-4669-aa43-202e13129aa3` / `9a4658ac-0a15-4732-b089-6fbbc9947a57`.

Новый результат этого запуска по приватному prompt владельца:
- раньше `compose_planner_prompt()` сохранял owner prompt как строку, но всё равно ставил перед ним собственную подпись `Application prompt supplied by the owner...`;
- это лишний bridge-owned текст перед приватным prompt и он ухудшает строгий контракт «промпт владельца — первый прикладной управляющий текст»;
- теперь в owner-mode итоговая строка начинается ровно с `owner_system_prompt`, без ярлыка, пересказа или нашей персоны перед ним;
- только после точных байтов owner prompt идёт явная граница `--- neutral runtime interface ---` и отдельно технический контекст/инструменты;
- тесты усилены: проверяется `rendered.startswith(private)`, точное совпадение первых байтов, отсутствие старой подписи и отсутствие `ENGINEER_SYSTEM_PROMPT`/Codex-персоны;
- commits этого изменения: `5b0fb384f843a630a3122538873f920315407e50` и `55f5bbb0c14cdee4d7aada3611f4b20ae9ac9e9e`.

Что уже сделано по идентичности приватного prompt:
- owner prompt и `runtime_context` участвуют в cache/thread identity только через SHA-256, открытый текст для этой цели не сохраняется;
- `response_input_fingerprint(...)` и persistent conversation fingerprints учитывают смену prompt-policy;
- смена owner prompt/runtime_context вызывает безопасный rollover, engineer-mode не дробится из-за неиспользуемых owner-полей;
- `tests/test_prompt_policy_identity.py` покрывает эти случаи.

Что уже сделано по ротации/failover:
- если sticky account просто занят, continuation ждёт его;
- если sticky account реально недоступен/на cooldown и pool выбирает другой легитимный слот, старый Notion `thread_id` через соседний аккаунт не переносится;
- новый слот получает полный локальный Responses history, создаёт новый Notion thread, затем affinity/segment перепривязываются к фактически использованному аккаунту;
- `tests/test_responses_cooldown_failover.py` проверяет этот серверный контракт;
- `ForegroundAccountReservations` не даёт независимой новой Sol-задаче забрать слот незавершённой tool-цепочки;
- `tests/test_account_pool_parallelism.py` проверяет разные свободные слоты для независимых задач, sticky continuation, ожидание busy preferred, cooldown и fail-closed reserved+cooling capacity;
- prompt + reservation + account-pool набор ранее прошёл CircleCI `defd387f-31fc-48db-be66-a0be870bd9c2` / `17f4db31-4f8f-498b-b081-706c92363733`.

Что ещё не завершено:
- доказанный prompt wiring и ранняя HTTP-валидация всё ещё не записаны непосредственно в `payload/server.py`; сейчас они доказаны через `tools/apply_prompt_mode_wiring.py` на временном checkout. Не переписывать большой `server.py` вслепую: материализовать ровно уже доказанный fail-closed diff;
- после сегодняшнего усиления owner-mode новый удалённый PASS ещё не получен; текущий head `55f5bbb0...` пока считать новым кандидатом, а не зелёным доказательством;
- `test_prompt_policy_identity.py` и `test_responses_cooldown_failover.py` тоже требуют общего удалённого прогона на материализованном server wiring;
- PR #8 отстаёт от свежего Core по NCM28-only commit-ам, но GitHub сейчас показывает `mergeable=true`;
- затем нужен один реальный двухслотовый Codex Responses tool-loop: две независимые foreground-задачи на разных свободных аккаунтах; tool-result continuation остаётся на своём sticky account/thread; при реальном временном отказе владельца — полный rebase на новый легитимный слот/новый Notion thread без cross-account thread reuse;
- субагенты и делегирование в Qwen — только после устойчивого этого ядра.

Следующий шаг:
1. материализовать ровно доказанный `tools/apply_prompt_mode_wiring.py` diff в настоящий `payload/server.py`, без побочных изменений Windows/NCM28;
2. прогнать на доступном CircleCI: `test_prompt_modes.py`, `test_responses_prompt_wiring_contract.py`, `test_responses_prompt_mode_http_contract.py`, `test_prompt_policy_identity.py`, `test_foreground_slot_routing.py`, `test_account_pool_parallelism.py`, `test_responses_cooldown_failover.py`;
3. если green — аккуратно синхронизировать PR #8 со свежим Core, не меняя NCM28 продукт;
4. затем провести один bounded реальный двухслотовый Codex tool-loop и только после него переходить к субагентам/делегированию.
