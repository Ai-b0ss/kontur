# Kontur — продукт

## 2026-08-20 — текущий head, zero-minute режим и точная причина staging-path

Продукт: PR #12, ветка `fix/kontur-core-visual-continuity-20260818`, exact head `32034e8af92923a2abe09ad00e3220f6da1ed21c`. PR открыт, draft, mergeable. `main`, production Worker и production D1 не трогались.

Свежая обязательная граница из PR: владелец включил временный zero-minute режим — не запускать/перезапускать CircleCI или GitHub Actions и не делать push, который заведомо создаст hosted CI. Для браузерной проверки теперь предпочтителен бесплатный ChatGPT/container runner после материализации точного source snapshot. Поэтому прежний pending CircleCI `3bed8080-c63a-4d68-95d6-b0e51aa7575b` не считать основанием для новых rerun.

Что перепроверено на exact head: q8 state-ordering остаётся исправленным; hatch/reveal — одна сцена с двумя половинами скорлупы, птица ниже shell-layer; граница hatch->reveal сохраняет финальную позу птицы; reduced-motion для reward egg сокращает обязательную задержку. Старые Chromium-артефакты полного пользовательского пути существуют и доступны через `kontur_chromium_walkthrough.html`/GitHub artifacts, но они относятся к более раннему head и не доказывают новый hatch визуально.

Новый важный вывод по падающему `kontur-igor-staging`: репозиторный deploy-контракт намеренно запрещает обычный production deploy. Root `pnpm cf:deploy` ведёт в `@kontur/worker deploy`, а тот запускает `tools/cloudflare/refuse-direct-production-deploy.mjs` и должен падать. При этом безопасный staging-путь уже явно задан: `tools/cloudflare/workers-build-staging.sh` собирает Mini App и генерирует `apps/worker/wrangler.staging.generated.jsonc`; фактический staging deploy должен быть `pnpm -F @kontur/worker exec wrangler deploy --config wrangler.staging.generated.jsonc --keep-vars`. В нём staging D1 `22786b4b-99cc-4ca5-a18b-932e8781021b` отдельно проверяется против production D1 `91e39e7e-70fc-4551-8d3e-48235e70f985`. Следовательно, текущий Workers Builds `Deployment failed` первым делом трактовать как неверный внешний deploy command/config path, а не как поломку продукта.

Историческое доказательство подтверждает, что isolated staging уже проходил end-to-end на 2026-08-17 после удаления лишнего `wrangler secret put`; значит сам target `kontur-igor-staging`/`kontur-staging` работоспособен. Не менять production config и не использовать committed `apps/worker/wrangler.jsonc` для staging.

Что делать следующим:
1. Не тратить hosted minutes, пока zero-minute режим явно не снят.
2. Материализовать exact PR #12 source snapshot в доступный ChatGPT/container runner и прогнать Playwright локально: 320×568 + 430×1000, быстрый/медленный q8, skip, reduced-motion, console/network/layout checks, screenshots/video/trace. Визуально проверить ранний/средний/поздний hatch и стык hatch->reveal.
3. Для Cloudflare staging исправлять не код продукта, а внешний Workers Builds deploy command: build/prep через `tools/cloudflare/workers-build-staging.sh`, deploy только generated staging config с `--keep-vars`. После доступа к Cloudflare settings/logs — один non-destructive staging PASS.
4. Затем Telegram WebView smoke. Только после этого обсуждать release/promotion.
