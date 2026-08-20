# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — lifecycle status исправлен, v4 memory обновлена, exact server blob получен

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `60c53b3dd95c16e8d18266211aab4b859a0578f7`.

Фактическое состояние:
- настоящий `payload/server.py` по-прежнему имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; lifecycle/single-slot wiring уже материализован, но самый ранний `status = await new_pool.status()` всё ещё содержит `except Exception`;
- exact полный blob `f02cef...` теперь успешно прочитан через GitHub blob API целиком. Старый внешний блокер «нет полных bytes server.py» снят; неизвестные bytes не реконструировались из памяти/чата;
- `tools/apply_startup_status_cleanup.py` fail-closed не только по текстовому anchor, но и по exact Git blob SHA `f02cef...`: вычисляется настоящий Git blob SHA (`sha1("blob <len>\0" + bytes)`), поэтому helper откажется патчить любой другой `server.py`, даже если старый anchor в нём случайно сохранился;
- startup cleanup сохраняет исходный `CancelledError`/startup exception как основной, закрывает новый pool и при двойном отказе цепляет cleanup exception как cause;
- `payload/server_subagent_lifecycle.py` исправлен: `status()` учитывает child-задачи, которые ещё дренируются на предыдущем поколении после rebind/unbind. Раньше во время `rebind_pool_and_drain()` или `unbind_and_drain()` статус мог ложно показывать `active=0`, хотя старая child ещё работала;
- новый `status()` также повторяет чтение, если generation/entrypoint сменились во время `await entrypoint.status()`, чтобы не возвращать смешанный снимок двух поколений;
- `tests/test_server_subagent_lifecycle_drain.py` требует `active=1` во время дренирования старого поколения как при rebind, так и после unbind; после окончания child — `active=0`;
- локально проверена семантика lifecycle status: `old active + new bound -> active=1`; `unbound + old active -> active=1`; после drain -> `active=0`;
- `DelegationDispatcher` теперь fail-closed отклоняет пустой/whitespace-only результат child-адаптера вместо ложного «готово». Успешный непустой текст возвращается без strip/переписывания. Добавлена регрессия на `""` и whitespace-only output; локальная семантика проверена;
- формула Git blob SHA локально сверена с `git hash-object` на контрольных bytes — совпадает;
- CircleCI/GitHub Actions/Cloudflare/provider traffic/production не использовались.

Постоянная память v4:
- на старте прочитан старый `LATEST.json`, его родительский Git blob SHA был `5cccbcc0548a85a099bb40c7b8c4b08ff590afb9`; он указывал на несовместимую v3 capsule `20260820T1506Z-67ebdc9fc0`, PREVIOUS отсутствовал;
- по failure policy протокола v2 продолжили от exact GitHub source и затем создали первую нормативную v4 capsule `20260820T170428Z-3d21b8ccf9`;
- после дальнейшей существенной работы создана новая нормативная v4 capsule `20260820T171209Z-703d81d6fa`; `capsule_runtime_v4.py verify` и `restore` дали PASS, восстановленные `CHECKPOINT.json`/`README.md` побайтово совпали с исходным workspace;
- archive SHA-256 новой capsule: `3a6d37743613ed24eb31a92917ad6589e8bb26022fce0d5b29055c7c431ff752`;
- immutable part и manifest загружены и повторно прочитаны; Git blob SHA readback совпал с локально рассчитанным: part `30f103caffe311b4b5afa549b364b82a0b6527a6`, manifest `2bea3d856413b29fe79354967a8f277e6056a028`;
- перед второй публикацией LATEST был перечитан и имел exact parent blob `749c3ce5e0e2680512046b4876b944dabfcdce47`; этот указатель сохранён как новый `PREVIOUS.json`;
- новый LATEST опубликован CAS-обновлением без force-write; текущий `LATEST.json` указывает на capsule `20260820T171209Z-703d81d6fa`, Git blob SHA указателя `0fa9434ed01d4feae240272871e95ef972064dff`.

Следующий шаг:
1. Материализовать exact bytes blob `f02cef...` локально без преобразования escape/newline; пересчитать Git blob SHA и потребовать точное `f02cef...`.
2. Применить текущий `apply_startup_status_cleanup.py`; helper обязан подтвердить exact source blob до замены.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, затем prompt/routing/delegation/tool-loop/lifecycle набор.
4. Только после lossless PASS заменить `payload/server.py` целиком exact-байтами и сразу сравнить предыдущий и новый commit: допустима только узкая startup-правка, никаких несвязанных удалений/переписываний.
5. Отдельно закрыть обнаруженную семантическую тонкость owner-mode: сейчас `responses_planner_prompt()` заранее вычисляет engineer-context из Codex `instructions`, хотя owner-mode потом его отбрасывает. По контракту owner-mode вообще не должен извлекать persona/context из `instructions`; исправлять вместе с безопасной прямой правкой server.py, с тестом, что extractor не вызывается в owner-mode.
6. После крепкого локального PASS — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
7. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания account/thread state.
