import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const distDir = process.env.PROVENANCE_DIST_DIR || 'apps/miniapp/dist';
const outputPath = process.env.PROVENANCE_OUTPUT || '';

const targets = [
  {
    name: 'historical-preview-5dabce57',
    origin: 'https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev',
  },
  {
    name: 'production-current-origin',
    origin: 'https://kontur-igor.igorekglukhovskii43.workers.dev',
  },
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function localFile(relative) {
  const clean = String(relative || '').replace(/^\//, '').split('?')[0].split('#')[0];
  const full = path.join(distDir, clean || 'index.html');
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const bytes = fs.readFileSync(full);
  return { bytes: bytes.length, sha256: sha256(bytes), relative: clean || 'index.html' };
}

function headersOf(response) {
  const out = {};
  for (const name of ['content-type', 'content-length', 'etag', 'last-modified', 'cache-control', 'cf-cache-status', 'cf-ray', 'server']) {
    const value = response.headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

async function fetchBytes(url, attempt = 1) {
  const u = new URL(url);
  u.searchParams.set('kontur_readonly_probe', `${Date.now()}-${attempt}`);
  const response = await fetch(u, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    ok: response.ok,
    finalUrl: response.url,
    headers: headersOf(response),
    bytes,
    size: bytes.length,
    sha256: sha256(bytes),
  };
}

function extractAssets(html) {
  const matches = new Set();
  for (const regex of [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["']/gi,
  ]) {
    let match;
    while ((match = regex.exec(html))) {
      const value = match[1];
      if (/\.(?:js|css)(?:[?#].*)?$/i.test(value)) matches.add(value);
    }
  }
  return [...matches];
}

async function probeResource(origin, relative) {
  const remote = await fetchBytes(new URL(relative, `${origin}/`).href);
  const local = localFile(relative);
  const contentType = String(remote.headers['content-type'] || '').toLowerCase();
  return {
    path: relative,
    status: remote.status,
    finalUrl: remote.finalUrl,
    headers: remote.headers,
    bytes: remote.size,
    sha256: remote.sha256,
    local,
    exactLocalMatch: Boolean(local && local.sha256 === remote.sha256),
    looksLikeWebp: contentType.startsWith('image/webp'),
    looksLikeHtml: contentType.includes('text/html') || remote.bytes.subarray(0, 80).toString('utf8').toLowerCase().includes('<!doctype html'),
  };
}

async function probeTarget(target) {
  const startedAt = new Date().toISOString();
  try {
    const root = await fetchBytes(`${target.origin}/`);
    const html = root.bytes.toString('utf8');
    const localRoot = localFile('index.html');
    const referenced = extractAssets(html);
    const resources = [];
    for (const relative of referenced) {
      resources.push(await probeResource(target.origin, relative));
    }
    for (const relative of ['/quiz/egg-stage-01.webp', '/quiz/egg-stage-08.webp']) {
      resources.push(await probeResource(target.origin, relative));
    }

    let health = null;
    try {
      const remoteHealth = await fetchBytes(`${target.origin}/api/v1/health`);
      const text = remoteHealth.bytes.toString('utf8');
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      health = {
        status: remoteHealth.status,
        headers: remoteHealth.headers,
        bytes: remoteHealth.size,
        sha256: remoteHealth.sha256,
        json: parsed,
      };
    } catch (error) {
      health = { error: error?.message || String(error) };
    }

    const exactReferencedAssetMatches = resources
      .filter((item) => /\.(?:js|css)(?:[?#].*)?$/i.test(item.path))
      .map((item) => ({ path: item.path, exactLocalMatch: item.exactLocalMatch }));

    return {
      name: target.name,
      origin: target.origin,
      startedAt,
      root: {
        status: root.status,
        finalUrl: root.finalUrl,
        headers: root.headers,
        bytes: root.size,
        sha256: root.sha256,
        local: localRoot,
        exactLocalMatch: Boolean(localRoot && localRoot.sha256 === root.sha256),
        referencedAssets: referenced,
      },
      resources,
      health,
      classification: {
        rootExactCurrentDist: Boolean(localRoot && localRoot.sha256 === root.sha256),
        allReferencedJsCssExactCurrentDist: exactReferencedAssetMatches.length > 0 && exactReferencedAssetMatches.every((item) => item.exactLocalMatch),
        egg01ExactCurrentDist: resources.find((item) => item.path.includes('egg-stage-01.webp'))?.exactLocalMatch ?? false,
        egg08ExactCurrentDist: resources.find((item) => item.path.includes('egg-stage-08.webp'))?.exactLocalMatch ?? false,
        egg01IsWebp: resources.find((item) => item.path.includes('egg-stage-01.webp'))?.looksLikeWebp ?? false,
        egg08IsWebp: resources.find((item) => item.path.includes('egg-stage-08.webp'))?.looksLikeWebp ?? false,
      },
    };
  } catch (error) {
    return {
      name: target.name,
      origin: target.origin,
      startedAt,
      error: error?.stack || error?.message || String(error),
    };
  }
}

const result = {
  schema: 'kontur-public-provenance-readonly-v1',
  generatedAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA || null,
  localDist: {
    index: localFile('index.html'),
  },
  targets: [],
};

for (const target of targets) {
  result.targets.push(await probeTarget(target));
}

const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, 'utf8');
}
process.stdout.write(serialized);
console.log('PUBLIC_PROVENANCE_READONLY_COMPLETE');
