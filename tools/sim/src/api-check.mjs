import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(
  require.resolve('tsx', { paths: [join(root, 'apps', 'api')] }),
).href;
const temp = await mkdtemp(join(tmpdir(), 'kontur-api-check-'));
const port = 18_000 + Math.floor(Math.random() * 1_000);
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  BOT_TOKEN: '',
  MAIN_CHAT_ID: '',
  DATABASE_URL: '',
  JWT_SECRET: 'api-check-local-only',
  KONTUR_ENV_FILE: join(temp, 'absent.env'),
  PGLITE_DIR: join(temp, 'pg'),
  KONTUR_DEV_RATE_LIMIT: '1000',
};

const output = [];
const api = spawn(process.execPath, ['--import', tsxLoader, 'apps/api/src/index.ts'], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
api.stdout.on('data', (chunk) => output.push(chunk.toString()));
api.stderr.on('data', (chunk) => output.push(chunk.toString()));

let check;
try {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) break;
    try {
      const response = await fetch(`${base}/api/v1/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await delay(150);
    }
  }
  if (!ready) throw new Error('API не поднялся:\n' + output.join('').slice(-4_000));

  check = spawn(process.execPath, [join(here, 'check.mjs')], {
    cwd: root,
    env: { ...env, KONTUR_API_BASE: `${base}/api/v1` },
    stdio: 'inherit',
  });
  const code = await new Promise((resolveCode, reject) => {
    check.once('error', reject);
    check.once('exit', (value) => resolveCode(value ?? 1));
  });
  if (code !== 0) throw new Error(`API flow завершился с кодом ${code}`);
} finally {
  if (check && check.exitCode === null) check.kill('SIGTERM');
  if (api.exitCode === null) {
    api.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveExit) => api.once('exit', resolveExit)),
      delay(5_000),
    ]);
    if (api.exitCode === null) api.kill('SIGKILL');
  }
  await rm(temp, { recursive: true, force: true });
}
