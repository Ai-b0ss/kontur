import fs from 'node:fs';
import path from 'node:path';

const PROD_WORKER_NAME = 'kontur-igor';
const PROD_DB_NAME = 'kontur';
const PROD_DB_ID = '91e39e7e-70fc-4551-8d3e-48235e70f985';
const STAGING_WORKER_NAME = process.env.CLOUDFLARE_STAGING_WORKER_NAME || 'kontur-igor-staging';
const STAGING_DB_NAME = process.env.CLOUDFLARE_STAGING_D1_DATABASE_NAME || 'kontur-staging';
const STAGING_DB_ID = String(process.env.CLOUDFLARE_STAGING_D1_DATABASE_ID || '').trim();

const sourcePath = process.argv[2] || 'apps/worker/wrangler.jsonc';
const outputPath = process.argv[3] || 'apps/worker/wrangler.staging.generated.jsonc';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) {
  console.error(`STAGING_CONFIG_FAIL: ${message}`);
  process.exit(1);
}

if (!STAGING_DB_ID) fail('CLOUDFLARE_STAGING_D1_DATABASE_ID is required');
if (!uuid.test(STAGING_DB_ID)) fail('staging D1 database id is not a UUID');
if (STAGING_DB_ID === PROD_DB_ID) fail('staging D1 id equals production D1 id');
if (STAGING_WORKER_NAME === PROD_WORKER_NAME) fail('staging Worker name equals production Worker name');
if (STAGING_DB_NAME === PROD_DB_NAME) fail('staging D1 name equals production D1 name');

let raw = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
let config;
try {
  config = JSON.parse(raw);
} catch (error) {
  fail(`source Wrangler config is not strict JSON after BOM removal: ${error.message}`);
}

if (config.name !== PROD_WORKER_NAME) fail(`unexpected production Worker name: ${config.name}`);
const prodDb = Array.isArray(config.d1_databases)
  ? config.d1_databases.find((entry) => entry?.binding === 'DB')
  : null;
if (!prodDb) fail('production DB binding not found');
if (prodDb.database_name !== PROD_DB_NAME) fail(`unexpected production D1 name: ${prodDb.database_name}`);
if (prodDb.database_id !== PROD_DB_ID) fail(`unexpected production D1 id: ${prodDb.database_id}`);

const staging = structuredClone(config);
staging.name = STAGING_WORKER_NAME;
staging.workers_dev = true;
delete staging.route;
delete staging.routes;
delete staging.triggers;

staging.d1_databases = staging.d1_databases.map((entry) => {
  if (entry?.binding !== 'DB') return entry;
  return {
    ...entry,
    database_name: STAGING_DB_NAME,
    database_id: STAGING_DB_ID,
    preview_database_id: STAGING_DB_ID,
  };
});

staging.vars = {
  ...(staging.vars || {}),
  DEV_MODE: 'false',
  LIVE_CAMPAIGN_V5_ENABLED: 'false',
  LIVE_CAMPAIGN_V5_PUBLISH_ENABLED: 'false',
  V5_LLM_PROVIDER: 'disabled',
};

const stageDb = staging.d1_databases.find((entry) => entry?.binding === 'DB');
if (staging.name !== STAGING_WORKER_NAME) fail('generated Worker name mismatch');
if (!stageDb || stageDb.database_name !== STAGING_DB_NAME || stageDb.database_id !== STAGING_DB_ID) {
  fail('generated D1 binding mismatch');
}
if ('triggers' in staging) fail('staging config must not contain cron triggers');
if ('route' in staging || 'routes' in staging) fail('staging config must not contain production/custom routes');
if (staging.vars?.LIVE_CAMPAIGN_V5_ENABLED !== 'false') fail('live campaign must stay disabled');
if (staging.vars?.LIVE_CAMPAIGN_V5_PUBLISH_ENABLED !== 'false') fail('live campaign publish must stay disabled');
if (staging.vars?.V5_LLM_PROVIDER !== 'disabled') fail('LLM provider must stay disabled');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(staging, null, 2)}\n`, 'utf8');
console.log(`STAGING_CONFIG_PASS: ${STAGING_WORKER_NAME} -> ${STAGING_DB_NAME}`);
