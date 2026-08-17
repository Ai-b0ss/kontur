# Контур — актуальный backlog

**Обновлено:** 2026-08-17.  
Старый backlog: `docs/archive/legacy/BACKLOG_PRE_CANONICAL.md`.

## HANDOFF — текущая задача

Цель: одна ссылка/commit с полной рабочей кодовой базой.

Сделано в PR #11:
- current product/TZ/decision log отделены от истории;
- H3/B/C/D path подтверждён в runtime source;
- старые product docs/art/prototypes физически вынесены в `docs/archive/legacy/`;
- происхождение Git-export вынесено в `docs/provenance/`;
- README/HANDOFF приведены в состояние для внешнего разработчика;
- CI работает с clean checkout + frozen install + tests/typecheck/build;
- добавлен fail-closed `Handoff safety gate`;
- `tools/package-handoff.ps1` переведён со старого списка файлов на фактическое `git ls-files` и выдаёт ZIP + SHA-256 manifest с secret-scan;
- CI проверяет и сам share-safe ZIP.

Практический handoff считается готовым после зелёного CI exact handoff commit и фиксации стабильной handoff-ветки/commit.

## FORENSIC P0 — не блокирует обычную передачу кода

1. **Exact preview provenance**
   - связать `https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev` с immutable Cloudflare version metadata;
   - получить exact frontend asset hashes / Worker module identity;
   - сопоставить с Git source;
   - только после этого использовать формулировку `byte-for-byte equals preview`.

2. **Exact primary-source bytes**
   - получить byte-preserving raw object для двух Project-файлов 13.08;
   - записать size + SHA-256;
   - не реконструировать exact artifact из нормализованного текста.

3. **Exhaustive legacy runtime reachability**
   - пофайлово классифицировать старые V1–V5 runtime modules;
   - удалить доказанно мёртвый код только отдельным controlled diff;
   - до этого хранить его как compatibility/recovery source, не как product authority.

## Следующий продуктовый этап

После handoff и отдельного owner go:
- STEP E — Bird Character Direction + 1–2 real UI concepts;
- затем visual/mobile/human smoke;
- дальнейшие механики — только новым owner decision.

## Не делать

Не возвращать tree/daily move/forecasts/raid/Form II/inventory/storm/leaderboard/streak/AI character/passive faucet/duplicate-refund economy только потому, что они встречаются в старом runtime/archive.
