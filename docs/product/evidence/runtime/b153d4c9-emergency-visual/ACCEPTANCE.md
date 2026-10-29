# KONTUR emergency visual acceptance — 2026-08-22

- Exact product head: `b153d4c96a775484c0cfc3b454029f9e4dadaf75`
- PR: `Ai-b0ss/kontur#12` (`draft`, open, unmerged)
- Browser: real Chromium / Playwright 1.55.0
- Production, `main`, D1, Telegram, backend/API/scoring: not changed

## Result

Local exact-head acceptance is `PASS`.

- Mini App tests: PASS
- repository TypeScript: PASS
- production Vite build: PASS
- Chromium acceptance: PASS, 28 canonical artifacts, zero console/runtime errors
- viewports: `320x568`, `390x844`, `430x1000`
- reduced motion: PASS
- minimum measured question-to-ring gaps: q1 `16.1109px`, q4/q8 `17.15625px`, large q8 `16.828125px`
- safe-area and horizontal overflow checks: PASS
- real magpie plumage assets: 3 distinct assets / 3 distinct renders

## Frame review

`motion-3-q8-to-reveal.webm` and `hatch-frame-sheet.png` were reviewed frame by frame.

- intact q8 egg remains mounted through the response gate;
- crack/light appears before opening;
- two coherent shell halves open gradually and stay clipped inside the cyan ring;
- no third or bottom shell fragment;
- no pre-hatch Home/bird flash;
- no isolated or premature tail;
- the complete bird fades in as one layer before the shell handoff completes;
- no visually empty egg;
- final bird pose remains continuous into reveal.

## Remote checks

- GitHub-hosted `remote verification`, `chromium`, and `staging-proof` jobs did not start successfully because of the repository account billing/spending-limit failure already observed on this lane; they are not treated as product failures.
- Cloudflare Workers Builds staging check for the exact product head: PASS.
- CircleCI technical branch `ci/kontur-circle-vite-20260821` at `60e1dbd17fff76af220ee0dae7dc6b960f7ef775`: PASS.
- No CircleCI status exists for exact product head `b153d4c9`; the technical-branch PASS is not represented as exact-head proof.

## Control limitation

The current GitHub integration returns `403 Resource not accessible by integration` for issue `#9`, so the exact-head result could not be posted to the control issue from this session.
