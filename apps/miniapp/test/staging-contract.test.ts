import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('isolated staging proof is non-destructive and verifies the real local API path', async () => {
  const workflow = await readFile(new URL('../../../.github/workflows/kontur-staging-nondestructive.yml', import.meta.url), 'utf8');
  const liveSmoke = await readFile(new URL('../../../tools/cloudflare/live-release-staging-smoke.mjs', import.meta.url), 'utf8');

  assert.match(workflow, /STAGING_WORKER_NAME: kontur-igor-staging/);
  assert.match(workflow, /STAGING_D1_NAME: kontur-staging/);
  assert.match(workflow, /RELEASE_ORIGIN: \$\{\{ env\.STAGING_ORIGIN \}\}/);
  assert.match(workflow, /\/api\/v4\/local\/state/);
  assert.doesNotMatch(workflow, /wrangler d1 (?:execute|migrations apply)/);
  assert.doesNotMatch(workflow, /release\/kontur|STAGING_RESET_PLAN|DELETE FROM|DROP TABLE/i);
  assert.match(workflow, /production_d1_untouched=/);
  assert.match(liveSmoke, /https:\/\/kontur-igor-staging\./);
  assert.match(liveSmoke, /X-Telegram-Bot-Api-Secret-Token/);
  assert.match(liveSmoke, /chat_member/);
  assert.match(liveSmoke, /\/api\/v1\/auth\/telegram/);
  assert.match(liveSmoke, /\/api\/v4\/local\/hatch/);
  assert.match(liveSmoke, /\/api\/v4\/local\/egg\/open/);
  assert.doesNotMatch(liveSmoke, /wrangler|PROD_D1|DELETE FROM|DROP TABLE/i);
});
