import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('isolated staging proof is non-destructive and verifies the real local API path', async () => {
  const workflow = await readFile(new URL('../../../.github/workflows/kontur-staging-nondestructive.yml', import.meta.url), 'utf8');

  assert.match(workflow, /STAGING_WORKER_NAME: kontur-igor-staging/);
  assert.match(workflow, /STAGING_D1_NAME: kontur-staging/);
  assert.match(workflow, /RELEASE_ORIGIN: \$\{\{ env\.STAGING_ORIGIN \}\}/);
  assert.match(workflow, /\/api\/v4\/local\/state/);
  assert.doesNotMatch(workflow, /wrangler d1 (?:execute|migrations apply)/);
  assert.doesNotMatch(workflow, /release\/kontur|STAGING_RESET_PLAN|DELETE FROM|DROP TABLE/i);
  assert.match(workflow, /production_d1_untouched=/);
});
