# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22 18:xx UTC.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `57bafc097d610e8055ab28f2fadc36a85af8200a`
- Core/NCM28 PR #7 без отдельной стыковой необходимости не менять.

## Постоянная память
На старте fresh-read `LATEST.json`: Git blob `892d38a6d7fde6f7c62fa0c935e1118cf3c4ccfd`, capsule `20260822T170537Z-f0c0f9d24d`, archive SHA-256 `6c01666080bfbbdaa1a21a037208a4e9a9a4c726245d0324e96d75901f4b207a`.
Обе части fresh-read, длины 2048/1112 и SHA-256 текста совпали с manifest. Capsule локально прошла нормативные v4 `verify` и `restore`; восстановленный workspace совпал с manifest.

## Materialization — главный продуктовый рубеж
Frozen preimages по-прежнему:
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.
Обычный `/v1/responses` пока не считать materialized до exact pair apply/readback.
Канонический путь: `tools/materialize_agent_wiring_with_tombstones.py`.

## Final evidence gate — запущен один bounded run
По политике `autonomy/ci/CIRCLECI_GATE_POLICY.md` disposable ref `ci/notion-agent-final-gate` force-передвинут только на exact Agent SHA `57bafc097d610e8055ab28f2fadc36a85af8200a`.
Затем одним gate-only commit восстановлен доказанный isolated config из commit `2e3a0b8c98aefde755d2583bdb923177828a92e9`.
Точный gate commit: `f53591a6876c4984fb34701b2098465482b013b7`.
Config blob: `0824234f8abe1c6e5070eddba9109841de03748d`.
Gate содержит два offline доказательства: exact Linux Agent safety cluster и отдельный materialized `server.py + account_pool.py` rehearsal. Live Notion/Codex/provider traffic и production writes отсутствуют.

На момент handoff GitHub connector не показывает CircleCI status/checks для gate commit (`statuses=[]`). Поэтому результат записан строго как `RESULT_ACCESS_UNAVAILABLE/PENDING`, PASS не заявлять. Не запускать второй gate на тех же релевантных байтах. На следующем проходе сначала fresh-read status/check evidence для `f53591a...`; если результат доступен — сохранить точный result/artifacts. Если green, прекратить косметический аудит и переходить к bounded real acceptance. Если failed — читать доступный evidence и чинить точную причину локально перед новым gate.

## Уже закрыто — не исследовать заново
- engineer/owner prompt isolation;
- foreground reservations и sticky account/thread affinity;
- fresh-thread/full-history continuation failover;
- `DynamicReservationLeaseSession` и transport provenance;
- provider-neutral delegation/subagents;
- bounded delegated tool-loop и no-replay;
- durable two-phase tombstones и POSIX path/descriptor hardening;
- materializer journal/backups/recovery/race guards, включая descriptor-bound journal/backup reads и late-swap regressions.

## Следующий точный шаг
1. Fresh-read PR #8 head и gate `f53591a...` status/checks; не повторять gate без релевантного изменения байтов.
2. Если Circle evidence остаётся недоступен, PASS не заявлять; продолжить только безопасную локальную работу, не live provider.
3. Если gate green: выполнить bounded authorized Codex/Notion acceptance без повторения side effects, затем синхронизировать Agent на свежий Core.
4. Если gate failed: извлечь точную ошибку, локально исправить и перепроверить cluster/materializer; новый gate только после релевантного изменения байтов.
5. LATEST/PREVIOUS/v4/CAS соблюдать; unknown bytes не реконструировать, force-write product/control state запрещён.
