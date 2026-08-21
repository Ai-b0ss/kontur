#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let workspace = null;

function initWorkspace(dir) {
  workspace = dir;
  fs.mkdirSync(workspace, { recursive: true });
  return workspace;
}

function getWorkspace() {
  if (!workspace) throw new Error('workspace not initialized');
  return workspace;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function resolveInsideWorkspace(rel) {
  const root = path.resolve(getWorkspace());
  const target = path.resolve(root, String(rel || ''));
  if (!isInside(root, target)) throw new Error('escape');
  return target;
}

async function writeFile(args) {
  const file = resolveInsideWorkspace(args.path);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(args.content ?? ''), 'utf8');
  return file;
}

async function reproduceGlobalWorkspaceRace(base) {
  const a = path.join(base, 'project-a');
  const b = path.join(base, 'project-b');
  initWorkspace(a);

  // Child A yields before its tool call. Child B then switches the same process-
  // global workspace. A's later write is therefore resolved in B's project.
  initWorkspace(b);

  const actual = await writeFile({ path: 'result.txt', content: 'FROM_A' });
  const aFile = path.join(a, 'result.txt');
  const bFile = path.join(b, 'result.txt');
  return {
    actual_write_path: actual,
    a_has_file: fs.existsSync(aFile),
    b_has_file: fs.existsSync(bFile),
    cross_workspace_write: !fs.existsSync(aFile) && fs.existsSync(bFile),
  };
}

function createScopedExecutor(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  fs.mkdirSync(root, { recursive: true });
  return {
    async writeFile(args) {
      const target = path.resolve(root, String(args.path || ''));
      if (!isInside(root, target)) throw new Error('escape');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(args.content ?? ''), 'utf8');
      return target;
    },
  };
}

async function verifyScopedContract(base) {
  const a = path.join(base, 'safe-a');
  const b = path.join(base, 'safe-b');
  const execA = createScopedExecutor(a);
  const execB = createScopedExecutor(b);

  const [pathA, pathB] = await Promise.all([
    (async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return execA.writeFile({ path: 'result.txt', content: 'A' });
    })(),
    execB.writeFile({ path: 'result.txt', content: 'B' }),
  ]);

  return {
    a_ok: fs.readFileSync(path.join(a, 'result.txt'), 'utf8') === 'A',
    b_ok: fs.readFileSync(path.join(b, 'result.txt'), 'utf8') === 'B',
    distinct_paths: pathA !== pathB,
  };
}

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-workspace-isolation-'));
  const current = await reproduceGlobalWorkspaceRace(base);
  const candidate = await verifyScopedContract(base);

  if (!current.cross_workspace_write) throw new Error('expected current global-workspace race');
  if (!candidate.a_ok || !candidate.b_ok || !candidate.distinct_paths) {
    throw new Error('scoped candidate failed');
  }

  console.log(JSON.stringify({
    verdict: 'QWEN_GLOBAL_WORKSPACE_CROSS_CHILD_ISOLATION_GAP_REPRO_PASS',
    current,
    candidate,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
