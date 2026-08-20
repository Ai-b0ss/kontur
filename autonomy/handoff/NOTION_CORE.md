# Notion — Windows + Codex ядро

Рабочая Core-ветка: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7.
Текущий Core head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Агентная ветка: `Ai-b0ss/notion-agent-bridge:autonomy/notion-prompt-modes-20260819`, draft PR #8.
Текущий Agent head: `68b0c4a15924a51abe7a7ad11a405e1316b42e17`.

## NCM28 / Windows

Последняя доказанная хорошая основа файлового слоя — v23. Её native Windows write primitive без нового точного доказательства не менять.

Уже доказано настоящим Windows:
- `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят;
- красным остаётся только аварийный `auth-rollback`;
- возврат обычных управляемых файлов и сохранность non-targets проходят;
- auth/stable rollback падают с `PermissionError`;
- `remove_plain_tree` уже исключён как источник этого `PermissionError`.

Точный текущий разрез всё ещё ждёт Windows-исполнителя:
- workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3`;
- пять задач: `auth`, `codex`, `migration`, `runtime` tree-digest и `outside-digest`;
- на последней проверке все пять всё ещё `pending`.

Дубликат не запускать. Продуктовый файловый слой пока не менять вслепую.

Если результат окажется `outside-digest`, уже подготовлен более точный call-cut на ветке `autonomy/ncm28-callcut-ready-20260820`, commit `f72c450fdb8877981c8a79c550e7bc0479c7f8f4`. Использовать его только после доказанного `outside-digest`.

После нахождения одного точного вызова: минимальный фикс → `build + happy-running + happy-stopped + rerun-noop + auth-rollback` → Windows `tests.test_crash_recovery` → полный `RUN_NCM28_LOCAL_VERIFY.py`. После этого NCM28 закрываем.

## Codex / Agent

PR #8 перед этой сменой уже ушёл до `d546c2b4bc575e8d3aa18ee1d0d8be3ab8382246`. В ветке уже есть:
- режимы `engineer/owner`;
- распределение foreground-слотов и sticky continuation;
- безопасный failover на новый account/thread с переносом локальной истории;
- provider-neutral delegation;
- Notion child-agent runtime/lifecycle поверх того же account pool;
- точные схемы локальных инструментов и fail-closed обработка MCP tool-result;
- настоящий проектный `codex exec` гейт и двухслотовые/failover варианты;
- server-wiring materializer, который пока ещё не внесён напрямую в `payload/server.py`.

### Что сделано в этой смене

Нашёл слабое место именно в доказательстве реальной многошаговой работы Codex. Старый `tools/run_real_codex_cli_project_probe.py` считал достаточной любую неудачную команду перед более поздним `VERIFY_OK`. Из-за этого живой прогон теоретически мог стать зелёным после посторонней ошибки, даже если Codex не обработал именно отказ `verify.py` и не продолжил после его tool result.

Исправлено:
- живой гейт теперь принимает как обязательное неудачное действие только команду, в выводе которой есть точный маркер нашего verifier: `CHALLENGE_CREATED_READ_challenge.txt_AND_RETRY` или `RESULT_MISMATCH_READ_challenge.txt_AND_RETRY`;
- `VERIFY_OK` должен появиться в более поздней успешной команде;
- посторонняя неудачная команда больше не засчитывается как доказательство continuation;
- добавлены контрактные тесты на точный verifier failure, постороннюю ошибку и неправильный порядок success→failure.

Коммиты Agent:
- `174a32105207be1f793c439ca885c3851fa1a7cb` — строгая проверка события verifier;
- `68b0c4a15924a51abe7a7ad11a405e1316b42e17` — регрессии на ложноположительный Codex PASS.

На exact head `68b0c4a1…` автоматически создан CircleCI workflow `b3620621-098a-4d2d-af13-7a1f68c558f4`.
Пять задач `agent`, `prompt`, `routing`, `delegation`, `server-wiring-rehearsal` на последней проверке `pending`; дубликат не запускать.

## Следующий порядок

1. Снять результат Windows workflow `1cd6d894-...`. Если всё ещё `pending`, не плодить дубликаты.
2. Снять Agent workflow `b3620621-...`. Если конкретная задача красная — чинить её точную причину.
3. Если `server-wiring-rehearsal` зелёный — применить `tools/apply_server_subagent_lifecycle_wiring.py` к настоящему `payload/server.py` и повторить контракты уже на сохранённом сервере.
4. Затем выполнить один настоящий `tools/run_real_codex_cli_project_probe.py`. Теперь PASS означает именно: реальный файл → локальное действие → конкретный провал verifier → новый tool result → исправление → повтор verifier → `VERIFY_OK`.
5. Затем один настоящий two-slot run и failover run: новый легитимный слот получает новый Notion thread и полную локальную историю без повторения уже выполненного локального side effect.
6. После этого проверить restart/recovery незавершённой цепочки. Только затем углублять субагентов и Qwen adapter.

Production и живой Notion в этой смене не трогались. Нового provider traffic не запускалось. Секреты не печатались.
