# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`; freshest read-only head этого запуска `75a4a6de243e22e0df3c15e572e7aa09977d1fcb`. Не дублировать rotation, prompt modes, delegation или account/thread affinity; Core проверяет только необходимый lifecycle/Codex стык.

## Режим

ZERO-MINUTE: CircleCI/GitHub Actions/Cloudflare/другой hosted CI не запускать, trigger-push не делать. Бесплатные локальные Linux/Python/Node проверки разрешены. Native Windows не имитировать. Production, реальные Notion данные/traffic и секреты без отдельного live gate не трогать.

## Постоянная память

Новый проверенный v4 `LATEST`:
- capsule `20260821T064849Z-7b43475e0e`;
- archive SHA-256 `dfb7f2bd1bbbc8e0247a1f513f9e806bd8bb20c1b4715501ca91cabaadf82d83`, size 7685, 2 parts;
- part Git blobs: `ece8fc19f59aeca4ddf52424cdbf3d832591feca`, `b4ef864681dbac56bff5b5d6c0110f64734a0d2d`;
- manifest Git blob `75b7308a6f108626f755ea69e68cf9f7f961a41b`;
- `LATEST.json` Git blob after CAS `0f26decace9e2bf2b3a3d688f803b24582066523`;
- `PREVIOUS.json` preserves capsule `20260821T055331Z-a7c62dc7fe`.

Перед CAS старый `LATEST` был перечитан и всё ещё имел ожидаемый blob `1693eb723d60dbcfd1cb12bb3e9d009323317fea`. Новый immutable manifest и обе parts перечитаны; их Git blob SHA совпали с локальными `git hash-object`.

## NCM28 / Windows

Последняя доказанная хорошая файловая основа остаётся прежней. Native Windows write primitive без нового точного Windows evidence не менять.

Существующий digest-разрез workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` НЕ перезапускать. В начале этого запуска все пять задач (`auth`, `codex`, `migration`, `runtime`, `outside-digest`) снова `pending`. Hosted Windows/CI не запускался.

При одном будущем разрешённом native-Windows Core gate совместить точный `auth-rollback` callsite, PowerShell runtime-restore replace proof и затем полный NCM28 gate; не создавать новый диагностический fanout.

## Runtime restore atomicity

Кандидат v3 остаётся актуален: decrypt во временный sibling-файл, fail-closed destination checks, cleanup temp при decrypt/promotion failure, секрет только через stdin. Linux verdict `RUNTIME_RESTORE_ATOMICITY_V3_LINUX_PASS`; нативная PowerShell replace-семантика не заявлена.

## Durable Responses replay — v6

V5 правильно выявил, что точный Responses-ответ (`response_id`, `item_id`, `call_id`) должен быть сформирован и сохранён долговечно до выдачи Codex. Но при сверке со свежим exact source найден новый blocking integration bug: v5 повышал top-level `conversation-state.json` до `version=3`, тогда как `payload/stable_runtime_state.py` по-прежнему жёстко задаёт `CONVERSATION_STATE_VERSION = 2` и отвергает любую другую версию как `STABLE_CONVERSATION_STATE_INVALID`.

Поэтому v5 в таком виде НЕ применять.

V6 исправляет формат без изменения Windows/NCM28-контракта:
- top-level `conversation-state.json` остаётся `version=2`;
- replay-семантика маркируется внутри записи `replay_schema_version=1`;
- старые v2-записи без маркера считаются `legacy_without_replay` и точный restart-retry fail-closed;
- дополнительные replay-поля проходят существующие stable-runtime migration transforms без потерь, потому что обе стороны копируют conversation entry через `dict(raw)`;
- replay TTL = 6 часов;
- максимум одного replay = 512 KiB;
- суммарный replay budget = 8 MiB;
- при aggregate overflow удаляется самый старый replay payload, но request fingerprint сохраняется, поэтому поздний точный retry не вызывает модель повторно.

Локальные verdicts:
- `DURABLE_RENDERED_REPLAY_V6_STORE_COMPAT_PASS`;
- `DURABLE_RENDERED_REPLAY_V6_SSE_SHAPE_PASS`.

Доказано: top-level v3 действительно ломает exact stable-runtime v2; nested replay v1 в top-level v2 переживает restart/migration-copy с тем же `call_id`; oversized replay отклоняется до публикации; aggregate eviction сохраняет fingerprint; до durable commit SSE может содержать только identity-free comment keepalive, а после commit fresh/replay строятся из одного канонического response и имеют одинаковые IDs.

Evidence: `autonomy/evidence/notion/20260821T0649Z_durable_rendered_replay_v6_evidence.json`.

Граница: настоящий текущий Codex CLI ещё не доказал принятие identity-free SSE comments до `response.created`, потому что локального `codex` binary в hosted машине нет. Не объявлять это PASS по модельному harness.

## Codex shell-env safety

Свежий `tools/run_real_codex_cli_project_probe.py` на PR #8 всё ещё blob `2f6d5873606975771b5ab418d5f9d45cd602304c` и пока не содержит подготовленной защиты `[shell_environment_policy] inherit="core"` + `ignore_default_excludes=false`. Живой probe до включения этой защиты не запускать: локальные shell tools иначе потенциально наследуют `NOTION_BRIDGE_API_KEY`.

## Следующий порядок

1. На старте восстановить новый v4 `LATEST` и read-only проверить существующий Windows digest; не перезапускать.
2. Материализовать exact минимальный server fixture свежего PR #8 и интегрировать v6 с порядком `provider result -> canonical Responses IDs -> durable conversation-state write -> transient affinity/cache -> client`.
3. На настоящих классах локально проверить same-process retry, restart, tool call, forced disk-write failure, stream/non-stream presentation и size/eviction. Для tool replay обязательны `provider call_count=1` и неизменные IDs.
4. Локально добавить shell-environment safety в exact Codex probe fixture и contract test; product-push не делать под ZERO-MINUTE.
5. После Core safety gates — один bounded уже-авторизованный `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем restart/recovery proof.

В этом запуске product PR #7/#8 не менялись, hosted CI и provider traffic не запускались.
