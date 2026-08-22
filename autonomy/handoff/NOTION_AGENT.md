# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22 19:xx UTC.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `57bafc097d610e8055ab28f2fadc36a85af8200a`
- Core/NCM28 PR #7 без отдельной стыковой необходимости не менять.

## Постоянная память
Стартовый `LATEST.json` имел Git blob `892d38a6d7fde6f7c62fa0c935e1118cf3c4ccfd` и указывал на capsule `20260822T170537Z-f0c0f9d24d`, archive SHA-256 `6c01666080bfbbdaa1a21a037208a4e9a9a4c726245d0324e96d75901f4b207a`.
Обе части fresh-read, их длины 2048/1112 и SHA-256 текста совпали с manifest. Exact `autonomy/v3/tools/capsule_runtime_v4.py` проверен по Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; нормативные v4 `verify` и `restore` дали PASS.

После этой смены опубликована новая проверенная capsule `20260822T190129Z-7bd99853c6`, archive SHA-256 `32ba5e29fe729df458d3e059b1ece31526c95ba810d11ac95007246349607744`. Обе immutable-части и manifest перечитаны после загрузки; их Git blob SHA совпали с локальными байтами. Перед публикацией старый `LATEST` всё ещё имел исходный blob `892d38a6...`, поэтому CAS прошёл без конфликта. Старый LATEST сохранён как PREVIOUS. Новый `LATEST` blob: `ec8b1a8b482d3c7387a91e1486a69e82880e0a38`.

## Materialization — главный продуктовый рубеж
Frozen preimages по-прежнему:
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.
Обычный `/v1/responses` пока не считать materialized до exact pair apply/readback.
Канонический путь: `tools/materialize_agent_wiring_with_tombstones.py`.

## Final evidence gate
По политике `autonomy/ci/CIRCLECI_GATE_POLICY.md` disposable ref `ci/notion-agent-final-gate` был выставлен на exact Agent SHA `57bafc097d610e8055ab28f2fadc36a85af8200a`, затем gate-only config commit `f53591a6876c4984fb34701b2098465482b013b7` восстановил isolated config blob `0824234f8abe1c6e5070eddba9109841de03748d`.

Fresh-read `GitHub.get_commit_combined_status(f53591a...)` снова вернул `statuses=[]`. Поэтому результат остаётся строго `RESULT_ACCESS_UNAVAILABLE`; PASS/FAIL не заявлять и этот gate не повторять на неизменившихся релевантных байтах.

## Новый найденный стыковой дефект — delegated prompt policy
Без product push подтверждён реальный контрактный пробел перед Qwen/Notion child-adapters: `DelegationRequest` и `DelegationContext` сейчас не переносят выбранный `engineer/owner` режим и точный `owner_system_prompt`. Поэтому owner-mode дочерняя задача не может сохранить управляющий prompt через provider-neutral envelope без скрытого side channel.

Локально подготовлен минимальный контракт-кандидат:
- явный `prompt_mode` (`engineer|owner`);
- `owner_system_prompt` только in-memory, `repr=False`;
- owner-mode требует непустой точный prompt и передаёт его adapter без переписывания;
- engineer-mode отбрасывает dormant owner text, чтобы он не утёк в child;
- `delegated_conversation_key` остаётся content-free и не включает приватный prompt;
- dispatcher передаёт prompt policy в child context.

Сфокусированные локальные проверки кандидата: `6/6 PASS`. Product bytes не пушились: обычная PR #8 ветка не должна использоваться как CircleCI development loop. PR comment: `#5382073066`.

## Уже закрыто — не исследовать заново
- engineer/owner prompt isolation в основном Responses-пути;
- foreground reservations и sticky account/thread affinity;
- fresh-thread/full-history continuation failover;
- `DynamicReservationLeaseSession` и transport provenance;
- provider-neutral delegation/subagents;
- bounded delegated tool-loop и no-replay;
- durable two-phase tombstones и POSIX path/descriptor hardening;
- materializer journal/backups/recovery/race guards, включая descriptor-bound journal/backup reads и late-swap regressions.

## Следующий точный шаг
1. Fresh-read PR #8 head; если он всё ещё `57bafc...`, получить exact локальное дерево и прогнать полный Agent cluster на hosted ChatGPT.
2. Совместить delegated prompt-policy envelope с exact materialization работой; не пушить обычную PR-ветку только ради CI-пробы.
3. Выполнить `tools/materialize_agent_wiring_with_tombstones.py --check` на frozen `server.py/account_pool.py` preimages.
4. Если локально зелёно — pair-apply, readback, compile и повторный полный cluster.
5. Только после релевантного изменения байтов и локального PASS разрешён один новый bounded gate на `ci/notion-agent-final-gate`; старый `f53591a...` не повторять.
6. После зелёного exact materialization/restart/no-replay cluster прекратить косметический аудит и перейти к bounded real Codex/Notion acceptance, затем синхронизация с Core.
7. LATEST/PREVIOUS/v4/CAS соблюдать; unknown bytes не реконструировать, force-write product/control state запрещён.
