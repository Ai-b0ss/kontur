# Контур — актуальный backlog

**Обновлено:** 2026-08-17.  
Старый backlog: `docs/archive/legacy/BACKLOG_PRE_CANONICAL.md`.

## HANDOFF — текущая задача

Цель: одна ссылка/commit с полной рабочей кодовой базой и доказанным product state.

Сделано в PR #11:
- exact primary source 13.08 восстановлен из исходного context-kit и импортирован byte-for-byte;
- exact SHA-256 primary source закреплены в fail-closed CI;
- accepted Step E evidence 14.08 восстановлен и также закреплён exact SHA-256;
- current product/TZ/decision log отделены от истории;
- H3/B/C/D/E path подтверждён в runtime source;
- текущая таксономия = 5 backend roles / 6 visual results, включая отдельного Котосова как presentation-only `vibe` subtype;
- старые product docs/art/prototypes физически вынесены в `docs/archive/legacy/`;
- происхождение Git-export вынесено в `docs/provenance/`;
- README/HANDOFF приведены в состояние для внешнего разработчика;
- CI работает с clean checkout + frozen install + tests/typecheck/build;
- добавлен fail-closed `Handoff safety gate`;
- `tools/package-handoff.ps1` строит share-safe ZIP из фактического `git ls-files` и выдаёт SHA-256 manifest с secret-scan;
- staging/production release workflows перенесены в handoff-базу;
- post-deploy verifier теперь ждёт exact SHA свежего `dist/index.html` и проверяет egg assets по MIME + exact SHA;
- regression test воспроизводит stale-generation race и SPA fallback;
- production incident run `32030041504` классифицирован без повторного destructive reset.

Практический handoff считается готовым после зелёного CI exact handoff head и фиксации стабильного commit. Merge в `main` требует отдельного явного owner-разрешения.

## ЗАКРЫТО — exact primary source 13.08

`KONTUR_NEXT_CHAT_CONTEXT_KIT_2026-08-13.zip` доказан как исходный контейнер.

Импортированы exact bytes:
- `PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- `FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`.

Не возвращать этот пункт в unresolved/recovery без нового противоречащего evidence.

## ЗАКРЫТО — STEP E / bird taxonomy

Exact 14.08 evidence доказывает owner acceptance:
- `PREVIEW_INTEGRATION_GATE_2026-08-14.md` — SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`.

Current runtime source уже реализует эту схему через `result-taxonomy.ts` и `LocalKontur.tsx`.

Не генерировать новые Step E concepts как будто этот gate не проходили.

## FORENSIC P0 — не блокирует обычную передачу кода

1. **Exact historical preview provenance `5dabce57`**
   - связать `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev` с immutable Cloudflare version metadata;
   - получить exact frontend asset hashes / Worker module identity;
   - сопоставить с Git source;
   - только после этого использовать формулировку `byte-for-byte equals 5dabce57`.

2. **Exhaustive legacy runtime reachability**
   - пофайлово классифицировать старые V1–V5 runtime modules;
   - удалить доказанно мёртвый код только отдельным controlled diff;
   - до этого хранить его как compatibility/recovery source, не как product authority.

3. **Exact Codex artifact retention**
   - по возможности дособрать H3/B/C/D/E review boards/WebM/assets из Library/Codex lineage в provenance/evidence индекс;
   - отсутствие отдельного декоративного артефакта не должно отменять уже доказанный current runtime source и exact accepted text evidence.

## RELEASE / LIVE CHECK — текущий хвост

Production run `32030041504`:
- rollback evidence сохранён;
- D1 reset + migrations завершены;
- deploy завершён;
- Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1` создан;
- health PASS;
- последний asset smoke получил старое публичное asset generation и поэтому красный результат не является доказательством сломанного source.

Следующее:
- не повторять destructive reset;
- при доступном безопасном механизме выполнить read-only/non-destructive public convergence proof;
- затем human smoke текущего продукта;
- если найден реальный продуктовый дефект — исправлять минимальным diff, а не переоткрывать закрытые A–E.

## Не делать

Не возвращать tree/daily move/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy только потому, что они встречаются в старом runtime/archive.

Не повторять D1 reset или полный production release только ради исправления старого красного smoke.

Не merge PR #11 без отдельного явного разрешения owner.
