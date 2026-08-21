# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 15:37 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `205faf3e4b9f89c53e40930cb6447cba6ed37677`.
- Notion PR #8: `2668e84c0b1ba63750c7db708e5124d0d6cede14`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — stale-backup/session HTTP contract + ближайший restart/session кластер;
- Qwen Reliability — local preparation / post-success / failure / provider-circuit persistence boundaries;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay + native Windows rollback gate.

## Новый блок — content-derived implicit session collision

Fresh exact source:
- `server.js` blob `44d04725f7b1445f61c0f2da17007d1da8f0895f`;
- `src/chat-adapter.js` blob `63405b5d71057340ab2ae681c3e088271091e2e9`.

Если OpenAI-compatible клиент не передаёт явный `session_id`/`conversation_id`, `getOpenCodeSessionKey()` строит долговечный ключ только из `model + user + первого user-сообщения`.

Это не является уникальной идентичностью разговора. Два независимых разговора с одинаковой моделью, тем же user/default и одинаковым первым запросом получают один и тот же `derived-v2-*`.

Опасный сценарий воспроизведён офлайн:
1. Разговор A сохраняет `qwen-thread-from-conversation-A` на `acct-A`.
2. Независимый разговор B имеет тот же первый user-текст, но другой system prompt и дальнейшую задачу.
3. B — нормальный multi-turn transcript, поэтому `isInitialConversation()` false и ключ не очищается.
4. Сервер читает record A, считает аккаунт доступным и ставит `existingChatId = thread A`.
5. `chat-adapter` получает `currentOnly=true`; вместо свежего full-history B в уже существующий upstream thread A отправляется только текущий turn B с локальным framing.

Офлайн verdict:
`QWEN_IMPLICIT_SESSION_COLLISION_REPRODUCED_AND_STATELESS_CANDIDATE_PASS`.

Риск:
- независимые разговоры могут разделить один Qwen thread;
- локальные session/tool-memo/account/thread namespace могут пересечься;
- последующий mutating tool-call B может выполняться в контексте A;
- увеличивать длину хэша или добавлять больше текста не решает фундаментальную проблему: одинаковые независимые разговоры всё равно возможны, а меняющийся по истории ключ ломает continuity.

Безопасный минимальный контракт:
1. Только явный client session/conversation id разрешает durable `sessionStore`, `toolMemo` и upstream-thread affinity.
2. Нет явного id => stateless: `record=null`, `chatId=null`, `currentOnly=false`, полный caller transcript уходит в свежий Qwen thread.
3. Короткое продолжение, которое требует прошлой durable state, без явного id должно fail-closed стабильным 4xx, а не угадывать разговор по содержимому.
4. Существующий `SessionRequestGate` сохранять для явных session ids; implicit текстовые совпадения не должны давать общий долговечный namespace.

Artifacts:
- `autonomy/v3/tools/integration_qwen_implicit_session_collision_probe.js`;
- `autonomy/evidence/integration/20260821T1537Z_qwen_implicit_session_content_collision.json`;
- `autonomy/v3/candidates/QWEN_IMPLICIT_SESSION_COLLISION_FAIL_CLOSED_20260821.patch`.

Product PR #6 не переписывался: это отдельная регрессия/кандидат для владельца Qwen Core после его текущей узкой session/restart работы.

## Предыдущие helper-блоки — не повторять

Последние два открытых перед новым блоком:
- truncated partial tool result стирает unresolved sibling obligation из durable session history;
- тот же truncated transcript ломает full-history rebase при failover на sibling account.

Также ранее уже зафиксированы: durable pending obligation bypass обычной фразой/неполной историей; duplicate unresolved `tool_call.id`; stale session backup; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape; same-session concurrent continue; command/reset gate; command content-shape.

## Постоянная память

На старте этого запуска прочитан `LATEST.json` Git blob `6f93e4390f8518146a2d018953a018c3a618b062`, capsule `20260821T144628Z-e703b2256c`, archive SHA-256 `31ba53852b5a99d8d469ebdb36fa9c59812b16db01a91f6170467389f1a650ba`.

Manifest и все 5 parts прочитаны отдельно; размеры и SHA частей проверены, archive size/SHA совпали, workspace восстановлен безопасной v4-семантикой и побайтово сверён с manifest.

Финальная capsule этого запуска публикуется только по протоколу `checkpoint -> pack -> verify/restore -> immutable upload/readback -> CAS LATEST` от исходного blob `6f93e439...`. При CAS-конфликте force-write запрещён.

## Следующее

1. Qwen Core после текущего stale-backup/session кластера забирает регрессию implicit-session collision рядом с `SessionRequestGate` и restart/session policy.
2. При исправлении не сохранять implicit durable state ради обратной совместимости ценой смешивания независимых разговоров: без client identity надёжной thread affinity нет.
3. Integration Helper следующий запуск берёт новый недублирующийся стык, не возвращаясь к этому сценарию.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Production, реальные данные, аккаунты и секреты не трогались.
