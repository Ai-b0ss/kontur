#!/usr/bin/env bash
set -euo pipefail
export CLOUDFLARE_STAGING_WORKER_NAME='kontur-igor-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_NAME='kontur-staging'
export CLOUDFLARE_STAGING_D1_DATABASE_ID='22786b4b-99cc-4ca5-a18b-932e8781021b'
export CLOUDFLARE_STAGING_ORIGIN='https://kontur-igor-staging.igorekglukhovskii43.workers.dev'
export CLOUDFLARE_PROD_D1_DATABASE_NAME='kontur'
export CLOUDFLARE_PROD_D1_DATABASE_ID='91e39e7e-70fc-4551-8d3e-48235e70f985'
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm -F @kontur/miniapp test
pnpm -F @kontur/miniapp build
if command -v chromium >/dev/null 2>&1; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v chromium-browser)"
elif command -v google-chrome >/dev/null 2>&1; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v google-chrome)"\else
  export PLAYWRIGHT_BROWSERS_PATH='/tmp/kontur-playwright-browsers'
  pnpm -F @kontur/miniapp exec playwright install chromium
fi
pnpm -F @kontur/miniapp exec node --input-type=module <<'NODE'
import { chromium } from '@playwright/test';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 760 } });
await page.setContent('<main id="ok">browser</main>');
if (await page.locator('#ok').textContent() !== 'browser') throw new Error('minimal chromium DOM proof failed');
await browser.close();
console.log('KONTUR_MINIMAL_CHROMIUM_PASS');
NODE
pnpm -F @kontur/worker exec wrangler d1 info "$CLOUDFLARE_PROD_D1_DATABASE_NAME" --config wrangler.jsonc --json > /tmp/kontur-prod-d1-info.json
node tools/cloudflare/make-staging-config.mjs
test -s apps/worker/wrangler.staging.generated.jsonc
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('apps/worker/wrangler.staging.generated.jsonc','utf8'));
if(c.name!=='kontur-igor-staging') throw new Error('staging worker mismatch');
const db=c.d1_databases?.find(x=>x?.binding==='DB');
if(!db||db.database_id!=='22786b4b-99cc-4ca5-a18b-932e8781021b') throw new Error('staging d1 mismatch');
console.log('KONTUR_BROWSER_ENV_PROBE_PASS');
NODE