import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const analyzer = path.join(repoRoot, 'tools', 'runtime-reachability.mjs');

function write(root, relative, content = '') {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kontur-reachability-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'reachability@example.test');
  git(root, 'config', 'user.name', 'Kontur Reachability Test');

  write(root, 'packages/core/package.json', '{"name":"@kontur/core","exports":"./src/index.ts"}\n');
  write(root, 'packages/contracts/package.json', '{"name":"@kontur/contracts","exports":"./src/index.ts"}\n');
  write(root, 'packages/core/src/index.ts', 'export const core = 1;\n');
  write(root, 'packages/contracts/src/index.ts', 'export type DTO = { x: number };\n');

  write(root, 'apps/miniapp/src/main.tsx', "import './App.js';\n");
  write(root, 'apps/miniapp/src/App.tsx', "import './screens/LocalKontur.js';\nimport './screens/Legacy.js';\n");
  write(root, 'apps/miniapp/src/screens/Legacy.tsx', 'export const legacy = 1;\n');
  write(root, 'apps/miniapp/src/screens/LocalKontur.tsx', [
    "import type { DTO } from '@kontur/contracts';",
    "import { core } from '@kontur/core';",
    "import '../components/QuizEgg.js';",
    "import '../result-taxonomy.js';",
    "import '../local-kontur.css';",
    'const stage = 1;',
    'const asset = `/quiz/egg-stage-${stage}.webp`;',
    'export const current: DTO = { x: core };',
    'console.log(asset);',
    '',
  ].join('\n'));
  write(root, 'apps/miniapp/src/components/QuizEgg.tsx', 'export const egg = 1;\n');
  write(root, 'apps/miniapp/src/result-taxonomy.ts', 'export const taxonomy = 1;\n');
  write(root, 'apps/miniapp/src/local-kontur.css', ".egg{background:url('/quiz/egg-stage-01.webp')}\n");
  write(root, 'apps/miniapp/public/quiz/egg-stage-01.webp');
  write(root, 'apps/miniapp/public/quiz/egg-stage-08.webp');

  write(root, 'apps/worker/src/index.ts', "import './api.js';\n");
  write(root, 'apps/worker/src/api.ts', "import './local-kontur-api.js';\nimport './legacy-api.js';\n");
  write(root, 'apps/worker/src/legacy-api.ts', 'export const legacyApi = 1;\n');
  write(root, 'apps/worker/src/local-kontur-api.ts', [
    "import type { DTO } from '@kontur/contracts';",
    "import { core } from '@kontur/core';",
    'export const currentApi: DTO = { x: core };',
    '',
  ].join('\n'));

  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'fixture');
  return root;
}

test('separates runtime imports from type-only source dependencies and expands simple public templates', () => {
  const root = makeFixture();
  const jsonPath = path.join(root, 'reachability.json');
  const markdownPath = path.join(root, 'reachability.md');
  try {
    const run = spawnSync(process.execPath, [analyzer], {
      cwd: root,
      env: {
        ...process.env,
        RUNTIME_REACHABILITY_OUTPUT: jsonPath,
        RUNTIME_REACHABILITY_MARKDOWN: markdownPath,
      },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `analyzer failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);

    const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(result.schema, 'kontur-runtime-reachability-v2');

    assert(!result.productionRuntimeImportGraph.includes('packages/contracts/src/index.ts'));
    assert(result.productionSourceDependencyGraph.includes('packages/contracts/src/index.ts'));

    assert(result.currentFeatureRuntimeGraph.includes('packages/core/src/index.ts'));
    assert(!result.currentFeatureRuntimeGraph.includes('packages/contracts/src/index.ts'));
    assert(result.currentFeatureSourceGraph.includes('packages/contracts/src/index.ts'));

    assert(result.runtimeReachableOutsideCurrentFeature.includes('apps/miniapp/src/screens/Legacy.tsx'));
    assert(result.runtimeReachableOutsideCurrentFeature.includes('apps/worker/src/legacy-api.ts'));

    assert(result.currentPublicRefs.includes('apps/miniapp/public/quiz/egg-stage-01.webp'));
    assert(result.currentPublicRefs.includes('apps/miniapp/public/quiz/egg-stage-08.webp'));
    assert(result.currentDynamicPublicPatterns.some((item) => item.includes('egg-stage-${stage}.webp')));

    assert.deepEqual(result.unresolvedInternalImports, []);
    assert(fs.readFileSync(markdownPath, 'utf8').includes('Safety interpretation'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
