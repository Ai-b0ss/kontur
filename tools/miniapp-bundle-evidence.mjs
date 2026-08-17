import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const MINIAPP_ROOT = path.resolve(ROOT, 'apps/miniapp');
const OUTPUT = process.env.MINIAPP_BUNDLE_EVIDENCE_OUTPUT || '';

const normalize = (value) => value.replaceAll('\\', '/');

function repoPathForModuleId(id) {
  const cleanId = id.split('?', 1)[0];
  if (!path.isAbsolute(cleanId)) return null;
  const relative = path.relative(ROOT, cleanId);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) return null;
  return normalize(relative);
}

function fail(message) {
  console.error(`MINIAPP_BUNDLE_EVIDENCE_FAIL: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(path.join(MINIAPP_ROOT, 'package.json'))) fail('apps/miniapp/package.json missing');
if (process.exitCode) process.exit(process.exitCode);

const miniappRequire = createRequire(path.join(MINIAPP_ROOT, 'package.json'));
let viteEntry;
try {
  viteEntry = miniappRequire.resolve('vite');
} catch (error) {
  fail(`cannot resolve Vite from apps/miniapp dependency graph: ${error.message}`);
}
if (process.exitCode) process.exit(process.exitCode);

const { build } = await import(pathToFileURL(viteEntry).href);
const chunks = [];
const assets = [];

const evidencePlugin = {
  name: 'kontur-miniapp-bundle-evidence',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const [fileName, item] of Object.entries(bundle)) {
      if (item.type === 'chunk') {
        const allModules = Object.entries(item.modules);
        const repoModules = allModules
          .map(([id, meta]) => ({ id, meta, repoPath: repoPathForModuleId(id) }))
          .filter((entry) => entry.repoPath)
          .map(({ meta, repoPath }) => ({
            repoPath,
            renderedLength: Number(meta.renderedLength ?? 0),
            originalLength: Number(meta.originalLength ?? 0),
            renderedExports: Array.isArray(meta.renderedExports) ? [...meta.renderedExports] : [],
            removedExports: Array.isArray(meta.removedExports) ? [...meta.removedExports] : [],
          }))
          .sort((a, b) => a.repoPath.localeCompare(b.repoPath));

        chunks.push({
          fileName,
          name: item.name,
          isEntry: item.isEntry,
          isDynamicEntry: item.isDynamicEntry,
          imports: [...item.imports].sort(),
          dynamicImports: [...item.dynamicImports].sort(),
          totalModuleCount: allModules.length,
          repoModuleCount: repoModules.length,
          repoModules,
        });
      } else {
        assets.push({
          fileName,
          name: item.name || null,
          bytes: typeof item.source === 'string' ? Buffer.byteLength(item.source) : item.source?.byteLength ?? null,
        });
      }
    }
  },
};

await build({
  root: MINIAPP_ROOT,
  configFile: path.join(MINIAPP_ROOT, 'vite.config.ts'),
  logLevel: 'error',
  mode: 'production',
  plugins: [evidencePlugin],
  build: {
    write: false,
  },
});

chunks.sort((a, b) => a.fileName.localeCompare(b.fileName));
assets.sort((a, b) => a.fileName.localeCompare(b.fileName));

const repoModules = new Map();
for (const chunk of chunks) {
  for (const module of chunk.repoModules) {
    const prior = repoModules.get(module.repoPath) || {
      repoPath: module.repoPath,
      chunks: [],
      renderedLength: 0,
      originalLength: 0,
      renderedExports: new Set(),
      removedExports: new Set(),
    };
    prior.chunks.push(chunk.fileName);
    prior.renderedLength += module.renderedLength;
    prior.originalLength = Math.max(prior.originalLength, module.originalLength);
    for (const value of module.renderedExports) prior.renderedExports.add(value);
    for (const value of module.removedExports) prior.removedExports.add(value);
    repoModules.set(module.repoPath, prior);
  }
}

const emittedRepoModules = [...repoModules.values()]
  .map((item) => ({
    repoPath: item.repoPath,
    chunks: [...new Set(item.chunks)].sort(),
    renderedLength: item.renderedLength,
    originalLength: item.originalLength,
    renderedExports: [...item.renderedExports].sort(),
    removedExports: [...item.removedExports].sort(),
    contributesRenderedCode: item.renderedLength > 0,
  }))
  .sort((a, b) => a.repoPath.localeCompare(b.repoPath));

const byPath = new Map(emittedRepoModules.map((item) => [item.repoPath, item]));
const probes = [
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
  'apps/miniapp/src/result-taxonomy.ts',
  'apps/miniapp/src/screens/ExperienceV2.tsx',
  'apps/miniapp/src/screens/RestoredExperience.tsx',
  'apps/miniapp/src/screens/ZeroSeason.tsx',
  'apps/miniapp/src/screens/LiveCampaign.tsx',
  'apps/miniapp/src/screens/Onboarding.tsx',
  'apps/miniapp/src/screens/Profile.tsx',
  'apps/miniapp/src/screens/Community.tsx',
  'apps/miniapp/src/screens/Eggs.tsx',
];
const probeResults = Object.fromEntries(probes.map((probe) => {
  const item = byPath.get(probe);
  return [probe, item ? {
    presentInRollupChunkModules: true,
    contributesRenderedCode: item.contributesRenderedCode,
    renderedLength: item.renderedLength,
    chunks: item.chunks,
  } : {
    presentInRollupChunkModules: false,
    contributesRenderedCode: false,
    renderedLength: 0,
    chunks: [],
  }];
}));

const entryChunks = chunks.filter((chunk) => chunk.isEntry);
if (!entryChunks.length) fail('Vite/Rollup produced no entry chunk');
for (const required of [
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
  'apps/miniapp/src/result-taxonomy.ts',
]) {
  const proof = probeResults[required];
  if (!proof?.presentInRollupChunkModules || !proof.contributesRenderedCode) {
    fail(`current module did not contribute rendered production code: ${required}`);
  }
}

const result = {
  schema: 'kontur-miniapp-bundle-evidence-v1',
  generatedAt: new Date().toISOString(),
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  vitePackage: 'apps/miniapp dependency graph',
  buildMode: 'production',
  write: false,
  counts: {
    chunks: chunks.length,
    entryChunks: entryChunks.length,
    assets: assets.length,
    repoModulesInRollupChunks: emittedRepoModules.length,
    repoModulesContributingRenderedCode: emittedRepoModules.filter((item) => item.contributesRenderedCode).length,
  },
  probes: probeResults,
  emittedRepoModules,
  chunks,
  assets,
  interpretation: {
    presentInRollupChunkModules: 'Rollup reported the source module in a generated production chunk during this exact Vite production build.',
    contributesRenderedCode: 'Rollup reported renderedLength > 0 for the source module across generated chunks. This is stronger than static import reachability but does not make the module an owner-approved current feature.',
    absent: 'The module was not reported in generated chunk.modules for this exact production build. Treat as build evidence for this commit/config only, not a permanent deletion authorization.',
    writeFalse: 'The evidence build runs with build.write=false and does not replace apps/miniapp/dist.',
  },
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (OUTPUT) {
  const output = path.resolve(ROOT, OUTPUT);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized, 'utf8');
}
process.stdout.write(serialized);
if (!process.exitCode) console.log('MINIAPP_BUNDLE_EVIDENCE_PASS');
