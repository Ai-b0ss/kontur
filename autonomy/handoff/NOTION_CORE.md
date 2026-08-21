# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head `23a52f88b065a9d03b93b94e2f2ea0044c167ece`. Не переносить/дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Текущий проверенный v4 `LATEST`:
- capsule `20260821T044703Z-495592db42`;
- archive SHA-256 `0ac8b64df353c5d817304bdde747166af76d7f24ee3e81d9cf67cdab25f9da93`, size 11964, 8 parts;
- part Git blobs: `d4081761d1e51eb01cde97247b73f1f65cf276fc`, `0028731ebf0e0b220a43a28bfaea06bae81bd6fa`, `ec34d9a1fd6f557717baf1820a40ea917b4ecf68`, `312b116fa8fa729610867ebac94fc47449dcac19`, `302b045d3b824054610912cb8761fd6725a2c3b6`, `fad96eebb6fa494fe47cdae571730683632f1b93`, `faae4cb3ad41b542d86ccd5df5f147b3bc3b9073`, `5f624cac884a8a1218f333fa04f553cf8b1801d9`;
- manifest Git blob `03ca450d4bcefda5fe0a4387db3383c33ea38412`;
- `LATEST.json` Git blob after CAS `71e2b0fc71aca0cf29ea87bbbcf1833f04b9ff48`;
- `PREVIOUS.json` now preserves capsule `20260821T040846Z-acb0adfd7d`.

Все 8 parts и manifest после публикации перечитаны из GitHub; их Git blob SHA совпали с локально рассчитанными. Перед CAS старый `LATEST` был перечитан и всё ещё имел ожидаемый blob `71f46ae1bdc98f133a1e1e51b3c6b76091350027`.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа — v23. Native Windows write primitive без нового точного Windows evidence не менять.

Уже доказано настоящим Windows: `build`, `happy-running`, `happy-stopped`, `rerun-noop` проходят; аварийный `auth-rollback` остаётся красным; managed-file rollback и non-target preservation проходят; auth/stable rollback падают с `PermissionError`; `remove_plain_tree` исключён как источник.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В этом запуске все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

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

## Core lifecycle: durable rendered Responses replay v4

Fresh PR #8 сохраняет исходные дефекты: `TurnAffinityStore` хранит только `completion_text`, а `responses_payload()` заново создаёт `response_id`, output item id и tool `call_id`; persistent `ConversationSegmentStore` хранит progress/thread/fingerprints, но не canonical Responses result.

В этом запуске exact source дал ещё критическую границу: `handle_openai_responses()` сейчас сохраняет `TurnAffinityStore` ДО `ConversationSegmentStore`. Поэтому простое добавление durable replay в conversation store недостаточно: если disk publication упадёт после affinity put, same-process retry сможет получить незакоммиченный tool recommendation из semantic cache и заново отрендерить его с новым `call_id`.

Первый v3-кандидат из `autonomy/evidence/notion/20260821T0448Z_durable_rendered_replay_v3_candidate.patch` после self-review ОТКЛОНЁН и не является apply-ready.

Доказанный порядок v4:
1. provider completion;
2. render canonical Responses result с окончательными response/item/call IDs;
3. один атомарный durable commit conversation record;
4. только после успешного durable commit — same-process affinity cache;
5. только после этого — exposure клиенту.

Дополнительные обязательные инварианты:
- `ConversationSegmentStore.put()` должен явно подтверждать durable success или поднимать отдельную ошибку и откатывать in-memory mutation;
- exact replay использует отдельный full-request fingerprint; per-item fingerprints остаются для prefix/continuation;
- legacy v2 exact progress без replay fail-closed, а не повторный provider call;
- tool-call с `conversation_key=None` fail-closed до affinity/exposure, потому что side effect нечем связать с durable replay identity;
- stream не должен отправлять `response.created` до решения replay/durable publication. Пока provider работает, допустимы только identity-free SSE comments/keep-alive; после commit поток строится из canonical stored response;
- bounded replay TTL candidate: 6h. После expiry payload удаляется, но request fingerprint остаётся; exact retry затем fail-closed, не перепланирует возможный side effect.

Локальные доказательства:
- `DURABLE_RENDERED_REPLAY_V4_ORDERING_PASS`: forced durable failure => 503, affinity пуст, response не exposed; missing conversation identity для tool call => fail-closed; successful tool round следует `provider→render→durable→affinity→expose`; final text остаётся совместимым для клиента без Codex conversation identity.
- `DURABLE_RENDERED_REPLAY_V4_REAL_STORE_CLASS_PASS`: v2 load как legacy-without-replay; v3 canonical replay survives restart; forced NCM28 save failure возвращает in-memory состояние и не меняет disk; expiry удаляет payload, но сохраняет fingerprint; `input=[]` подтверждает необходимость отдельного full-request fingerprint.

Основное evidence: `autonomy/evidence/notion/20260821T0458Z_durable_rendered_replay_v4_evidence.json`.

## Следующий порядок

1. Не перезапускать pending Windows digest; только read-only проверять новый факт.
2. На exact свежем PR #8 материализовать локальные `conversation_segments.py` + `server.py` и собрать apply-ready v4 patch, НЕ пушить product branch при ZERO-MINUTE.
3. В patch соблюдать `provider→render→durable→affinity→expose`; shallow rollback не использовать, если cleanup может мутировать dataclass in-place — применять immutable replacement/deep snapshot.
4. Локально прогнать реальные классы: v2 load, forced NCM28 save failure, same-process exact retry, process restart, stream/non-stream, tool call, final text, empty-input exact key, replay expiry; provider stub `call_count=1` после durable publication.
5. Держать shell-env hardening для real Codex probe.
6. При первом разрешённом native Windows gate совместить auth-rollback callsite с PowerShell restore proof; без нового fanout.
7. После Core gates: один bounded авторизованный `codex exec → bridge → Notion → local tool → verifier FAIL → tool result → fix → VERIFY_OK`, затем restart/recovery без повторного локального side effect.

Product PR #7/PR #8 в этом запуске не менялись; hosted CI, provider traffic и реальные пользовательские данные не трогались.
