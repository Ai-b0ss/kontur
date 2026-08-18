import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { waitForDeployedAssets } from './wait-for-deployed-assets.mjs';

function makeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kontur-release-assets-'));
  fs.mkdirSync(path.join(dir, 'quiz'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root">fresh</div>');
  fs.writeFileSync(path.join(dir, 'quiz/egg-stage-01.webp'), Buffer.from('RIFF-fresh-egg-01'));
  fs.writeFileSync(path.join(dir, 'quiz/egg-stage-08.webp'), Buffer.from('RIFF-fresh-egg-08'));
  return dir;
}

function webpResponse(bytes) {
  return new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } });
}

test('waits through stale root before accepting exact new generation', async () => {
  const distDir = makeDist();
  let rootAttempts = 0;
  const freshRoot = fs.readFileSync(path.join(distDir, 'index.html'));
  const egg01 = fs.readFileSync(path.join(distDir, 'quiz/egg-stage-01.webp'));
  const egg08 = fs.readFileSync(path.join(distDir, 'quiz/egg-stage-08.webp'));

  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/') {
      rootAttempts += 1;
      return new Response(rootAttempts < 3 ? '<!doctype html><div id="root">stale</div>' : freshRoot, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    if (pathname.endsWith('egg-stage-01.webp')) return webpResponse(egg01);
    if (pathname.endsWith('egg-stage-08.webp')) return webpResponse(egg08);
    return new Response('not found', { status: 404 });
  };

  const result = await waitForDeployedAssets({
    origin: 'https://kontur.example.test',
    distDir,
    timeoutMs: 1_000,
    intervalMs: 1,
    fetchImpl,
  });
  assert.equal(rootAttempts, 3);
  assert.equal(result.attempts, 3);
});

test('rejects SPA fallback masquerading as an egg asset', async () => {
  const distDir = makeDist();
  const freshRoot = fs.readFileSync(path.join(distDir, 'index.html'));
  const egg08 = fs.readFileSync(path.join(distDir, 'quiz/egg-stage-08.webp'));

  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/') return new Response(freshRoot, { status: 200, headers: { 'content-type': 'text/html' } });
    if (pathname.endsWith('egg-stage-01.webp')) {
      return new Response(freshRoot, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } });
    }
    if (pathname.endsWith('egg-stage-08.webp')) return webpResponse(egg08);
    return new Response('not found', { status: 404 });
  };

  await assert.rejects(
    waitForDeployedAssets({
      origin: 'https://kontur.example.test',
      distDir,
      timeoutMs: 1_000,
      intervalMs: 1,
      fetchImpl,
    }),
    /SPA fallback\/stale asset generation suspected/,
  );
});
