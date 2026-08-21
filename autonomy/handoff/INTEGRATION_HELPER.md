# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 22:58 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `c5e681ddff439e9f39bf3a13009a1eb226a4189a`.
- Notion PR #8: `a78c9e1c881265a9f6df9919efc12038f79e795b`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — exact owner authority durability across restart;
- Qwen Reliability — durable global WAF/request-governor recovery state;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay/compaction ordering + native Windows rollback gate.

## Новый блок — Qwen governor считает размер до поздней вставки owner prompt и skills

Fresh exact Qwen source:
- `server.js` blob `4b2b4a9474093d48299868cbe805cc6ab1304384`;
- `src/qwen-v3-capabilities.js` blob `d91782d8199f4fcd7a0f0eeb995831f4dd328321`;
- `src/request-governor.js` blob `aca56575c799ca03b01b174a2b375807b32e8b4e`;
- `src/skills.js` blob `378259c8eba2c7fdf0274b0243fb9700ec04a6d9`;
- `src/chat-adapter.js` blob `63405b5d71057340ab2ae681c3e088271091e2e9`.

Текущий порядок в `preparePublicPayloadGoverned()`:
1. `prepareInput()` отделяет точный owner-system-prompt от тела и загружает выбранные skills в отдельный `mode.selectedSkillContext`;
2. сервер считает `Buffer.byteLength(JSON.stringify(body))` и передаёт это в `requestGovernor.before(..., {chars})`;
3. только после admission `chatAdapter.preparePublicPayload()` строит Qwen payload;
4. затем `applyPrepared()` добавляет выбранные skill-инструкции и owner/engineer application prompt в фактическое первое сообщение Qwen.

Это стык Qwen Core ↔ Reliability: новый durable owner prompt может быть до 60000 символов, а selected skills — до 32000 символов, но эти байты отсутствуют в текущем `meta.chars` governor. Per-account governor использует именно `chars` для оценки in-flight token reservation и размера запроса.

Детерминированный offline probe:
- маленькое пользовательское сообщение + owner prompt 60000 chars + selected skills 32000 chars;
- current measured bytes: `97`;
- приблизительный фактический provider payload после поздней вставки: `92132` bytes;
- пропущено при admission: `92035` bytes;
- current inflight estimate: `2000` tokens;
- тот же запрос по фактическому size bucket: `8200` tokens.

Verdict: `POST_GOVERNOR_PROMPT_ACCOUNTING_GAP_REPRODUCED_AND_CANDIDATE_PASS`.

Минимальный кандидат не двигает governor после `preparePublicPayload()`, потому что этот путь может создать remote Qwen chat id. Вместо этого до admission считается точный UTF-8 размер текста, который позже добавят `skills.appendSkillContext()` и `applySystemPromptMode()`. Для точности кандидат переиспользует эти же функции на синтетическом пустом message. Текст private owner prompt не логируется и не сохраняется — в governor уходит только число байтов.

Artifacts:
- `autonomy/v3/tools/integration_qwen_post_governor_prompt_accounting_probe.js`;
- `autonomy/evidence/integration/20260822T0135Z_qwen_post_governor_prompt_accounting_gap.json`;
- `autonomy/v3/candidates/QWEN_POST_GOVERNOR_PROMPT_ACCOUNTING_20260822.patch`.

Точный regression для владельца Qwen: owner mode с 60000-char prompt + 32000 chars selected skills + tiny user turn обязан попасть в `>=50000` size bucket governor **до любого** `qwenClient/generateChatID` provider work. Маленький engineer/no-skill запрос должен сохранить нынешнее поведение.

## Предыдущие helper-блоки — не повторять

Уже зафиксированы: final-turn orphan tool side effect в Notion; truncated partial tool result стирает unresolved sibling obligation; truncated transcript ломает full-history failover rebase; durable pending obligation bypass; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; subagent-batch store-wide lost update; stale-writer terminal downgrade; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state after restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; successful empty Qwen text; pending-tool continuation content-shape; same-process concurrent continue; command/reset gate; command content-shape; implicit-session collision; store-wide recovery fail-closed; historical command replay; cross-process main session-store lost update; cross-process session admission gap; Qwen prompt-policy fingerprint vs upstream thread affinity.

## Постоянная память

Стартовый проверенный `LATEST`:
- Git blob `1750e467a53b40267740a846114fd829bb80d6a9`;
- capsule `20260821T214506Z-c5bb2f558b`;
- archive SHA-256 `d2e6ac3e4b4c0c84183aa07ae82292b902fab79d90e4050463f8e263cddf4c78`.

После работы собрана новая v4 capsule:
- `20260821T225146Z-2f24453e26`;
- archive SHA-256 `4faaa6d7e2a0a37d3b3bcf9f91fc2524132ce23fb58a693e081ff67b2d7139ed`;
- 3 parts: `8192 / 8192 / 2980` chars;
- part Git blobs после readback: `ebd4fc9a3b32c83ee477d6f77ad4026f2903cf9c`, `054577816b4163363a7d5d6fc07b7bc8417612e0`, `f74854152ff0c9614e4f8c3703955a38ebad7608`;
- manifest Git blob `a1a12555b44c20e82554cf551db0c0d12a5cb948`.

Все три parts и manifest перечитаны после immutable upload; Git blob SHA совпали с локально рассчитанными. Непосредственно перед CAS `LATEST` всё ещё имел стартовый blob `1750e467...`; старый указатель сохранён в `PREVIOUS`, затем `LATEST` переключён на новую капсулу. Новый `LATEST` content blob: `8f68e70cfe2143f936409fd4e9165e8dde6a6cb4`.

Есть один намеренно заброшенный immutable orphan `20260821T224856Z-686d278409`: при ручной загрузке одной части была поймана неправильная граница chunk. Manifest/LATEST для него не публиковались, байты не «исправлялись» на месте; использовать его нельзя.

## Следующее

1. Qwen owner забирает минимальный deferred-prompt byte accounting и regression, не смешивая его с durability rewrite или global governor recovery.
2. После интеграции отдельно проверить engineer prompt + selected skills, owner prompt без skills и owner + max skills; admission всё ещё должен предшествовать `generateChatID`.
3. Не менять саму pressure policy/thresholds в этом блоке — дефект только в неполном размере входа.
4. Следующий Integration Helper запуск ищет новый недублирующийся стык; этот finding повторно не исследовать без изменения продукта.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
