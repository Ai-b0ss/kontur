# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head in this run `a016664796720c085fd5356af30f6f959e4971bc`. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity из PR #8; Core трогает только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: не запускать CircleCI/GitHub Actions/Cloudflare/другой hosted CI и не делать trigger-push. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST` на момент промежуточной публикации:
- capsule `20260821T014821Z-b313e12017`;
- archive SHA-256 `2e5b849d94af4a7ddb5615ec61e78268cd92a77b213da71e943365392787fdc0`;
- 2 parts;
- part-0000: 4096 chars, Git blob `a5dce74d7b5ba276c05db40a03a37b5458ef727c`;
- part-0001: 1552 chars, Git blob `bb03ec383de4231a7b566a3d446867928b828656`;
- manifest Git blob `2668f3e4cf8d7783594251061086179e651d8ba1`;
- `LATEST.json` Git blob после CAS `aba08e08d43a9a1b8d7ee57e1db835577b1bb5d4`;
- предыдущая capsule `20260821T004058Z-6a23a2dff8` сохранена как `PREVIOUS`.

В начале запуска capsule `20260821T004058Z-6a23a2dff8` восстановлена строго через `capsule_runtime_v4.py`; part/archive/workspace verification прошёл. В конце запуска после нового idempotency finding должна быть опубликована ещё одна v4 capsule и этот раздел обновлён её точными SHA.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа — v23. Native Windows write primitive без нового точного Windows evidence не менять.

Уже доказано настоящим Windows: `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят; аварийный `auth-rollback` остаётся красным; managed-file rollback и non-target preservation проходят; auth/stable rollback падают с `PermissionError`; `remove_plain_tree` исключён как источник.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В этом запуске read-only status снова показал все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) как `pending`. Нового Windows/hosted запуска не было.

Когда появится новый точный callsite/outside-digest: использовать готовый call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4` → минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore v4

Кандидат v4 на Linux закрывает partial final, temp cleanup, directory/symlink destination, unsafe restore root, создание root mode 700, сохранение exit codes и утечку `RUNTIME_STATE_KEY` в argv/child env. Вердикт: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point + overwrite/atomic replace semantics НЕ доказаны; объединить с будущим единственным разрешённым Windows Core gate и auth-rollback callsite.

## Codex shell-env safety

`tools/run_real_codex_cli_project_probe.py` всё ещё нуждается в подготовленном integration-only hardening:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Локально доказано, что эта политика не пропускает `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый AWS secret в model-reachable shell. Материалы:
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy.json`;
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy_candidate.patch`.

Из-за ZERO-MINUTE product PR #8 не мутировался. До применения этой защиты настоящий Codex/Notion probe не запускать.

## Core lifecycle blocker: exact replay после restart

Fresh PR #8 правильно расширил persistent segment identity: prompt policy, engineer instructions, tools/tool_choice и structured output входят в fingerprint. Но отдельная restart-проблема остаётся.

Детерминированно воспроизведено на exact текущей логике:
1. `ConversationSegmentStore` переживает restart и хранит fingerprints + account/thread, но не replayable Responses result.
2. После уже обработанного запроса с tool result процесс перезапускается.
3. Клиент повторяет точно тот же Responses input.
4. `input_prefix_length(...) == len(current_fingerprints)`; `responses_incremental_body(...)` получает пустой delta и возвращает `None`.
5. In-memory `TurnAffinityStore` после restart пуст, значит response-cache отсутствует.
6. `handle_openai_responses()` требует `anchor` + non-None `incremental_prompt` для продолжения сохранённой Notion-ветки. При empty delta это условие ложно, и код идёт в `initial_completion()` — новый полный provider plan без `thread_id`.

Вердикт: `CODEX_RESTART_EXACT_REPLAY_NEW_THREAD_FALLBACK_REPRODUCED`.

Это не доказывает обязательное повторение локального side effect на каждом прогоне: полный transcript содержит уже полученный tool result и текстовую инструкцию не повторять выполненное. Но это только prompt-level защита, а не idempotency guarantee. Поэтому acceptance `restart/recovery без повторения уже выполненного локального действия` пока не закрыт.

Материал: `autonomy/evidence/notion/20260821T0150Z_codex_restart_exact_replay_gap.json`.

### Safety-кандидат

Подготовлен bounded fail-closed patch, который до появления durable replay journal запрещает exact persisted replay без живого in-memory response cache и возвращает 409 `restart_replay_unavailable` вместо нового provider plan.

Offline predicate проверен на пяти границах:
- restart exact replay без affinity → fail closed;
- same-process replay с cache → старый cache path;
- новый appended tool result → continuation path;
- rewritten history → rollover path;
- compaction → без изменения.

Вердикт: `CODEX_RESTART_EXACT_REPLAY_FAIL_CLOSED_PREDICATE_PASS`.

Материалы:
- `autonomy/evidence/notion/20260821T0155Z_codex_restart_exact_replay_failclosed_candidate.patch`;
- `autonomy/evidence/notion/20260821T0155Z_codex_restart_exact_replay_failclosed_candidate.json`.

Это safety-only candidate, не финальное recovery.

## Более сильный Core blocker: текущий response cache не является идемпотентным replay

После restart finding отдельно проверен даже обычный same-process cache path. `TurnAffinityStore` хранит `completion_text`, usage и provider affinity, но не готовый OpenAI Responses payload. При cache hit сервер снова вызывает `responses_payload(completion_text, ...)`.

`responses_payload()` при каждом вызове создаёт новые UUID для:
- `response_id`;
- tool `call_id`;
- output item id (`fc_...`/`ctc_...`/`msg_...`).

Локальный deterministic harness дважды отрендерил одну и ту же tool-рекомендацию. Семантический текст совпал, но все три протокольных идентификатора различались.

Вердикт: `RESPONSES_SEMANTIC_CACHE_NOT_IDEMPOTENT_REPRODUCED`.

Это означает, что даже same-process retry сейчас получает не точный replay, а новый протокольный ответ с новым `call_id`. Для Codex tool loop этого недостаточно: истинная restart/retry идемпотентность требует сохранять либо точно готовый Responses result, либо детерминированно сохраняемые response/item/call IDs вместе с содержимым.

Материал: `autonomy/evidence/notion/20260821T0200Z_responses_cache_idempotency_gap.json`.

### Минимальные invariants для настоящего durable replay

1. Replay key: content-free exact request fingerprint + conversation/turn identity + model/lifecycle version boundary.
2. Replay value: достаточно данных, чтобы без provider inference воспроизвести тот же completed Responses result для non-streaming и эквивалентный SSE stream, включая стабильные `response_id`, item id и tool `call_id`.
3. Durable publication должна быть согласована с persistent conversation progress: нельзя считать request обработанным и сохранить segment progress, если matching replay record ещё не опубликован.
4. Crash между provider completion и durable replay publication должен fail closed или восстанавливаться без повторного provider planning/tool side effect.
5. Не хранить приватный owner prompt/секреты ради replay identity; использовать уже существующие content-free fingerprints.
6. Fail-closed 409 candidate остаётся safety floor до появления этого механизма.

## Следующий порядок

1. Восстановить свежий v4 `LATEST`, затем read-only проверить существующий Windows digest; не перезапускать.
2. Если всё ещё pending: спроектировать и локально доказать durable **rendered Responses replay** с устойчивыми response/item/call IDs и атомарной связью с persistent segment progress. Не ограничиваться сохранением `completion_text`.
3. Сначала сделать offline crash-state matrix: provider completion до replay save, replay save до segment save, segment save до response return, exact retry после каждого crash point. Для каждой точки требование — либо тот же replay без provider inference, либо fail closed; никогда тихий новый plan уже обработанного tool result.
4. Параллельно держать готовым shell-env hardening для real Codex probe; product push не делать до снятия ZERO-MINUTE.
5. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore reparse/overwrite proof; без нового fanout.
6. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery с доказанным отсутствием повторного локального side effect.

Product PR #7/PR #8 не менялись; hosted CI, provider traffic и реальные пользовательские данные не трогались.
