# FREE FABRIC vNext — граница совместимости текущих Qwen/Notion

Дата фиксации: 2026-08-22.

Назначение этого файла — не объявить уже существующую систему готовой FREE FABRIC и не заменить `OWNER_INTENT_RU.md`. Это переходная карта: какие сильные механизмы Qwen/Notion нужно сохранить при будущей миграции в общую Fabric, а какие проектные механизмы нельзя ошибочно считать уже реализованным общим control plane.

Основание: архитектурный проход FREE FABRIC vNext от 2026-08-21 + текущее состояние product/handoff на 2026-08-22. Более новая полная каноническая архитектурная спецификация в control repo на момент этой фиксации не обнаружена; поздние V45/V46 Notion и свежие Qwen fixes являются уточнениями реализации, а не заменой всей vNext-карты.

## Четыре обязательных инварианта

1. Worker/ChatGPT-run/Circle job/provider thread — временный исполнитель, не сама задача.
2. Логическая задача и принятый checkpoint должны переживать смену исполнителя.
3. Чистые вычисления могут выполняться как минимум один раз, но stale writer не может сам сделать результат каноническим.
4. Внешний или потенциально мутирующий эффект нельзя слепо повторять после неясного исхода; нужен durable intent/receipt или fail-closed UNCERTAIN + reconciliation.

Любая новая проектная логика Qwen/Notion должна быть совместима с этими инвариантами, даже пока общего Cloudflare Fabric control plane ещё нет.

## Что уже является хорошим переходным слоем

### Qwen

Сохранить при будущей упаковке в `QwenProviderAdapter`:
- pool/candidates/current/preferred;
- account-local cooldown/CAPTCHA отдельно от provider-wide circuit;
- account/thread affinity;
- fresh-thread + full local history rebase при legitimate failover;
- bounded retry/failover budget;
- durable continuation/checkpoint;
- pending tool calls и restart safety;
- completed mutating side-effect no-replay;
- unresolved/uncertain mutating tool fail-closed;
- prompt modes, OpenCode и subagent semantics.

Это provider-specific policy внутри адаптера, а не будущая общая Task БД.

### Notion

Сохранить при будущей упаковке в `NotionProviderAdapter`:
- slot/account reservations;
- account/thread affinity;
- fresh provider thread + full local transcript при failover;
- dynamic reservation reselection до provider entry;
- durable no-replay tombstones для локальных mutating tools;
- provider intent / strict finalize / exact replay;
- protected post-intent provider step без неявного sibling failover;
- provider-neutral DelegationRequest как предшественник будущего Fabric ChildTask.

V45/V46 Agent↔Core composition — обязательная переходная граница: Agent wrapper не должен терять Core `allow_failover=false` после durable provider intent.

## Что пока НЕ является реализованной FREE FABRIC vNext

До отдельного доказательства не заявлять, что существуют:
- единый durable `Task`/`Attempt` ledger в D1;
- `TaskCoordinator` Durable Object с task/lease/owner generations и общесистемным fence;
- единый `EffectIntent`/`EffectReceipt` service для всех проектов;
- Fabric Router, выбирающий provider/executor по `TaskRequirements`;
- общие `ProviderAdapter`/`ExecutorAdapter` registry;
- event-driven Workflows/Queues DAG, продолжающий полезную работу между ChatGPT pulses;
- единый hot checkpoint head вне GitHub;
- централизованный `ResultCandidate -> independent Verifier -> RESULT_ACCEPTED`;
- универсальный SecretReference/secret broker с доказанной process boundary;
- пять полностью перепрофилированных Fabric cognitive pulses.

Текущие issue #9, handoff, v4 capsules, per-worker `LATEST/PREVIOUS`, disposable Circle gate branches и project-specific Automations — переходные механизмы. Они могут быть правильными сейчас, но не должны превращаться в новые несовместимые общие абстракции.

## Правильный порядок миграции

Не перепрофилировать пять Automations в общие Fabric-роли до появления минимального P0/P1: общего TaskSpec/state machine/fence/effect semantics и долговечного control plane. Иначе исчезнет рабочая проектная специализация, а общей очереди, которую должны обслуживать новые роли, ещё не будет.

Пока P0/P1 не реализованы:
- продолжать доводить Qwen/Notion до крепкого product DONE;
- новые safety-механизмы формулировать так, чтобы их можно было позже вынести в Adapter/Fabric concepts;
- не строить отдельный Qwen- или Notion-specific Cloudflare control plane;
- не переносить hot coordination из GitHub в новую самодельную БД по частям;
- Capsule v4 сохранять как проверенный recovery floor;
- Circle final gates держать редкими, exact-SHA и одноразовыми;
- не считать старый green доказательством свежего composed SHA.

После P0/P1:
- Qwen/Notion становятся ProviderAdapter;
- Notion DelegationRequest создаёт настоящий durable ChildTask, а не прямую provider-to-provider передачу состояния;
- Capsule v4 обобщается в FABRIC_CHECKPOINT_PROTOCOL без потери exact-byte/CAS свойств;
- project-specific effect/replay safety постепенно переводится на общий Effect Gate там, где это не ослабляет более строгую provider-specific защиту;
- только затем пять Automations переводятся с project ownership на Fabric cognitive roles.

## Текущие ближайшие обязательные стыки

Qwen: закрыть bounded internal prompt-mode error на fresh head, прогнать targeted cluster, затем exact full `npm test`; только после стабильного SHA — один final Circle gate.

Notion: прогнать V46 composition materializer на exact реальных bytes; затем composed Agent+Core tests; затем собрать Stage-B orchestration на composed source; только после local green — native Windows gate и один bounded authorized Codex→Notion acceptance.

До этих доказательств никакой статус `FABRIC_DONE`, `QWEN_DONE` или `NOTION_DONE` из одной зелёной локальной проверки не выводится.
