# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head в этом запуске `a016664796720c085fd5356af30f6f959e4971bc`. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T015251Z-9afa256e7a`;
- archive SHA-256 `729c166be7583481d29f7ff1cdf22f0935352bd08ced8fba28ca99d7edd8653b`, size 5877, 2 parts;
- part-0000: 4096 chars, Git blob `87969c17567e6265b8f4295a009139687a7249f9`;
- part-0001: 3740 chars, Git blob `bc7a06d2a4bc12511766dcbef553c77223f2020d`;
- manifest: 2776 bytes, Git blob `e31d10c11f74fe5ea0bcff7325681692f2af9cbc`;
- `LATEST.json` после exact CAS: Git blob `be2508d8ef972de25f3a0ace409f817b9288db8a`;
- предыдущая capsule `20260821T014821Z-b313e12017` сохранена как `PREVIOUS`.

Обе parts и manifest после публикации перечитаны из GitHub и совпали с локально рассчитанными Git blob SHA. Перед CAS `LATEST` был повторно прочитан с exact parent blob `aba08e08d43a9a1b8d7ee57e1db835577b1bb5d4`, конфликта писателей не было.

В начале запуска прежняя capsule была восстановлена строго через `capsule_runtime_v4.py`; part/archive/workspace verification прошёл.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа — v23. Native Windows write primitive без нового точного Windows evidence не менять.

Уже доказано настоящим Windows: `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят; аварийный `auth-rollback` остаётся красным; managed-file rollback и non-target preservation проходят; auth/stable rollback падают с `PermissionError`; `remove_plain_tree` исключён как источник.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. Read-only status в этом запуске снова показал все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) как `pending`. Hosted Windows/CI не запускался.

Когда появится новый точный callsite/outside-digest: использовать готовый call-cut `autonomy/ncm28-callcut-ready-20260820@f72c450fdb8877981c8a79c550e7bc0479c7f8f4` → минимальный фикс → бесплатные Linux/Python регрессии → один разрешённый native Windows gate → `tests.test_crash_recovery` + `RUN_NCM28_LOCAL_VERIFY.py`.

## Runtime restore v4

Linux-кандидат v4 закрывает partial final, temp cleanup, directory/symlink destination, unsafe restore root, создание root mode 700, сохранение exit codes и утечку `RUNTIME_STATE_KEY` в argv/child env. Вердикт: `RUNTIME_RESTORE_ATOMICITY_V4_LINUX_PASS`.

Материалы:
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_evidence.json`;
- `autonomy/evidence/notion/20260820T204351Z_runtime_restore_atomicity_v4_candidate.patch`.

Native Windows PowerShell reparse-point + overwrite/atomic replace semantics НЕ доказаны; объединить с будущим единственным разрешённым Windows Core gate и auth-rollback callsite.

## Codex shell-env safety

Real Codex project probe всё ещё нуждается в подготовленном integration-only hardening:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Локально доказано, что эта политика не пропускает `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый AWS secret в model-reachable shell.

Материалы:
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy.json`;
- `autonomy/evidence/notion/20260820T2255Z_codex_probe_shell_env_policy_candidate.patch`.

Из-за ZERO-MINUTE product PR #8 не мутировался. До применения этой защиты живой Codex/Notion probe не запускать.

## Core lifecycle blocker 1: exact replay после restart

Fresh PR #8 правильно расширил persistent segment identity: prompt policy, engineer instructions, tools/tool_choice и structured output входят в fingerprint. Но отдельная restart-проблема воспроизведена:
- `ConversationSegmentStore` переживает restart и хранит fingerprints + account/thread, но не replayable Responses result;
- exact повтор уже обработанного Responses input даёт `segment_prefix == len(current_fingerprints)`;
- `responses_incremental_body()` получает пустой delta и возвращает `None`;
- in-memory `TurnAffinityStore` после restart пуст;
- без non-empty incremental prompt сервер не продолжает сохранённый Notion thread и уходит в новый `initial_completion()`.

Вердикт: `CODEX_RESTART_EXACT_REPLAY_NEW_THREAD_FALLBACK_REPRODUCED`.

Материал: `autonomy/evidence/notion/20260821T0150Z_codex_restart_exact_replay_gap.json`.

Подготовлен safety-only fail-closed candidate: exact persisted replay без живого response cache возвращает 409 `restart_replay_unavailable` вместо нового provider plan. Offline проверены границы exact replay/cache/appended tool result/history rewrite/compaction. Вердикт: `CODEX_RESTART_EXACT_REPLAY_FAIL_CLOSED_PREDICATE_PASS`.

Материалы:
- `autonomy/evidence/notion/20260821T0155Z_codex_restart_exact_replay_failclosed_candidate.patch`;
- `autonomy/evidence/notion/20260821T0155Z_codex_restart_exact_replay_failclosed_candidate.json`.

## Core lifecycle blocker 2: текущий response cache не идемпотентен

Проверен даже обычный same-process cache path. `TurnAffinityStore` хранит `completion_text`, usage и provider affinity, но не готовый Responses payload. При cache hit сервер снова вызывает `responses_payload(completion_text, ...)`.

`responses_payload()` при каждом рендере создаёт новые UUID для `response_id`, tool `call_id` и output item id. Детерминированный harness дважды отрендерил одну и ту же tool-рекомендацию: semantic text совпал, но все три протокольных ID различались.

Вердикт: `RESPONSES_SEMANTIC_CACHE_NOT_IDEMPOTENT_REPRODUCED`.

Материал: `autonomy/evidence/notion/20260821T0200Z_responses_cache_idempotency_gap.json`.

Следствие: настоящий retry/restart recovery нельзя строить только на `completion_text`. Нужен durable rendered replay с устойчивыми response/item/call IDs либо эквивалентная детерминированная реконструкция.

Минимальные invariants:
1. content-free exact request fingerprint + conversation/turn identity + model/lifecycle boundary как replay key;
2. replay value должен позволять без provider inference вернуть тот же completed Responses result и эквивалентный SSE stream, включая стабильные IDs;
3. durable replay publication должна быть согласована с persistent segment progress — нельзя сохранить «request уже обработан», не имея matching replay;
4. crash между provider completion, replay save, segment save и HTTP/SSE return должен давать либо тот же replay, либо fail closed, но не новый plan уже обработанного tool result;
5. приватный owner prompt/секреты не хранить ради identity — использовать content-free fingerprints;
6. 409 fail-closed candidate остаётся safety floor до готовности durable replay.

## Следующий порядок

1. Восстановить текущий v4 `LATEST`, затем read-only проверить Windows digest; не перезапускать.
2. Если всё ещё pending: спроектировать и локально доказать durable rendered Responses replay с устойчивыми IDs и атомарной связью с segment progress.
3. Сделать offline crash-state matrix: provider completion до replay save; replay save до segment save; segment save до response return; exact retry после каждой точки. Требование — тот же replay без provider inference либо fail closed.
4. Держать готовым shell-env hardening для real Codex probe; product push не делать до снятия ZERO-MINUTE.
5. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore reparse/overwrite proof; без нового fanout.
6. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery с доказанным отсутствием повторного локального side effect.

Product PR #7/PR #8 не менялись; hosted CI, provider traffic и реальные пользовательские данные не трогались.
