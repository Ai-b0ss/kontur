# KONTUR clean derived frontend candidate

Classification: `CLEAN_DERIVED_FRONTEND_CANDIDATE`  
Date: 2026-08-14

This archive is not byte-exact v84 source and must not be described as v84.

Allowed provenance chain:

1. proven frontend snapshot `13_PROVEN_FRONTEND_SNAPSHOT.zip`;
2. support-only overlay `14_FRONTEND_SUPPORT_PACKAGE.zip`;
3. exact Night Build candidate files from `15_NIGHT_BUILD_PATCH.zip`;
4. approved hook/egg/hatch/result assets and taxonomy from `12_APPROVED_INTEGRATION_ARTIFACTS.zip`;
5. the scoped frontend integration recorded in `INTEGRATION_SOURCE.patch` and `FILE_PROVENANCE_MANIFEST.json` in the parent result bundle.

The package contains no Worker source, D1 migration, Telegram write, secrets, routes, deployment configuration, `node_modules`, or build output.

Validated commands in the assembled workspace:

```text
pnpm test
pnpm typecheck
pnpm build
```

The lockfile in this archive was restored byte-for-byte after installation and has SHA-256 `ad50d022d118e503a5640c7a6444188ebe6152732eeac0310fe26451b948c33d`.

Do not upload this candidate to Cloudflare without separately proving the complete Worker/control source and all ten preview-upload gates.
