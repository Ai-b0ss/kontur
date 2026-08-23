console.error(`DIRECT_PRODUCTION_DEPLOY_DISABLED

The repository-level \`pnpm cf:deploy\` / worker \`pnpm deploy\` path is intentionally disabled.
It bypasses the guarded production release workflow, rollback capture, exact D1 identity checks,
current-product runtime vars, and post-deploy asset convergence proof.

Use the reviewed GitHub release workflow only after explicit owner authorization:
  .github/workflows/release-production.yml

For staging, use the isolated staging workflow:
  .github/workflows/release-staging.yml

No Cloudflare request was made by this guard.`);
process.exit(78);
