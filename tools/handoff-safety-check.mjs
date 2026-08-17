import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  console.error(`HANDOFF_SAFETY_FAIL: ${message}`);
  process.exitCode = 1;
}

function mustExist(path) {
  if (!existsSync(path)) fail(`required path missing: ${path}`);
}

const required = [
  'README.md',
  'CURRENT_PRODUCT.md',
  'HANDOFF.md',
  'ARCHITECTURE.md',
  'CODEBASE_MAP.md',
  'IMPLEMENTATION_PRIORITY.md',
  'PROJECT_STATE.yaml',
  'docs/product/PRODUCT_BRIEF_2026-08-13.md',
  'docs/product/DECISION_LOG_2026-08-14.md',
  'docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md',
  'docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md',
  'docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md',
  'docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md',
  'apps/miniapp/src/App.tsx',
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
  'apps/miniapp/src/result-taxonomy.ts',
];
for (const path of required) mustExist(path);
for (let stage = 1; stage <= 8; stage += 1) {
  mustExist(`apps/miniapp/public/quiz/egg-stage-${String(stage).padStart(2, '0')}.webp`);
}

const exactEvidence = new Map([
  [
    'docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md',
    '1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f',
  ],
  [
    'docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md',
    '7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe',
  ],
  [
    'docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md',
    'a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb',
  ],
  [
    'docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md',
    '5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe',
  ],
]);
for (const [path, expected] of exactEvidence) {
  if (!existsSync(path)) continue;
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) fail(`exact product evidence hash mismatch: ${path} expected=${expected} actual=${actual}`);
}

const legacyRootDocs = [
  'COMMUNITY_RESEARCH_STAGE1_INTERIM.md',
  'CURSOR_HANDOFF_2026-08-07.md',
  'DESIGN.md',
  'EXPERIENCE_SPEC_V1.md',
  'HANDOVER.md',
  'IMPLEMENTATION_PLAN_V1.md',
  'NEXT_CHAT_PROMPT.md',
  'PRODUCT_REDESIGN_BRIEF.md',
  'PROJECT_PASSPORT.md',
  'RESEARCH_SCOPE_V1.md',
  'RESTORED_PRODUCT_V3.md',
];
for (const path of legacyRootDocs) {
  if (existsSync(path)) fail(`legacy authority leaked back into repository root: ${path}`);
}

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

for (const path of tracked) {
  const normalized = path.replaceAll('\\', '/');
  const lower = normalized.toLowerCase();

  if ((lower === '.env' || lower.endsWith('/.env')) && !lower.endsWith('.example')) {
    fail(`plaintext .env is tracked: ${normalized}`);
  }
  if (/\.(pem|p12|pfx|key)$/i.test(normalized)) {
    fail(`private-key shaped file is tracked: ${normalized}`);
  }
  if (/^(backups?|data|research-private)\//i.test(normalized)) {
    fail(`private/runtime directory is tracked: ${normalized}`);
  }
  if (lower.startsWith('.runtime-state/') && !lower.endsWith('.gpg')) {
    fail(`runtime-state must stay encrypted: ${normalized}`);
  }
}

const app = readFileSync('apps/miniapp/src/App.tsx', 'utf8');
const local = readFileSync('apps/miniapp/src/screens/LocalKontur.tsx', 'utf8');
const egg = readFileSync('apps/miniapp/src/components/QuizEgg.tsx', 'utf8');
const taxonomy = readFileSync('apps/miniapp/src/result-taxonomy.ts', 'utf8');

if (!app.includes("params.get('campaign') === 'v5'")) fail('explicit V5 route guard missing');
if (!app.includes('return <LocalKontur />;')) fail('LocalKontur is not the default app surface');
if (!local.includes("type Stage = 'community' | 'hook' | 'questions' | 'hatching' | 'reveal' | 'worm' | 'home'")) {
  fail('current LocalKontur first-time stage machine changed unexpectedly');
}
if (!local.includes('Какая ты<br />птица <em>в IT?</em>')) fail('canonical hook headline missing');
if (!local.includes("kotosov: { name: 'котосов'")) fail('accepted Kotosov visual result missing from current presentation');
if (!local.includes('selectBirdResult({')) fail('current hatch flow no longer selects the accepted visual taxonomy');
if (!egg.includes('Math.max(1, Math.min(8, stage))')) fail('quiz egg no longer clamps to 8 deterministic stages');
if (!egg.includes('safeStage * 45')) fail('quiz egg progress no longer maps 8 questions to a full circle');
if (!taxonomy.includes("BirdResultId = 'magpie' | 'woodpecker' | 'jay' | 'crane' | 'owl' | 'kotosov'")) {
  fail('accepted six-result visual taxonomy changed unexpectedly');
}
if (!taxonomy.includes("reason: 'coder-is-unique-secondary'")) fail('Kotosov unique-secondary classification missing');
if (!taxonomy.includes('scores.coder > scores[role]')) fail('Kotosov coder-secondary strictness changed unexpectedly');
if (!taxonomy.includes("resolvedRole !== 'vibe'")) fail('Kotosov must remain presentation-only under canonical vibe role');

if (!process.exitCode) {
  console.log(`HANDOFF_SAFETY_PASS tracked=${tracked.length} required=${required.length} eggStages=8 exactEvidence=${exactEvidence.size}`);
}
