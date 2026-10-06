# Repository inventory — kontur

Kontur product repository: Telegram Mini App, worker/backend, domain core, research, design and deployment history.

This is a structural snapshot for orientation, not a substitute for exact-ref inspection. For current truth resolve `main` at read time; for another ref use the tools below.

## Canonical navigation

1. `AGENTS.md`
2. `docs/AGENT_OPERATING_SYSTEM.md`
3. `docs/AGENT_NAVIGATION.md`
4. `.agent/branch-index.json`
5. `.agent/file-index.json`

## Current main snapshot

Tracked blob files currently visible on `main`: **293**.
Known named branches in the committed branch catalog: **103**.

### Top-level areas by stored bytes

| Area | Files | Bytes |
|---|---:|---:|
| `art-direction` | 5 | 11,214,425 |
| `docs` | 11 | 9,971,424 |
| `apps` | 139 | 3,406,821 |
| `stage5-prototype` | 6 | 2,433,456 |
| `packages` | 48 | 231,355 |
| `tools` | 28 | 214,051 |
| `WORKLOG.md` | 1 | 124,987 |
| `pnpm-lock.yaml` | 1 | 94,832 |
| `.agent` | 3 | 69,388 |
| `IMPLEMENTATION_PLAN_V1.md` | 1 | 38,023 |
| `kontur-brief.html` | 1 | 33,020 |
| `EXPERIENCE_SPEC_V1.md` | 1 | 27,674 |
| `SHA256SUMS.txt` | 1 | 26,919 |
| `AI_PROJECT_NAVIGATOR.md` | 1 | 23,858 |
| `PRODUCT_DIRECTION_V1.md` | 1 | 23,313 |
| `PRODUCT_REDESIGN_BRIEF.md` | 1 | 22,316 |
| `README.md` | 1 | 21,835 |
| `COMMUNITY_RESEARCH_STAGE1_INTERIM.md` | 1 | 21,758 |
| `V5_PRODUCT_SPEC.md` | 1 | 20,209 |
| `DESIGN.md` | 1 | 20,144 |
| `ART_DIRECTION_V1.md` | 1 | 19,080 |
| `COMMUNITY_RESEARCH_DEEP_DIVE_V1.md` | 1 | 18,306 |
| `PROJECT_STATE.yaml` | 1 | 14,279 |
| `HANDOVER.md` | 1 | 13,896 |
| `BACKLOG.md` | 1 | 12,717 |
| `RESEARCH_SCOPE_V1.md` | 1 | 12,442 |
| `PROJECT_PASSPORT.md` | 1 | 12,364 |
| `CURSOR_HANDOFF_2026-08-07.md` | 1 | 10,414 |
| `STAGE5_PROTOTYPE_V1.md` | 1 | 10,398 |
| `.github` | 5 | 10,310 |
| `V5_EXECUTION_CHARTER.md` | 1 | 9,602 |
| `STAGE1_INTERVIEW_EXECUTION.md` | 1 | 8,810 |
| `STAGE6_PREVIEW_TRIAL_V1.md` | 1 | 7,213 |
| `COMMUNITY_INTERVIEW_GUIDE_V1.md` | 1 | 7,049 |
| `RESTORED_PRODUCT_V3.md` | 1 | 6,280 |
| `STAGE7_CLOSED_ROLLOUT_V1.md` | 1 | 6,231 |
| `AGENTS.md` | 1 | 5,620 |
| `CHAT_RESEARCH_PROTOCOL.md` | 1 | 5,037 |
| `STAGE1_MINIMAL_VALIDATION.md` | 1 | 3,156 |
| `INTEGRATION_README_2026-08-14.md` | 1 | 2,147 |
| `.env.example` | 1 | 1,563 |
| `package.json` | 1 | 1,357 |
| `DERIVED_CANDIDATE_README.md` | 1 | 1,192 |
| `SNAPSHOT_INFO.txt` | 1 | 933 |
| `RESTORE_RUNTIME_STATE.ps1` | 1 | 906 |
| `CLAUDE.md` | 1 | 703 |
| `.cursor` | 1 | 658 |
| `pnpm-workspace.yaml` | 1 | 624 |
| `GEMINI.md` | 1 | 588 |
| `.gitignore` | 1 | 540 |
| `RESTORE_RUNTIME_STATE.sh` | 1 | 456 |
| `NEXT_CHAT_PROMPT.md` | 1 | 419 |
| `.env.telegram-test.example` | 1 | 398 |
| `SOURCE_PROVENANCE_LOCAL.json` | 1 | 335 |
| `.runtime-state` | 1 | 129 |
| `.gitattributes` | 1 | 57 |

### File roles

| Role | Files |
|---|---:|
| `miniapp_runtime` | 71 |
| `project_file` | 66 |
| `worker_runtime` | 45 |
| `documentation_or_state` | 35 |
| `tooling_or_test` | 26 |
| `prototype_or_design_evidence` | 18 |
| `domain_core` | 16 |
| `agent_tooling` | 12 |
| `ci` | 4 |

### Largest tracked files

Large files are not automatically bad; this table tells an agent where blind full-file reading is likely wasteful.

| File | Bytes | Role |
|---|---:|---|
| `art-direction/direction-c-visible-trace.png` | 3,021,167 | `prototype_or_design_evidence` |
| `art-direction/direction-a-living-nest.png` | 2,817,134 | `prototype_or_design_evidence` |
| `docs/direction-candidates-2026-08-07/B-flock-rally.png` | 2,717,515 | `prototype_or_design_evidence` |
| `art-direction/direction-b-restored-birds-v3.png` | 2,715,648 | `prototype_or_design_evidence` |
| `art-direction/direction-b-signal-map.png` | 2,652,420 | `prototype_or_design_evidence` |
| `docs/direction-candidates-2026-08-07/A-crown-storm.png` | 2,525,580 | `prototype_or_design_evidence` |
| `docs/direction-candidates-2026-08-07/C-branch-table.png` | 2,489,294 | `prototype_or_design_evidence` |
| `stage5-prototype/assets/refined-bird-concept.png` | 2,403,887 | `prototype_or_design_evidence` |
| `docs/direction-candidates-2026-08-07/AB-solo-first-flock-optional.png` | 2,184,101 | `prototype_or_design_evidence` |
| `apps/miniapp/public/results/jay.webp` | 248,776 | `miniapp_runtime` |
| `apps/miniapp/public/results/kotosov.webp` | 244,390 | `miniapp_runtime` |
| `apps/miniapp/public/quiz/egg-stage-08.webp` | 216,484 | `miniapp_runtime` |
| `apps/miniapp/public/quiz/egg-stage-07.webp` | 208,572 | `miniapp_runtime` |
| `apps/miniapp/public/quiz/egg-stage-06.webp` | 194,194 | `miniapp_runtime` |
| `apps/miniapp/public/quiz/egg-stage-05.webp` | 174,626 | `miniapp_runtime` |

## Branch families

Branch prefixes are navigational hints, not authority. Exact names and non-main head SHAs are in `.agent/branch-index.json`.

| Family | Branches |
|---|---:|
| `evidence` | 45 |
| `ci` | 13 |
| `infra` | 11 |
| `cursor` | 7 |
| `ops` | 5 |
| `autonomy` | 4 |
| `fix` | 4 |
| `release` | 3 |
| `autopilot` | 2 |
| `agent` | 1 |
| `cleanup` | 1 |
| `diagnostics` | 1 |
| `handoff` | 1 |
| `main` | 1 |
| `test` | 1 |
| `worker-c` | 1 |
| `worker-d` | 1 |
| `yt-video-rescue-20260818` | 1 |

## How to reach all work

Current branch tips:
```bash
python tools/agent_history.py branches
python tools/agent_history.py find-text "term"
python tools/agent_history.py find-path "**/name*"
```

Deleted/older committed work:
```bash
python tools/agent_history.py find-history-text "term"
python tools/agent_history.py find-history-path "**/name*"
```

Candidate branch context:
```bash
python tools/agent_history.py branch-info "<branch>"
```

Exact file/symbol/line index for any ref:
```bash
python tools/build_agent_index.py --ref "<branch-or-SHA>"
```

## Interpretation rule

Do not treat this inventory, a branch name, or a README statement as proof of runtime behavior. Trace the exact ref through code, tests, state/configuration and relevant evidence. When old work is found, determine why it diverged or disappeared before reusing it.
