import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const OUTPUT = process.env.RUNTIME_REACHABILITY_OUTPUT || '';
const MARKDOWN_OUTPUT = process.env.RUNTIME_REACHABILITY_MARKDOWN || '';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');
const abs = (value) => path.resolve(ROOT, value);

function fail(message) {
  console.error(`RUNTIME_REACHABILITY_FAIL: ${message}`);
  process.exitCode = 1;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map(normalize);
}

const tracked = trackedFiles();
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

function moduleSpecifiers(file) {
  const text = fs.readFileSync(abs(file), 'utf8');
  if (file.endsWith('.css')) {
    const specs = [];
    for (const match of text.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) specs.push(match[1]);
    return specs;
  }
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const specs = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) specs.push(node.arguments[0].text);
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
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
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    if (specifier.startsWith('/')) return null;
    return resolveCandidate(normalize(path.join(path.dirname(fromFile), specifier)));
  }
  for (const [packageName, entry] of packageMap) {
    if (specifier === packageName) return resolveCandidate(entry);
  }
  return null;
}

const importCache = new Map();
const unresolvedInternal = [];
function imports(file) {
  if (importCache.has(file)) return importCache.get(file);
  const out = [];
  for (const specifier of moduleSpecifiers(file)) {
    const resolved = resolveSpecifier(file, specifier);
    if (resolved) out.push(resolved);
    else if (specifier.startsWith('.') || specifier.startsWith('@kontur/')) unresolvedInternal.push({ from: file, specifier });
  }
  importCache.set(file, [...new Set(out)]);
  return importCache.get(file);
}

function closure(entrypoints) {
  const seen = new Set();
  const stack = [...entrypoints];
  for (const entry of entrypoints) if (!trackedSet.has(entry)) fail(`entrypoint missing: ${entry}`);
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (!sourceExts.has(path.extname(file))) continue;
    for (const dep of imports(file)) if (!seen.has(dep)) stack.push(dep);
  }
  return seen;
}

const roots = {
  miniappBundle: ['apps/miniapp/src/main.tsx'],
  workerBundle: ['apps/worker/src/index.ts'],
  currentMiniappFeature: ['apps/miniapp/src/screens/LocalKontur.tsx'],
  currentWorkerFeature: ['apps/worker/src/local-kontur-api.ts'],
};
const graphs = Object.fromEntries(Object.entries(roots).map(([name, entries]) => [name, closure(entries)]));
const productionReachable = new Set([...graphs.miniappBundle, ...graphs.workerBundle]);
const currentFeatureReachable = new Set([...graphs.currentMiniappFeature, ...graphs.currentWorkerFeature]);

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

const productionBundleReachable = sorted([...productionReachable].filter((file) => sourceSet.has(file)));
const currentFeatureClosure = sorted([...currentFeatureReachable].filter((file) => sourceSet.has(file)));
const productionOutsideNarrowFeature = productionBundleReachable.filter((file) => !currentFeatureReachable.has(file));
const trackedSourceNotInProductionBundle = sourceFiles.filter((file) => !productionReachable.has(file)).sort();
const publicAssets = tracked.filter((file) => file.startsWith('apps/miniapp/public/'));
const publicAssetSet = new Set(publicAssets);

function publicRefs(files) {
  const refs = new Set();
  const dynamicPatterns = new Set();
  const ext = '(?:webp|png|jpe?g|svg|gif|ico|webm|mp4|woff2?|ttf|json)';
  for (const file of files) {
    if (!trackedSet.has(file)) continue;
    const text = fs.readFileSync(abs(file), 'utf8');

    const literal = new RegExp(`["'\\`]\\/(?!api\\/)([^"'\\`?#]+\\.${ext})(?:[?#][^"'\\`]*)?["'\\`]`, 'gi');
    for (const match of text.matchAll(literal)) {
      const candidate = `apps/miniapp/public/${match[1]}`;
      if (publicAssetSet.has(candidate)) refs.add(candidate);
    }

    const cssUrl = new RegExp(`url\\(\\s*["']?\\/(?!api\\/)([^)"'?#]+\\.${ext})(?:[?#][^)"']*)?["']?\\s*\\)`, 'gi');
    for (const match of text.matchAll(cssUrl)) {
      const candidate = `apps/miniapp/public/${match[1]}`;
      if (publicAssetSet.has(candidate)) refs.add(candidate);
    }

    for (const match of text.matchAll(/`(\/[^`]*\$\{[^`]+\}[^`]*)`/g)) {
      const template = match[1];
      if (!new RegExp(`\\.${ext}(?:[?#].*)?$`, 'i').test(template)) continue;
      const pathOnly = template.split(/[?#]/, 1)[0];
      const escaped = pathOnly
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\$\\\{[^}]+\\\}/g, '.*');
      const matcher = new RegExp(`^apps/miniapp/public${escaped}$`);
      dynamicPatterns.add(template);
      for (const asset of publicAssets) if (matcher.test(asset)) refs.add(asset);
    }
  }
  return { refs, dynamicPatterns };
}

const indexHtml = trackedSet.has('apps/miniapp/index.html') ? ['apps/miniapp/index.html'] : [];
const productionPublic = publicRefs([...productionBundleReachable, ...indexHtml]);
const currentPublic = publicRefs([...currentFeatureClosure, ...indexHtml]);
const publicWithoutStaticOrTemplateRef = publicAssets.filter((file) => !productionPublic.refs.has(file)).sort();

const expectedCurrent = [
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
  'apps/miniapp/src/result-taxonomy.ts',
  'apps/worker/src/local-kontur-api.ts',
  'packages/core/src/index.ts',
  'packages/contracts/src/index.ts',
];
for (const file of expectedCurrent) {
  if (!currentFeatureReachable.has(file)) fail(`expected current feature dependency is not reachable: ${file}`);
}
if (unresolvedInternal.length) {
  for (const item of unresolvedInternal) console.error(`UNRESOLVED_INTERNAL_IMPORT ${item.from} -> ${item.specifier}`);
  fail(`${unresolvedInternal.length} relative/workspace imports could not be resolved`);
}

const result = {
  schema: 'kontur-runtime-reachability-v1',
  generatedAt: new Date().toISOString(),
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  roots,
  counts: {
    tracked: tracked.length,
    productionSourceFiles: sourceFiles.length,
    productionBundleReachable: productionBundleReachable.length,
    currentFeatureClosure: currentFeatureClosure.length,
    productionOutsideNarrowFeature: productionOutsideNarrowFeature.length,
    trackedSourceNotInProductionBundle: trackedSourceNotInProductionBundle.length,
    deployedPublicAssets: publicAssets.length,
    productionPublicRefs: productionPublic.refs.size,
    currentPublicRefs: currentPublic.refs.size,
    publicWithoutStaticOrTemplateRef: publicWithoutStaticOrTemplateRef.length,
  },
  packageEntries: Object.fromEntries([...packageMap].sort(([a], [b]) => a.localeCompare(b))),
  productionBundleReachable,
  currentFeatureClosure,
  productionOutsideNarrowFeature,
  trackedSourceNotInProductionBundle,
  deployedPublicAssets: publicAssets.sort(),
  productionPublicRefs: sorted(productionPublic.refs),
  currentPublicRefs: sorted(currentPublic.refs),
  productionDynamicPublicPatterns: sorted(productionPublic.dynamicPatterns),
  currentDynamicPublicPatterns: sorted(currentPublic.dynamicPatterns),
  publicWithoutStaticOrTemplateRef,
  unresolvedInternalImports: unresolvedInternal,
  interpretation: {
    productionBundleReachable: 'Statically reachable from the real Vite/Worker entrypoints. Presence here proves shipping/bundle reachability, not current product approval.',
    currentFeatureClosure: 'Statically reachable from LocalKontur.tsx or local-kontur-api.ts. This is the narrow current feature closure, not the complete transport/auth platform.',
    productionOutsideNarrowFeature: 'Ships in the production bundle but is outside the narrow LocalKontur feature closure. Must be classified before deletion; do not call it dead code from this report alone.',
    trackedSourceNotInProductionBundle: 'Tracked production-area source not statically reachable from either real production entrypoint. Candidate for further review only; dynamic/runtime references can still exist.',
    deployedPublicAssets: 'Vite public/ files are copied to dist and therefore deployed regardless of literal source references.',
    publicWithoutStaticOrTemplateRef: 'Deployed public asset with no detected literal or simple template reference. This is not proof that the asset is unused.',
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
const markdown = `# Kontur runtime reachability\n\nGenerated from tracked files at \`${result.gitHead}\`.\n\n## Counts\n\n${Object.entries(result.counts).map(([k, v]) => `- ${k}: **${v}**`).join('\n')}\n\n## Production bundle reachable outside narrow current feature closure\n\n${markdownList(productionOutsideNarrowFeature)}\n## Tracked source not statically reachable from production entrypoints\n\n${markdownList(trackedSourceNotInProductionBundle)}\n## Deployed public assets without detected literal/template reference\n\n${markdownList(publicWithoutStaticOrTemplateRef)}\n## Safety interpretation\n\nThis report is reachability evidence, not a deletion list. Static bundle reachability does not imply product approval, and absence from the static graph does not by itself prove runtime deadness.\n`;
if (MARKDOWN_OUTPUT) {
  fs.mkdirSync(path.dirname(abs(MARKDOWN_OUTPUT)), { recursive: true });
  fs.writeFileSync(abs(MARKDOWN_OUTPUT), markdown);
}

process.stdout.write(json);
if (!process.exitCode) console.log('RUNTIME_REACHABILITY_PASS');
