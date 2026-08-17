import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const guard = path.join(root, 'tools/cloudflare/refuse-direct-production-deploy.mjs');

test('direct production deploy guard refuses before any deploy tool can run', () => {
  const run = spawnSync(process.execPath, [guard], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: 'must-not-be-used',
      CLOUDFLARE_ACCOUNT_ID: 'must-not-be-used',
    },
  });

  assert.equal(run.status, 78);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /DIRECT_PRODUCTION_DEPLOY_DISABLED/);
  assert.match(run.stderr, /guarded production release workflow/);
  assert.match(run.stderr, /No Cloudflare request was made by this guard/);
  assert.doesNotMatch(run.stderr, /wrangler deploy --/);
});
