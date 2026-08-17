# AUTOPILOT CONTEXT — 2026-08-17

Это краткая карта для автономных GitHub-смен. Она не заменяет project-specific AGENTS/README/state и не разрешает production-действия.

## Общие правила
- Сначала читать актуальные open PR / Actions / последние коммиты; не работать по устаревшему снимку.
- Не force-push, не reset чужих/предыдущих веток, не переписывать историю.
- Не мерджить в `main` без нового явного разрешения владельца.
- Не делать production deploy, live-публикации, платные/внешние вызовы или операции с боевыми аккаунтами без нового явного разрешения.
- Не ослаблять тесты ради green. После первого green сразу брать следующий безопасный полезный кусок, пока остаётся время смены.
- Если предыдущая смена ещё имеет in-progress Action/PR на том же участке, не конфликтовать: продолжить другой проект/аудит и оставить handoff.

## AI Mirrors — один продукт, два связанных состояния
- GitHub: `Ai-b0ss/ai-mirrors` — развиваемый source/control repo.
- Hugging Face Space: `i99er/ai_mirrors` — живой брат/runtime того же AI Mirrors, а не отдельный проект.
- Последняя доказанная сверка (PR #3): HF commit `c4b7987fa4b0c212c5fbe67fc450270ab11ccbeb`, Space RUNNING, R10.5; 375/382 HF files byte-identical to GitHub, no HF-only files, GitHub has 8 extra service files, 7 common paths differ.
- Runtime-impacting divergences среди этих 7: `app_engine_v2/runner.py`, `landing/assets/og-preview.jpg`, `provider_pool/waves/master_completion_ledger_95.csv`.
- GitHub — structural superset, но НЕ byte mirror HF. Никогда не копировать один репозиторий поверх другого автоматически. Сначала доказать provenance/intent для каждого отличия.
- Historical rollback point QH1.4: HF commit `9b966224...`, runtime SHA-256 `86b6e6989bc1367d5aedf4d21fb67e01eb653db6e35e8832f14bd2e12ff7e798`; это история, не current HF main.
- `DEPLOYMENT_PROVENANCE.json` в GitHub по-прежнему не даёт автоматического разрешения на deployment.

## Qwen — ОДИН проект/система с двумя GitHub-компонентами
- Не считать `qwen-workspace` и `qwen-free-api` двумя независимыми Qwen-проектами.
- `Ai-b0ss/qwen-free-api`: рабочий OpenAI-compatible proxy/runtime к Qwen Chat, account/auth/browser-pool логика; `QWEN_WORKSPACE` по умолчанию указывает на `~/qwen-workspace`.
- `Ai-b0ss/qwen-workspace`: workspace + proof/audit/development harness и текущие bounded work units; это рабочая сторона той же системы.
- Изменения архитектуры проверять на совместимость обоих компонентов; не создавать второй параллельный runtime/дублирующий проект.
- Runtime/auth/account/Chrome-profile state должен сохраняться, но не раскрываться plaintext в Git.
- Текущий `QWEN_CURRENT_WORK_UNIT.txt` задаёт узкий bounded scope для Qwen proof-run; не ломать его широкими несогласованными изменениями.

## Notion Agent Bridge
- Канонический текущий source: NCM28 guarded-parent lineage.
- Сохранять exact-byte/manifests/Windows-native gates; portable PASS не подменяет Windows product gate.
- Open work включает Windows NCM28 product gate и phone-first summary.
- Live Notion/account writes не нужны для обычной CI-разработки; multi-account — легитимный консервативный failover/load-balancing, не обход ограничений.

## Kontur
- Живой изолированный staging: Worker `kontur-igor-staging`; D1 `kontur-staging`, UUID `22786b4b-99cc-4ca5-a18b-932e8781021b`.
- Запрещённые production write-targets: Worker `kontur-igor`; D1 `kontur`, UUID `91e39e7e-70fc-4551-8d3e-48235e70f985`.
- Staging держать `DEV_MODE=false`, без live Telegram publish / LLM / production secrets.
- Сейчас есть stacked PRs #6 (staging foundation), #7 (real staging product API path), #8 (production identity post-check); разбирать их как цепочку, не как три несвязанных проекта.

## Handoff между сменами
В конце каждой смены оставить короткий append-only комментарий в issue `[AUTOPILOT] Shared handoff ledger`: что реально изменено, branch/PR/commit, какой CI запущен/зелёный/падает, точный следующий безопасный шаг, и есть ли in-progress работа, которую следующей смене нельзя трогать параллельно.
