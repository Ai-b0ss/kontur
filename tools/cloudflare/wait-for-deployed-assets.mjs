import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheBust(pathname, attempt) {
  const sep = pathname.includes('?') ? '&' : '?';
  return `${pathname}${sep}kontur_release_probe=${Date.now()}-${attempt}`;
}

async function fetchBytes(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes };
}

export async function waitForDeployedAssets({
  origin,
  distDir = 'apps/miniapp/dist',
  timeoutMs = 180_000,
  intervalMs = 3_000,
  fetchImpl = globalThis.fetch,
  evidenceDir = '',
  evidencePrefix = 'remote',
} = {}) {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(cleanOrigin)) throw new Error('release origin must be an absolute http(s) URL');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  const localRoot = fs.readFileSync(path.join(distDir, 'index.html'));
  const localRootSha = sha256(localRoot);
  const deadline = Date.now() + Number(timeoutMs);
  let attempt = 0;
  let remoteRoot = null;
  let remoteRootSha = '';

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const result = await fetchBytes(fetchImpl, cacheBust(`${cleanOrigin}/`, attempt));
      remoteRoot = result.bytes;
      remoteRootSha = sha256(remoteRoot);
      if (result.response.ok && remoteRootSha === localRootSha) break;
      console.log(`DEPLOY_PROPAGATION_WAIT attempt=${attempt} status=${result.response.status} local=${localRootSha} remote=${remoteRootSha}`);
    } catch (error) {
      console.log(`DEPLOY_PROPAGATION_WAIT attempt=${attempt} error=${error?.message || error}`);
    }
    await sleep(intervalMs);
  }

  if (!remoteRoot || remoteRootSha !== localRootSha) {
    throw new Error(`deployed root did not converge to local dist within ${timeoutMs}ms: local=${localRootSha} remote=${remoteRootSha || 'unavailable'}`);
  }

  const checked = {};
  for (const stage of ['01', '08']) {
    const relative = `quiz/egg-stage-${stage}.webp`;
    const local = fs.readFileSync(path.join(distDir, relative));
    const expectedSha = sha256(local);
    const { response, bytes } = await fetchBytes(fetchImpl, cacheBust(`${cleanOrigin}/${relative}`, attempt));
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const actualSha = sha256(bytes);
    if (!response.ok) throw new Error(`${relative} returned HTTP ${response.status}`);
    if (!contentType.startsWith('image/webp')) {
      throw new Error(`${relative} returned non-WebP content-type ${contentType || '<missing>'}; SPA fallback/stale asset generation suspected`);
    }
    if (actualSha !== expectedSha) {
      throw new Error(`${relative} SHA mismatch expected=${expectedSha} actual=${actualSha}`);
    }
    checked[stage] = { bytes, sha256: actualSha, contentType };
  }

  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, `${evidencePrefix}-root.html`), remoteRoot);
    fs.writeFileSync(path.join(evidenceDir, `${evidencePrefix}-egg01.webp`), checked['01'].bytes);
    fs.writeFileSync(path.join(evidenceDir, `${evidencePrefix}-egg08.webp`), checked['08'].bytes);
  }

  const result = {
    attempts: attempt,
    rootSha256: remoteRootSha,
    egg01Sha256: checked['01'].sha256,
    egg08Sha256: checked['08'].sha256,
  };
  console.log(`DEPLOYED_ASSET_GENERATION_EXACT_PASS ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  await waitForDeployedAssets({
    origin: process.env.RELEASE_ORIGIN,
    distDir: process.env.RELEASE_DIST_DIR || 'apps/miniapp/dist',
    timeoutMs: Number(process.env.RELEASE_PROPAGATION_TIMEOUT_MS || 180_000),
    intervalMs: Number(process.env.RELEASE_PROPAGATION_INTERVAL_MS || 3_000),
    evidenceDir: process.env.RELEASE_EVIDENCE_DIR || '',
    evidencePrefix: process.env.RELEASE_EVIDENCE_PREFIX || 'remote',
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`DEPLOYED_ASSET_GENERATION_FAIL: ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
