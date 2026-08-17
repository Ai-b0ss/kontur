import { execFileSync } from 'node:child_process';
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
  'apps/miniapp/src/App.tsx',
  'apps/miniapp/src/screens/LocalKontur.tsx',
  'apps/miniapp/src/components/QuizEgg.tsx',
];
for (const path of required) mustExist(path);
for (let stage = 1; stage <= 8; stage += 1) {
  mustExist(`apps/miniapp/public/quiz/egg-stage-${String(stage).padStart(2, '0')}.webp`);
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

if (!app.includes("params.get('campaign') === 'v5'")) fail('explicit V5 route guard missing');
if (!app.includes('return <LocalKontur />;')) fail('LocalKontur is not the default app surface');
if (!local.includes("type Stage = 'community' | 'hook' | 'questions' | 'hatching' | 'reveal' | 'worm' | 'home'")) {
  fail('current LocalKontur first-time stage machine changed unexpectedly');
}
if (!local.includes('Какая ты<br />птица <em>в IT?</em>')) fail('canonical hook headline missing');
if (!egg.includes('Math.max(1, Math.min(8, stage))')) fail('quiz egg no longer clamps to 8 deterministic stages');
if (!egg.includes('safeStage * 45')) fail('quiz egg progress no longer maps 8 questions to a full circle');

if (!process.exitCode) {
  console.log(`HANDOFF_SAFETY_PASS tracked=${tracked.length} required=${required.length} eggStages=8`);
}
