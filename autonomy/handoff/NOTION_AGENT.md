# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 11:50 МСК

Notion Core продолжает отдельную Windows/NCM28 линию: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `53e3ae4548982cd20d965caec8bf0dd09047f318`. После общей базы Agent-ветки Core добавил 46 коммитов, но сравнение показывает только `.circleci/config.yml` и Windows/NCM28 tools; `payload/server.py`, prompt-mode и account-pool он не менял.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. В начале запуска GitHub показывал head `1370ed2afe40258e23f59180c228abf9fa5534c0`; после моего изменения head `8a98fc8de4bff035c8897fde99782af34508200a`. PR сейчас `mergeable=false`, почти наверняка из-за разошедшейся `.circleci/config.yml`; продуктовые файлы Core с Agent-линией по свежему compare не пересекаются.

Что уже есть и не надо делать заново:
- `payload/prompt_modes.py`: режимы `engineer` и `owner`; приватный owner prompt идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- owner `runtime_context` отделён от prompt; prompt/runtime identity участвует в cache/thread fingerprint только через SHA-256;
- независимые foreground-задачи распределяются по свободным легитимным слотам; незавершённая tool-цепочка держит sticky account; при реальном cooldown владельца полный локальный history переносится на новый Notion thread соседнего легитимного слота без cross-account thread reuse;
- отдельные тесты покрывают prompt-mode, ранний HTTP 400, foreground reservations, lease-level parallelism, cooldown/failover и prompt-policy identity;
- ранее доказанный wiring `responses_planner_prompt()` существует как fail-closed `tools/apply_prompt_mode_wiring.py`, но сам `payload/server.py` на Agent-ветке всё ещё старый.

Что сделал в этом запуске:
- заново сверил Core и Agent. Важно: Core за 46 новых коммитов не менял `payload/server.py`; его Git blob на Agent-ветке остаётся `2376ae8bda35ac00d1fe32949b06e37419afa845`, то есть ровно та база, на которой ранее проходил prompt wiring;
- усилил `tools/apply_prompt_mode_wiring.py`: теперь перед материализацией он проверяет точный Git blob `payload/server.py` и отказывается менять неизвестную ревизию. Если wiring уже полностью присутствует, повторный запуск остаётся идемпотентным. Commit: `8a98fc8de4bff035c8897fde99782af34508200a`;
- это убирает риск случайно применить строковый патч к будущему изменённому `server.py` и позволяет безопасно материализовать только ранее проверенный diff.

Что ещё не завершено:
1. Сам доказанный wiring всё ещё надо записать непосредственно в `payload/server.py`. Через доступный GitHub Contents API нельзя сделать частичный patch большого файла без полной перезаписи, поэтому в этом запуске я не стал реконструировать большой `server.py` кусками и рисковать потерей кода.
2. После материализации прогнать одним CircleCI-набором: `test_prompt_modes.py`, `test_responses_prompt_wiring_contract.py`, `test_responses_prompt_mode_http_contract.py`, `test_prompt_policy_identity.py`, `test_foreground_slot_routing.py`, `test_account_pool_parallelism.py`, `test_responses_cooldown_failover.py`.
3. Синхронизировать Agent с свежим Core, сохранив Core `.circleci/config.yml`; не тащить старую Agent-версию CircleCI поверх NCM28.
4. Затем один bounded реальный двухслотовый Codex Responses tool-loop: две независимые foreground-задачи на разных свободных аккаунтах; tool-result continuation остаётся на своём sticky account/thread; при реальном временном отказе владельца — полный rebase на новый легитимный слот/новый Notion thread.
5. Только после этого переходить к субагентам и делегированию в Qwen.

Следующий запуск: сначала проверить свежие PR #7/#8. Если `payload/server.py` всё ещё имеет blob `2376ae8...`, материализовать ровно результат `tools/apply_prompt_mode_wiring.py` в настоящий файл любым доступным безопасным способом и сразу прогнать указанный набор CircleCI. Если blob изменился — не применять старый патч; сначала пересмотреть новый `server.py`.
