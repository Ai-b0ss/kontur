import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const output = 'apps/worker/wrangler.staging.generated.jsonc';
const fakeId = '00000000-0000-4000-8000-000000000001';
const prodId = '91e39e7e-70fc-4551-8d3e-48235e70f985';
const stageOrigin = 'https://kontur-igor-staging.igorekglukhovskii43.workers.dev';

try {
  const result = spawnSync(process.execPath, ['tools/cloudflare/make-staging-config.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLOUDFLARE_STAGING_D1_DATABASE_ID: fakeId,
      CLOUDFLARE_STAGING_D1_DATABASE_NAME: 'kontur-staging',
      CLOUDFLARE_STAGING_WORKER_NAME: 'kontur-igor-staging',
      STAGING_ORIGIN: stageOrigin,
    },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }

  const cfg = JSON.parse(fs.readFileSync(output, 'utf8'));
  const db = cfg.d1_databases?.find((entry) => entry?.binding === 'DB');
  const failures = [];
  if (cfg.name !== 'kontur-igor-staging') failures.push('wrong staging Worker name');
  if (cfg.name === 'kontur-igor') failures.push('production Worker selected');
  if (!db || db.database_name !== 'kontur-staging') failures.push('wrong staging D1 name');
  if (!db || db.database_id !== fakeId) failures.push('wrong staging D1 id');
  if (db?.database_id === prodId) failures.push('production D1 selected');
  if ('triggers' in cfg) failures.push('cron triggers leaked into staging');
  if ('route' in cfg || 'routes' in cfg) failures.push('routes leaked into staging');
  if (cfg.vars?.DEV_MODE !== 'false') failures.push('DEV_MODE exposed');
  if (cfg.vars?.MINIAPP_URL !== stageOrigin) failures.push('wrong staging MINIAPP_URL');
  if (cfg.vars?.V5_MINIAPP_URL !== stageOrigin) failures.push('wrong staging V5_MINIAPP_URL');
  if (!String(cfg.vars?.BOT_TOKEN || '').startsWith('staging-disabled-')) failures.push('non-inert staging BOT_TOKEN');
  if (!String(cfg.vars?.JWT_SECRET || '').startsWith('staging-')) failures.push('staging JWT secret missing');
  if (!String(cfg.vars?.WEBHOOK_SECRET || '').startsWith('staging-')) failures.push('staging webhook secret missing');
  if (!String(cfg.vars?.ADMIN_SECRET || '').startsWith('staging-')) failures.push('staging admin secret missing');
  if (cfg.vars?.EXPERIENCE_V2_ENABLED !== 'false') failures.push('V2 enabled');
  if (cfg.vars?.EXPERIENCE_V3_ENABLED !== 'false') failures.push('V3 enabled');
  if (cfg.vars?.ZERO_SEASON_ENABLED !== 'false') failures.push('zero season enabled');
  if (cfg.vars?.LIVE_CAMPAIGN_V5_ENABLED !== 'false') failures.push('live campaign enabled');
  if (cfg.vars?.LIVE_CAMPAIGN_V5_PUBLISH_ENABLED !== 'false') failures.push('live publish enabled');
  if (cfg.vars?.V5_LLM_PROVIDER !== 'disabled') failures.push('LLM provider enabled');

  if (failures.length) {
    console.error(`STAGING_SAFETY_FAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('STAGING_SAFETY_PASS: generated config cannot target current production Worker/D1 and external-effect gates stay disabled');
} finally {
  try { fs.unlinkSync(output); } catch {}
}
