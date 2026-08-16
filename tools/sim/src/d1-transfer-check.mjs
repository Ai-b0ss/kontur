import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const workerDir = join(root, 'apps', 'worker');
const wrangler = createRequire(join(workerDir, 'package.json')).resolve('wrangler');
const pnpm = process.env.npm_execpath;
const temp = await mkdtemp(join(tmpdir(), 'kontur-transfer-check-'));
const sqlFile = join(temp, 'transfer.sql');

if (!pnpm) throw new Error('Run through pnpm cf:test-transfer');

function run(args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolveRun(output)
      : reject(new Error(`Command failed (${code}):\n${output.slice(-4_000)}`)));
  });
}

try {
  const exportOutput = await run([pnpm, '-F', '@kontur/db', 'export:d1', '--', '--out', sqlFile]);
  const sourceMatch = /\{"users":\d+,"profiles":\d+\}/.exec(exportOutput);
  if (!sourceMatch) throw new Error('Exporter did not return its anonymized summary');
  const source = JSON.parse(sourceMatch[0]);

  await run([wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', temp], workerDir);
  await run([wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', temp, '--file', sqlFile], workerDir);
  const resultText = await run([
    wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', temp,
    '--command', 'SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM profiles WHERE hatched_at IS NOT NULL) hatched, (SELECT count(*) FROM worm_grants) grants, (SELECT count(*) FROM egg_pulls) pulls',
    '--json',
  ], workerDir);
  const jsonMatch = /(\[\s*\{\s*"results"[\s\S]*\}\s*\])/.exec(resultText);
  if (!jsonMatch) throw new Error('Wrangler did not return a D1 JSON result');
  const result = JSON.parse(jsonMatch[1])[0].results[0];
  if (Number(result.users) !== source.users || Number(result.hatched) !== source.profiles) {
    throw new Error(`Transfer mismatch: source ${JSON.stringify(source)}, D1 ${JSON.stringify(result)}`);
  }
  console.log(`  ✔ перенос сохраняет пользователей (${source.users}) и вылупившихся птиц (${source.profiles})`);
  console.log(`  ✔ история перенесена: /worm ${result.grants}, яйца ${result.pulls}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
