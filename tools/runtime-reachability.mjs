import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const OUTPUT = process.env.RUNTIME_REACHABILITY_OUTPUT || '';
const MARKDOWN_OUTPUT = process.env.RUNTIME_REACHABILITY_MARKDOWN || '';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');
const abs = (value) => path.resolve(ROOT, value);
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function fail(message) {
  console.error(`RUNTIME_REACHABILITY_FAIL: ${message}`);
  process.exitCode = 1;
}

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map(normalize);
const trackedSet = new Set(tracked);

const sourceRoots = [
  'apps/miniapp/src/',
  'apps/worker/src/',
  'packages/core/src/',
  'packages/contracts/src/',
];
const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css']);
const sourceFiles = tracked.filter((file) => sourceRoots.some((root) => file.startsWith(root)) && sourceExts.has(path.extname(file)));
const sourceSet = new Set(sourceFiles);

function scriptKind(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function importHasRuntimeBinding(node) {
  const clause = node.importClause;
  if (!clause) return true; // side-effect import
  if (clause.isTypeOnly) return false;
  if (clause.name) return true; // default import
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return true;
  if (ts.isNamedImports(bindings)) return bindings.elements.some((element) => !element.isTypeOnly);
  return true;
}

function exportHasRuntimeBinding(node) {
  if (node.isTypeOnly) return false;
  if (!node.exportClause) return true; // export * from
  if (ts.isNamespaceExport(node.exportClause)) return true;
  if (ts.isNamedExports(node.exportClause)) return node.exportClause.elements.some((element) => !element.isTypeOnly);
  return true;
}

function dependenciesOf(file) {
  const text = fs.readFileSync(abs(file), 'utf8');
  if (file.endsWith('.css')) {
    return [...text.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)]
      .map((match) => ({ specifier: match[1], runtime: true, kind: 'css-import' }));
  }

  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const deps = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      deps.push({ specifier: node.moduleSpecifier.text, runtime: importHasRuntimeBinding(node), kind: 'import' });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      deps.push({ specifier: node.moduleSpecifier.text, runtime: exportHasRuntimeBinding(node), kind: 'export' });
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        deps.push({ specifier: node.arguments[0].text, runtime: true, kind: 'dynamic-import' });
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        deps.push({ specifier: node.arguments[0].text, runtime: true, kind: 'require' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return deps;
}

const packageMap = new Map();
for (const packageJson of tracked.filter((file) => file.endsWith('/package.json') || file === 'package.json')) {
  try {
    const json = JSON.parse(fs.readFileSync(abs(packageJson), 'utf8'));
    if (!json?.name || typeof json.name !== 'string' || !json.name.startsWith('@kontur/')) continue;
    const root = normalize(path.dirname(packageJson));
    let entry = null;
    if (typeof json.exports === 'string') entry = json.exports;
    else if (json.exports && typeof json.exports === 'object' && typeof json.exports['.'] === 'string') entry = json.exports['.'];
    else if (typeof json.main === 'string') entry = json.main;
    if (entry) packageMap.set(json.name, normalize(path.join(root, entry)));
  } catch (error) {
    fail(`cannot parse ${packageJson}: ${error.message}`);
  }
}

const candidateExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css'];
function resolveCandidate(base) {
  const normalizedBase = normalize(base);
  const variants = new Set([normalizedBase]);
  if (normalizedBase.endsWith('.js')) {
    variants.add(normalizedBase.slice(0, -3) + '.ts');
    variants.add(normalizedBase.slice(0, -3) + '.tsx');
  }
  if (normalizedBase.endsWith('.mjs')) variants.add(normalizedBase.slice(0, -4) + '.mts');
  if (normalizedBase.endsWith('.cjs')) variants.add(normalizedBase.slice(0, -4) + '.cts');

  for (const variant of variants) {
    if (trackedSet.has(variant)) return variant;
    if (!path.extname(variant)) {
      for (const ext of candidateExtensions.slice(1)) if (trackedSet.has(`${variant}${ext}`)) return `${variant}${ext}`;
      for (const ext of candidateExtensions.slice(1)) if (trackedSet.has(`${variant}/index${ext}`)) return `${variant}/index${ext}`;
    }
  }
  return null;
}

function resolveSpecifier(fromFile, specifier) {
  if (specifier.startsWith('.')) return resolveCandidate(normalize(path.join(path.dirname(fromFile), specifier)));
  if (specifier.startsWith('/')) return null;
  const packageEntry = packageMap.get(specifier);
  return packageEntry ? resolveCandidate(packageEntry) : null;
}

const dependencyCache = new Map();
const unresolvedInternal = [];
function resolvedDependencies(file) {
  if (dependencyCache.has(file)) return dependencyCache.get(file);
  const merged = new Map();
  for (const dep of dependenciesOf(file)) {
    const resolved = resolveSpecifier(file, dep.specifier);
    if (resolved) {
      const prior = merged.get(resolved);
      merged.set(resolved, { path: resolved, runtime: Boolean(dep.runtime || prior?.runtime) });
    } else if (dep.specifier.startsWith('.') || dep.specifier.startsWith('@kontur/')) {
      unresolvedInternal.push({ from: file, specifier: dep.specifier, runtime: dep.runtime, kind: dep.kind });
    }
  }
  const result = [...merged.values()];
  dependencyCache.set(file, result);
  return result;
}

function closure(entrypoints, { runtimeOnly }) {
  const seen = new Set();
  const stack = [...entrypoints];
  for (const entry of entrypoints) if (!trackedSet.has(entry)) fail(`entrypoint missing: ${entry}`);

  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (!sourceExts.has(path.extname(file))) continue;
    for (const dep of resolvedDependencies(file)) {
      if (runtimeOnly && !dep.runtime) continue;
      if (!seen.has(dep.path)) stack.push(dep.path);
    }
  }
  return seen;
}

const productionEntries = ['apps/miniapp/src/main.tsx', 'apps/worker/src/index.ts'];
const currentEntries = ['apps/miniapp/src/screens/LocalKontur.tsx', 'apps/worker/src/local-kontur-api.ts'];

const productionRuntimeGraph = closure(productionEntries, { runtimeOnly: true });
const productionSourceGraph = closure(productionEntries, { runtimeOnly: false });
const currentRuntimeGraph = closure(currentEntries, { runtimeOnly: true });
const currentSourceGraph = closure(currentEntries, { runtimeOnly: false });

const productionRuntimeImportGraph = sorted([...productionRuntimeGraph].filter((file) => sourceSet.has(file)));
const productionSourceDependencyGraph = sorted([...productionSourceGraph].filter((file) => sourceSet.has(file)));
const currentFeatureRuntimeGraph = sorted([...currentRuntimeGraph].filter((file) => sourceSet.has(file)));
const currentFeatureSourceGraph = sorted([...currentSourceGraph].filter((file) => sourceSet.has(file)));
const runtimeReachableOutsideCurrentFeature = productionRuntimeImportGraph.filter((file) => !currentRuntimeGraph.has(file));
const sourceReachableOutsideCurrentFeature = productionSourceDependencyGraph.filter((file) => !currentSourceGraph.has(file));
const trackedSourceNotInProductionSourceGraph = sourceFiles.filter((file) => !productionSourceGraph.has(file)).sort();

const publicAssets = tracked.filter((file) => file.startsWith('apps/miniapp/public/'));
const publicAssetSet = new Set(publicAssets);

function publicRefs(files) {
  const refs = new Set();
  const dynamicPatterns = new Set();
  const literalPattern = /["'`]\/(?!api\/)([^"'`?#]+\.(?:webp|png|jpe?g|svg|gif|ico|webm|mp4|woff2?|ttf|json))(?:[?#][^"'`]*)?["'`]/gi;
  const cssUrlPattern = /url\(\s*["']?\/(?!api\/)([^)"'?#]+\.(?:webp|png|jpe?g|svg|gif|ico|webm|mp4|woff2?|ttf))(?:[?#][^)"']*)?["']?\s*\)/gi;
  const templatePattern = /`(\/[^`]*\$\{[^`]+\}[^`]*)`/g;
  const assetExtensionPattern = /\.(?:webp|png|jpe?g|svg|gif|ico|webm|mp4|woff2?|ttf|json)(?:[?#].*)?$/i;

  for (const file of files) {
    if (!trackedSet.has(file)) continue;
    const text = fs.readFileSync(abs(file), 'utf8');

    for (const match of text.matchAll(literalPattern)) {
      const candidate = `apps/miniapp/public/${match[1]}`;
      if (publicAssetSet.has(candidate)) refs.add(candidate);
    }
    for (const match of text.matchAll(cssUrlPattern)) {
      const candidate = `apps/miniapp/public/${match[1]}`;
      if (publicAssetSet.has(candidate)) refs.add(candidate);
    }
    for (const match of text.matchAll(templatePattern)) {
      const template = match[1];
      if (!assetExtensionPattern.test(template)) continue;
      const pathOnly = template.split(/[?#]/, 1)[0];
      const parts = pathOnly.split(/\$\{[^}]+\}/g).map(escapeRegex);
      const matcher = new RegExp(`^apps/miniapp/public${parts.join('[^/]*')}$`);
      dynamicPatterns.add(template);
      for (const asset of publicAssets) if (matcher.test(asset)) refs.add(asset);
    }
  }
  return { refs, dynamicPatterns };
}

const indexHtml = trackedSet.has('apps/miniapp/index.html') ? ['apps/miniapp/index.html'] : [];
const productionPublic = publicRefs([...productionRuntimeImportGraph, ...indexHtml]);
const currentPublic = publicRefs([...currentFeatureRuntimeGraph, ...indexHtml]);
const publicWithoutDetectedReference = publicAssets.filter((file) => !productionPublic.refs.has(file)).sort();

const expectedCurrentRuntime = [
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
  'apps/miniapp/src/result-taxonomy.ts',
  'apps/miniapp/src/local-kontur.css',
  'apps/worker/src/local-kontur-api.ts',
  'packages/core/src/index.ts',
];
const expectedCurrentSource = [
  ...expectedCurrentRuntime,
  'packages/contracts/src/index.ts',
];
for (const file of expectedCurrentRuntime) {
  if (!currentRuntimeGraph.has(file)) fail(`expected current runtime dependency is not reachable: ${file}`);
}
for (const file of expectedCurrentSource) {
  if (!currentSourceGraph.has(file)) fail(`expected current source dependency is not reachable: ${file}`);
}
if (unresolvedInternal.length) {
  for (const item of unresolvedInternal) {
    console.error(`UNRESOLVED_INTERNAL_IMPORT runtime=${item.runtime} ${item.from} -> ${item.specifier}`);
  }
  fail(`${unresolvedInternal.length} relative/workspace imports could not be resolved`);
}

const result = {
  schema: 'kontur-runtime-reachability-v2',
  generatedAt: new Date().toISOString(),
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  roots: {
    productionEntries,
    currentEntries,
  },
  counts: {
    tracked: tracked.length,
    trackedProductionAreaSource: sourceFiles.length,
    productionRuntimeImportGraph: productionRuntimeImportGraph.length,
    productionSourceDependencyGraph: productionSourceDependencyGraph.length,
    currentFeatureRuntimeGraph: currentFeatureRuntimeGraph.length,
    currentFeatureSourceGraph: currentFeatureSourceGraph.length,
    runtimeReachableOutsideCurrentFeature: runtimeReachableOutsideCurrentFeature.length,
    sourceReachableOutsideCurrentFeature: sourceReachableOutsideCurrentFeature.length,
    trackedSourceNotInProductionSourceGraph: trackedSourceNotInProductionSourceGraph.length,
    deployedPublicAssets: publicAssets.length,
    productionPublicRefs: productionPublic.refs.size,
    currentPublicRefs: currentPublic.refs.size,
    publicWithoutDetectedReference: publicWithoutDetectedReference.length,
  },
  packageEntries: Object.fromEntries([...packageMap].sort(([a], [b]) => a.localeCompare(b))),
  productionRuntimeImportGraph,
  productionSourceDependencyGraph,
  currentFeatureRuntimeGraph,
  currentFeatureSourceGraph,
  runtimeReachableOutsideCurrentFeature,
  sourceReachableOutsideCurrentFeature,
  trackedSourceNotInProductionSourceGraph,
  deployedPublicAssets: publicAssets.sort(),
  productionPublicRefs: sorted(productionPublic.refs),
  currentPublicRefs: sorted(currentPublic.refs),
  productionDynamicPublicPatterns: sorted(productionPublic.dynamicPatterns),
  currentDynamicPublicPatterns: sorted(currentPublic.dynamicPatterns),
  publicWithoutDetectedReference,
  unresolvedInternalImports: unresolvedInternal,
  interpretation: {
    productionRuntimeImportGraph: 'Static runtime-import graph from real Mini App and Worker entrypoints. It excludes imports that are provably type-only. It does NOT prove that every reachable module contributes emitted bytes after Vite/Rollup tree-shaking.',
    productionSourceDependencyGraph: 'Static source-dependency graph including type-only imports. Useful for source handoff, not a runtime bundle claim.',
    currentFeatureRuntimeGraph: 'Static runtime dependencies of LocalKontur.tsx + local-kontur-api.ts. This is the narrow current feature graph, not the complete platform/auth container.',
    runtimeReachableOutsideCurrentFeature: 'Statically runtime-reachable from production entrypoints but outside the narrow current feature graph. Requires semantic/build evidence before classification or deletion.',
    trackedSourceNotInProductionSourceGraph: 'Tracked production-area source absent even from the static production source graph. Candidate for review only; generated/dynamic/tool references can still exist.',
    deployedPublicAssets: 'Vite public/ files are copied to dist independently of TypeScript import reachability.',
    publicWithoutDetectedReference: 'Public asset with no detected literal/simple-template reference. This is not proof that the asset is unused.',
  },
};

const json = `${JSON.stringify(result, null, 2)}\n`;
if (OUTPUT) {
  fs.mkdirSync(path.dirname(abs(OUTPUT)), { recursive: true });
  fs.writeFileSync(abs(OUTPUT), json);
}

function markdownList(items, limit = 200) {
  if (!items.length) return '- _none_\n';
  const shown = items.slice(0, limit).map((item) => `- \`${item}\``).join('\n');
  return `${shown}${items.length > limit ? `\n- … ${items.length - limit} more` : ''}\n`;
}
const markdown = `# Kontur runtime reachability\n\nGenerated from tracked files at \`${result.gitHead}\`.\n\n## Counts\n\n${Object.entries(result.counts).map(([key, value]) => `- ${key}: **${value}**`).join('\n')}\n\n## Static runtime-import graph outside narrow current feature\n\n${markdownList(runtimeReachableOutsideCurrentFeature)}\n## Source-dependency graph outside narrow current feature\n\n${markdownList(sourceReachableOutsideCurrentFeature)}\n## Tracked production-area source outside static production source graph\n\n${markdownList(trackedSourceNotInProductionSourceGraph)}\n## Public assets without detected literal/template reference\n\n${markdownList(publicWithoutDetectedReference)}\n## Safety interpretation\n\nThis report is evidence for classification, not a deletion list. Runtime-import reachability does not prove emitted bundle bytes, and static unreachability does not by itself prove runtime deadness.\n`;
if (MARKDOWN_OUTPUT) {
  fs.mkdirSync(path.dirname(abs(MARKDOWN_OUTPUT)), { recursive: true });
  fs.writeFileSync(abs(MARKDOWN_OUTPUT), markdown);
}

process.stdout.write(json);
if (!process.exitCode) console.log('RUNTIME_REACHABILITY_PASS');
