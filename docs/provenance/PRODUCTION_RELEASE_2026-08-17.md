# Kontur production release incident — 2026-08-17

## Verdict

Production release run `32030041504` did **not** fail because the frozen product source lacked `egg-stage-01.webp`.

The destructive part of the run had already completed successfully:

- frozen handoff runtime source check passed against `85290a821bdd1a5ceb170480eccdba4243bea997`;
- full production D1 rollback evidence was captured before reset;
- production D1 was reset and all migrations were applied;
- `wrangler deploy` completed successfully;
- Cloudflare reported deployed Worker Version ID `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`;
- `/api/v1/health` passed with `devMode=false`, driver `d1`, `users=0`, `hatched=0`.

The final approved-egg smoke then read an **older public static-asset generation** from the production origin.

**Do not repeat the destructive production reset merely to retry this post-check.**

## Evidence from failed post-release artifact

GitHub Actions evidence artifact:

- run: `32030041504`;
- artifact: `kontur-production-release-evidence-32030041504`;
- artifact id: `9288622196`;
- downloaded ZIP SHA-256: `f3c9dae40b1e2ba4c19e4eb48b89fb2b2abfc50b6fdc7febd4e80c622aef23da`.

Recovered files:

| File | Bytes | SHA-256 | Meaning |
|---|---:|---|---|
| `prod-root.html` | 958 | `a9a0ba649220304262fe8e155e43ac327b967da8e06444f6046c8c8c901f4a3e` | old public SPA root |
| `prod-egg01.webp` | 958 | `a9a0ba649220304262fe8e155e43ac327b967da8e06444f6046c8c8c901f4a3e` | byte-identical SPA fallback HTML, **not WebP** |
| `prod-egg08.webp` | 216484 | `200c2fafc0a768831add9e3c7cc2b57e1184620de0301c1362432b4b8ddb53a1` | real WebP from older asset generation |

`prod-root.html` referenced:

- `/assets/index-D9R3uSyz.js`;
- `/assets/index-0mq6ukLF.css`.

Therefore `GET /quiz/egg-stage-01.webp` was answered by the Workers Assets SPA fallback and returned exactly the old `index.html` bytes. A non-empty-file check alone could not distinguish that from a real image.

## Independent historical proof that this was the old generation

The read-only Cloudflare live-baseline recovery performed on 2026-08-12 independently captured the then-active public assets for production version `ce484495-63cf-4666-9019-16d9f5af3219` (v76, 100% traffic):

- `index.html` SHA-256 `a9a0ba649220304262fe8e155e43ac327b967da8e06444f6046c8c8c901f4a3e`;
- `assets/index-D9R3uSyz.js` SHA-256 `7eb253090ccd3783de18268685f6e04ed6652166cddea9727e7872aa61f41037`;
- `assets/index-0mq6ukLF.css` SHA-256 `e28ab1f936d663596919bcb01ca3a1161fc3dc37e8de2cf2f5323ba47b644da0`.

The failed 2026-08-17 post-release artifact reproduced that exact old `index.html` SHA and the same two hashed asset names.

This is independent evidence that the smoke hit stale/pre-convergence public asset bytes after the new deploy command had completed.

## Fresh build/deploy identity from the same run

Immediately before deploy, the frozen handoff build produced different hashed assets:

- `assets/index-DO5Hakbi.js`;
- `assets/index-MFXyijbT.css`.

Wrangler reported these as new/modified uploads together with `/index.html` and `/results/crane-character-v4.webp`.

So the sequence was:

1. build new generation (`DO5Hakbi` / `MFXyijbT`);
2. successful Worker/assets deploy;
3. immediate public smoke;
4. public root still returned old generation (`D9R3uSyz` / `0mq6ukLF`);
5. `egg-stage-01.webp` was absent in that old generation and SPA-fell back to the old root;
6. exact hash comparison failed.

Classification: **post-deploy static-asset propagation / stale-generation race**.

## Durable fix

The handoff branch now contains `tools/cloudflare/wait-for-deployed-assets.mjs`.

Release verification must:

1. build local `apps/miniapp/dist`;
2. after deploy, poll the public origin with cache-busting/no-cache requests;
3. require remote `/` bytes to match the **exact SHA-256 of the fresh local `dist/index.html`**;
4. only after exact root convergence fetch `egg-stage-01.webp` and `egg-stage-08.webp`;
5. require `Content-Type: image/webp` so SPA fallback HTML cannot masquerade as an asset;
6. require each remote egg SHA-256 to equal the corresponding local `dist` file SHA-256;
7. only then continue health/product verification.

Regression coverage is in `tools/cloudflare/wait-for-deployed-assets.test.mjs`:

- stale root for two attempts, then fresh root → verifier waits and succeeds;
- fresh root but HTML SPA fallback for egg 01 → verifier fails explicitly.

Both staging and production release workflows use the same convergence gate.

## Safety consequence

The production database was already intentionally reset during run `32030041504`, with rollback evidence captured first. Re-running the whole production release for the sake of the old red asset smoke would perform another unnecessary destructive reset.

The safe next production action, if another live proof is needed, is a **read-only post-deploy verification** or a separately authorized non-destructive release path — not a blind replay of the destructive reset workflow.

This incident document does **not** claim that a later read-only request has already proven global/public convergence. It proves why the original red post-check was invalid as evidence of a broken source/deploy and records the guard required for the next verification.
