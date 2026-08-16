# Контур — full-source integration candidate

Дата: 2026-08-14

## Классификация

`EXACT_V84_WORKER_MODULE_REPRODUCIBLE / FULL_CONTROL_SOURCE_FOUND / DERIVED_FRONTEND_INTEGRATED`

Эта папка собрана в изолированной копии. Оригинальный worktree
`K:\SPO (первый проект)\spo\spo` не изменялся.

## Provenance

- Worker/control source, D1 migrations, contracts and shared core: secret-safe snapshot текущего K: worktree at Git HEAD `a7906b4af7d890e92f016a8ba2412a97dcf5ffda` plus four required untracked runtime source files.
- Frontend: accepted `KONTUR_CLEAN_DERIVED_CANDIDATE_2026-08-14`, overlaid as 31 added files, 4 replaced files and 61 byte-identical files.
- Secrets, `.env`, `*.local`, `.git`, `.wrangler`, `node_modules`, `dist`, backups, private data, raw chats, unpack folders and old archives are excluded.

## Exact Worker proof

Production Wrangler dry-run from this source created `index.js`:

- bytes: `571078`;
- SHA-256: `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- exact match with Cloudflare Worker version 84 module `ab3cce08-12a0-4fa7-879b-9f6bbe838076`.

The frontend assets intentionally differ because this candidate contains the accepted derived product pass. It must not be described as the byte-exact v84 frontend.

## Validation

- `pnpm test`: PASS;
- `pnpm typecheck`: PASS for all workspace projects;
- balance simulation: PASS;
- Mini App production build: PASS;
- synthetic local PGlite migration and D1 transfer: PASS;
- real local Worker+D1 browser smoke at 430x1000, 320x568 and reduced motion: PASS;
- community branch: PASS;
- browser console warnings/errors: 0;
- broken images: 0;
- horizontal overflow: 0.

## Safety boundary

No Cloudflare version was created. No deploy, traffic switch, production D1 or Telegram write, secret change, route/trigger mutation, or Git push was performed.

The next gate is a separately authorized preview-version review. Before any upload, re-check the upload manifest, bindings, active deployment, generated asset set, and all preview conditions.
