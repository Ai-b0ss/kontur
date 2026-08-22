# CircleCI final-evidence policy — Qwen + Notion

User authorization: CircleCI may now be used, but only as a bounded evidence resource.

## Global rules
1. Local/hosted ChatGPT checks come first. CircleCI is not a per-commit development loop.
2. Never trigger CircleCI from the normal product branches merely to see whether tests pass.
3. Use disposable evidence branches only. Force-moving a ref is allowed ONLY for the three `ci/*-final-gate` branches below; never force-write a product/control branch.
4. One gate trigger must correspond to one exact product SHA and one unresolved acceptance claim.
5. No production deploy, no secret printing, no live provider/Notion/Qwen traffic inside offline gates.
6. Save exact SHA + logs/artifacts/result into the owning handoff/evidence after a run.
7. Do not repeat a green gate unless product bytes relevant to that gate changed or a new regression requires it.
8. Integration helper may read/review gate evidence but must not race the owning worker by triggering the same gate.

## Qwen
Gate branch: `Ai-b0ss/qwen-free-api:ci/qwen-final-gate`.
Purpose: exact locked dependency install + full offline `npm test` on one final Qwen head.
Current first gate was created from product SHA `23891cbc845996726ba5e0477c8542ff8361cf4d` and Circle config commit `bd6c7bc0ac31dc91fe95c3e7151be99ad6c10fa4`.
For a later run: fresh-read PR #6 head; only after targeted local PASS, move `ci/qwen-final-gate` to that exact product SHA; then re-apply the isolated Qwen gate `.circleci/config.yml` as the sole gate-branch commit. The first ref move should not run the old product workflow because its branch filter excludes the gate branch; the config commit is the intended single trigger.
QWEN_CORE and QWEN_RELIABILITY coordinate through their handoffs; do not both trigger for the same SHA.

## Notion Agent
Gate branch: `Ai-b0ss/notion-agent-bridge:ci/notion-agent-final-gate`.
Purpose: (a) exact Agent Linux safety cluster and (b) separate materialized `server.py + account_pool.py` rehearsal in an ephemeral checkout.
Current first gate was created from Agent SHA `f58f0123b370ad786d337337eb03a6a4ce9963b3` and Circle config commit `2e3a0b8c98aefde755d2583bdb923177828a92e9`.
For later runs use the same two-step ref-move + isolated-config-commit procedure only after local cluster/materializer preflight is green.

## Notion Core / native Windows
Prepared gate branch: `Ai-b0ss/notion-agent-bridge:ci/notion-core-windows-final-gate`, initially based on Core SHA `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
Do NOT trigger it merely because Windows is available. The expensive native Windows gate is allowed only after the current Core Stage-A compatibility floor and the intended Stage-B durable-state candidate are locally green enough that native Windows semantics are the remaining proof.
The historical digest workflow must not be restarted as a substitute for the final gate. When ready, move the gate branch to the exact Core candidate SHA, then make one gate-only `.circleci/config.yml` commit whose Windows jobs filter only `ci/notion-core-windows-final-gate`.

## Reading results
Prefer CircleCI status/check evidence attached to the exact gate commit. If direct Circle result/log access is unavailable in the current tool surface, do not guess PASS: record `RESULT_ACCESS_UNAVAILABLE`, preserve the exact gate SHA, and continue only with evidence actually readable from GitHub/artifacts or a later connected Circle surface.
