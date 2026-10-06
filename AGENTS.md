<!-- ACCOUNT_WIDE_BOOTSTRAP_V1 -->
## Account-wide orientation — mandatory

Before every substantial repository task, also read:

1. `docs/ACCOUNT_ATLAS.md` — private cross-repository topology, hidden work clusters and absence-test protocol.
2. `docs/IDEA_LINEAGES.md` — cross-repository system/idea lifetimes and epoch transitions.
3. `.agent/account-index.json` — machine-readable account/repository graph snapshot.
4. `.agent/idea-lineages.json` — machine-readable lineage IDs, aliases, key objects and evidence boundaries.
5. `.agent/github-objects-index.json` — this repository's PR/issue/workflow/tag archaeology.
6. `.agent/pr-ledger.json` — complete all-state PR archaeology (open, merged, and closed-unmerged) with real base/head SHAs. Read it whenever prior, abandoned, superseded, migrated, or historical PR work could matter.

These are navigation snapshots, not live authority: re-resolve current GitHub state when freshness matters.

Reading the atlas and lineage map is mandatory; exhaustively searching every other repository is not. When a task names a system/idea, resolve its lineage ID and epoch before assuming the current repository is the project boundary. Expand account-wide archaeology when the task may overlap prior, abandoned, migrated, cross-repo or externally deployed work.

---

<!-- AGENT_BOOTSTRAP_V2 -->
# READ THIS FIRST — mandatory repository bootstrap

For every substantial task in this repository, **before designing or editing**:

1. Read [docs/AGENT_OPERATING_SYSTEM.md](docs/AGENT_OPERATING_SYSTEM.md) — this is the all-work recovery and source-authority contract.
2. Read [docs/AGENT_NAVIGATION.md](docs/AGENT_NAVIGATION.md) — repository-specific architecture map.
3. Pin the exact branch and commit; do not reason from a branch name alone.
4. If prior/abandoned/forgotten work may exist, search branch tips **and full reachable Git history** with `tools/agent_history.py` before implementing a replacement.
5. For exact code locations on any ref, run `python tools/build_agent_index.py --ref "<branch-or-SHA>"`.
6. Never conclude "this was never implemented" from `main` alone.

The navigation files in `main` are deliberately external to old evidence branches so those historical heads remain immutable.

---

# Контур — глобальная навигация для агентов

## Обязательный порядок входа
1. Зафиксировать ветку и head SHA по `.agent/branch-index.json`.
2. Прочитать существующий обязательный навигатор и состояние проекта по правилам ниже.
3. Прочитать `docs/AGENT_NAVIGATION.md` для карты кода.
4. Использовать `.agent/file-index.json`, чтобы отличать runtime, domain core, tooling и дизайнерские/исторические материалы.
5. После checkout выполнить `python tools/build_agent_index.py --ref "<branch-or-SHA>"`: он строит точные номера строк и начала символов для конкретной ветки.

`main` — интеграционная ветка. Более ста `ci/*`, `evidence/*`, `cursor/*`, `infra/*` и других веток — история разработки и доказательства. Не считать их текущими только из-за слов `final`, `prod`, `release` или `evidence` в имени.

## Существующие правила проекта
Ниже сохранены исходные правила; они остаются авторитетными для состояния проекта, production-записей, миграций и продуктовой работы.

# Правила работы с проектом «Контур»

Эти правила действуют для всего репозитория.

1. До анализа или изменения проекта полностью прочитайте
   `AI_PROJECT_NAVIGATOR.md`, затем `PROJECT_STATE.yaml`.
   Для продуктовой пересборки дополнительно обязательны
   `PRODUCT_REDESIGN_BRIEF.md` и `CHAT_RESEARCH_PROTOCOL.md`.
2. В первом рабочем сообщении назовите прочитанную версию навигатора и текущий
   production code checkpoint. Если файлы расходятся с кодом, остановитесь и
   зафиксируйте расхождение как `UNKNOWN`, а не додумывайте состояние.
3. Источник истины по убыванию приоритета: текущий код и тесты,
   `PROJECT_STATE.yaml`, `AI_PROJECT_NAVIGATOR.md`, `README.md`/`HANDOVER.md`,
   исторический `WORKLOG.md`, затем концептуальные `DESIGN.md` и
   `kontur-brief.html`.
4. `.superseded/` и старые архивы — только исторические свидетельства. Не
   копируйте из них runtime-код без найденной и описанной причины.
5. Перед правкой проверьте `git status`, назовите границу задачи и не трогайте
   несвязанные пользовательские изменения.
6. Не читайте вслух, не коммитьте и не упаковывайте `.env`, `*.local`,
   `backups/`, `data/`, `research-private/`, Telegram ID и другие персональные
   данные.
7. Диагностика не разрешает production-запись. Перед изменением production-кода
   или схемы нужен Git-чекпоинт; перед изменением D1 — полный backup. Уже
   применённые миграции не редактируются: добавляется следующая номерная.
8. Восстановление D1 сначала выполняется только как Dry Run. `-Apply` требует
   отдельного явного решения и автоматического pre-restore backup.
9. Не возвращайте широкую концепцию из `DESIGN.md` в MVP автоматически.
   Изменение ядра, смысла, функций, дизайна или текстов — отдельный продуктовый
   этап из `BACKLOG.md`.
10. После значимой правки выполните соразмерную проверку, обновите затронутые
    документы состояния и запишите решение в `WORKLOG.md`. Не называйте
    `UNKNOWN` или `HOLD` ошибкой и не выдавайте непроверенное за завершённое.