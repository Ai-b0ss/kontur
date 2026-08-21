# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head в этом запуске `9cd1a98ee1d1c85a9d3650c6d756852810a055f3`. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Последний опубликованный проверенный v4 `LATEST` на старте этого запуска:
- capsule `20260821T015251Z-9afa256e7a`;
- archive SHA-256 `729c166be7583481d29f7ff1cdf22f0935352bd08ced8fba28ca99d7edd8653b`, size 5877, 2 parts;
- part-0000 Git blob `87969c17567e6265b8f4295a009139687a7249f9`;
- part-0001 Git blob `bc7a06d2a4bc12511766dcbef553c77223f2020d`;
- manifest Git blob `e31d10c11f74fe5ea0bcff7325681692f2af9cbc`;
- `LATEST.json` parent Git blob `be2508d8ef972de25f3a0ace409f817b9288db8a`.

В этом запуске manifest и обе parts повторно прочитаны из GitHub и совпали с записанными blob SHA/длинами. Локальная машина не имеет DNS-доступа к raw GitHub; поэтому не подменять обязательный `capsule_runtime_v4.py restore/pack` самодельной реализацией. Если новый pack не успел быть опубликован, текущий LATEST остаётся каноническим, а новые доказательства уже долговечно лежат в `autonomy/evidence/notion/`.

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

Real Codex project probe всё ещё нуждается в integration-only hardening:
```toml
[shell_environment_policy]
inherit = "core"
ignore_default_excludes = false
```
Локально доказано, что эта политика не пропускает `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY` и тестовый AWS secret в model-reachable shell. До применения защиты живой Codex/Notion probe не запускать.

## Core lifecycle: durable rendered Responses replay

Fresh PR #8 всё ещё содержит два связанных Core-дефекта:
1. same-process `TurnAffinityStore` хранит `completion_text`, а cache hit заново вызывает `responses_payload()`, поэтому новые UUID меняют `response_id`, output item id и tool `call_id`;
2. persistent `ConversationSegmentStore` хранит progress/thread/fingerprints, но не готовый Responses result. После restart exact replay может иметь persisted progress без replayable protocol result.

В этом запуске проверен точный порядок свежего `server.py`: после provider completion сначала сохраняются `turn_affinities.put()` и `conversation_segments.put()`, и только ПОСЛЕ выхода из lease вызывается `responses_payload()`. Значит crash после segment save, но до render/HTTP способен оставить durable «обработано» без соответствующего tool-call ID.

### Доказанный минимальный инвариант

Отдельный replay-файл рядом с `conversation_segments.json` недостаточен: два независимых atomic rename всё равно оставляют окно crash между ними. Нужна одна атомарная публикация записи, которая одновременно содержит:
- content-free request fingerprint;
- segment progress/account/thread metadata;
- уже отрендеренный completed Responses payload с окончательными `response_id`, item id и `call_id`.

Offline crash-state matrix пройден:
- crash после provider completion, но до атомарной публикации: provider retry разрешён, потому что durable progress ещё не опубликован;
- crash после атомарной публикации, но до HTTP/SSE return: exact retry возвращает тот же stored replay без provider inference;
- crash после return: тот же replay;
- progress-without-replay через новый writer: недостижим;
- legacy/corrupt progress-without-replay: fail closed, не новый plan.

Вердикт: `DURABLE_RENDERED_REPLAY_ATOMIC_RECORD_MODEL_PASS`.

Материал: `autonomy/evidence/notion/20260821T0305Z_durable_rendered_replay_atomic_record_model.json`.

### Реализационная граница

Наиболее узкий безопасный путь — расширить persistent conversation record replay-полями и рендерить Responses result ДО единственного `conversation_segments.put()`. Этот `put()` должен атомарно публиковать progress+replay через уже используемый NCM28 atomic-write primitive. Same-process affinity либо хранит тот же rendered payload, либо cache hit сначала читает replay из persistent segment. SSE строится из сохранённого payload, а не повторным `responses_payload()`.

Нельзя считать готовым до exact-source regression, который докажет стабильные IDs для non-stream + stream и crash/restart без второго provider call.

## Следующий порядок

1. Не перезапускать pending Windows digest; только read-only проверять новый факт.
2. На exact свежем PR #8 подготовить bounded Core candidate: render response before durable publication; one atomic segment+replay record; exact replay before provider inference; fail closed for legacy progress-without-replay.
3. Локально прогнать crash matrix уже на реальных классах `ConversationSegmentStore`/server helper: same-process retry, process restart, stream/non-stream, tool call и final text; provider stub обязан иметь call_count=1.
4. Держать shell-env hardening для real Codex probe; product push не делать до снятия ZERO-MINUTE.
5. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore proof; без нового fanout.
6. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery без повторного локального side effect.

Product PR #7/PR #8 не менялись; hosted CI, provider traffic и реальные пользовательские данные не трогались.
