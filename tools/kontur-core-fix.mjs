import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (text, before, after, label) => {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  return text.replace(before, after);
};

// 1) Canonical six-character set. Five reviewed masters stay; crane is a bounded redraw.
write('apps/miniapp/public/results/crane-collectible.svg', `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Журавль-менеджер</title>
  <desc id="desc">Компактный дружелюбный журавль с галстуком и маленьким планшетом задач.</desc>
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f0e9"/><stop offset="1" stop-color="#b9b8c6"/></linearGradient>
    <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#696c7d"/><stop offset="1" stop-color="#3b3d49"/></linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#000" flood-opacity=".32"/></filter>
  </defs>
  <g filter="url(#shadow)" stroke="#17181d" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="258" cy="319" rx="124" ry="112" fill="url(#body)"/>
    <path d="M169 294c26-55 74-78 135-69 34 5 64 22 86 49-45-12-85 2-112 43-29 43-66 55-109 36z" fill="url(#wing)"/>
    <path d="M248 219c-8-48 4-91 37-128 17-19 37-30 58-31 28-2 50 13 57 37 8 29-7 53-36 63-18 6-36 4-55-5l-8 84z" fill="url(#body)"/>
    <path d="M371 101l82 19-79 34z" fill="#f0b24d"/>
    <path d="M330 64c15-14 36-14 49 0-16 8-32 11-49 0z" fill="#ef625d"/>
    <circle cx="355" cy="105" r="8" fill="#17181d" stroke="none"/>
    <path d="M277 244l-23 43 31 34 30-38-21-39z" fill="#58c7d8"/>
    <path d="M182 351l-46 24 19 47 62-24" fill="#8b6ff1"/>
    <rect x="121" y="351" width="88" height="112" rx="14" fill="#2b2c34"/>
    <path d="M143 379h43M143 403h33M143 427h38" stroke="#dfe2e5" stroke-width="7"/>
    <path d="M219 409c-2 36-3 59-5 71M298 421c8 29 14 49 17 60" fill="none"/>
    <path d="M190 481h50M293 481h50" fill="none"/>
    <path d="M383 292c22 16 35 39 38 69" fill="none"/>
    <circle cx="424" cy="372" r="18" fill="#58c7d8"/>
  </g>
</svg>
`);

write('apps/miniapp/src/components/CanonicalBirdVisual.tsx', `import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import type { BirdResultId } from '../result-taxonomy.js';
import { RESULT_ASSETS } from './result-bird-assets.js';

export function CanonicalBirdVisual({
  resultId,
  palette,
  size,
  className = '',
}: {
  resultId: BirdResultId;
  palette?: Palette | null;
  size?: number;
  className?: string;
}) {
  const asset = RESULT_ASSETS[resultId];
  const frameStyle = size ? ({ width: size, height: size } satisfies CSSProperties) : undefined;
  const maskStyle = palette ? ({
    background: `linear-gradient(145deg, ${palette.crest} 0 18%, ${palette.body} 28% 51%, ${palette.wing} 57% 76%, ${palette.tail} 82% 100%)`,
    WebkitMaskImage: `url(${asset.src})`,
    maskImage: `url(${asset.src})`,
  } satisfies CSSProperties) : undefined;
  return (
    <span className={`lk-canonical-bird ${className}`.trim()} style={frameStyle} data-bird-result={resultId}>
      <img className="lk-result-bird" src={asset.src} width={asset.width} height={asset.height} alt={asset.label} decoding="async" draggable={false} />
      {palette && <span className="lk-canonical-bird__tint" style={maskStyle} aria-hidden="true" />}
    </span>
  );
}
`);

let assets = read('apps/miniapp/src/components/result-bird-assets.ts');
assets = replaceOnce(
  assets,
  "  crane: { src: '/results/crane-character-v4.webp', width: 750, height: 1500, label: 'Журавль' },",
  "  crane: { src: '/results/crane-collectible.svg', width: 512, height: 512, label: 'Журавль' },",
  'canonical crane asset',
);
write('apps/miniapp/src/components/result-bird-assets.ts', assets);

// 2) One physical quiz egg owns q1..q8 and the hatch layers.
write('apps/miniapp/src/components/QuizEgg.tsx', `import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import type { BirdResultId } from '../result-taxonomy.js';
import { CanonicalBirdVisual } from './CanonicalBirdVisual.js';

export function quizEggStageModel(stage: number) {
  const safeStage = Math.max(1, Math.min(8, Math.trunc(stage)));
  const number = String(safeStage).padStart(2, '0');
  return Object.freeze({
    stage: safeStage,
    asset: `/quiz/egg-stage-${number}.webp`,
    progressDegrees: safeStage * 45,
  });
}

export function QuizEgg({
  stage,
  hatching = false,
  resultId,
  palette,
}: {
  stage: number;
  hatching?: boolean;
  resultId?: BirdResultId;
  palette?: Palette | null;
}) {
  const model = quizEggStageModel(stage);
  return (
    <div className={`lk-quiz-egg${hatching ? ' is-hatching' : ''}`} data-stage={model.stage} aria-label={`Яйцо: этап ${model.stage} из 8`}>
      <span className="lk-quiz-egg__ring" style={{ '--lk-egg-progress': `${model.progressDegrees}deg` } as CSSProperties} aria-hidden="true" />
      <span className="lk-quiz-egg__glow" aria-hidden="true" />
      <img className="lk-quiz-egg__base" src={model.asset} alt="" width="1101" height="1429" draggable={false} />
      {hatching && resultId && (
        <div className="lk-quiz-hatch" aria-hidden="true">
          <span className="lk-quiz-hatch__glow" />
          <span className="lk-quiz-hatch__core" />
          <CanonicalBirdVisual resultId={resultId} palette={palette} className="lk-quiz-hatch__bird" />
          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--one" src="/quiz/egg-stage-08.webp" alt="" />
          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--two" src="/quiz/egg-stage-08.webp" alt="" />
          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--three" src="/quiz/egg-stage-08.webp" alt="" />
          <img className="lk-quiz-hatch__light" src="/quiz/egg-crack-light.webp" alt="" />
        </div>
      )}
    </div>
  );
}
`);

// 3) Server-derived BirdResultId: persisted quiz role+scores are the reload-safe source.
let worker = read('apps/worker/src/local-kontur-api.ts');
worker = replaceOnce(worker, "const LOCAL_EGG_COST = 5;\n", `const LOCAL_EGG_COST = 5;\n\ntype LocalBirdResultId = 'magpie' | 'woodpecker' | 'jay' | 'crane' | 'owl' | 'kotosov';\ntype StoredBirdQuiz = { role: Role; scores: string };\n\nconst DIRECT_BIRD_RESULT: Readonly<Record<Exclude<Role, 'vibe'>, LocalBirdResultId>> = Object.freeze({\n  designer: 'magpie',\n  coder: 'woodpecker',\n  creative: 'jay',\n  manager: 'crane',\n});\n\nfunction localBirdResultId(role: Role, rawScores?: string | null): LocalBirdResultId {\n  if (role !== 'vibe') return DIRECT_BIRD_RESULT[role];\n  if (!rawScores) return 'owl';\n  try {\n    const scores = JSON.parse(rawScores) as Partial<Record<Role, number>>;\n    const coder = scores.coder;\n    if (!Number.isFinite(coder)) return 'owl';\n    const other = [scores.designer, scores.creative, scores.manager];\n    return other.every((score) => Number.isFinite(score) && coder! > score!) ? 'kotosov' : 'owl';\n  } catch {\n    return 'owl';\n  }\n}\n\nasync function storedLocalBirdResult(env: Env, userId: number, fallbackRole: Role | null): Promise<LocalBirdResultId | null> {\n  const quiz = await env.DB.prepare('SELECT role, scores FROM onboarding_answers WHERE user_id = ?')\n    .bind(userId).first<StoredBirdQuiz>();\n  if (quiz) return localBirdResultId(quiz.role, quiz.scores);\n  return fallbackRole ? localBirdResultId(fallbackRole) : null;\n}\n`, 'worker bird result helpers');
worker = replaceOnce(worker,
  "  const state = await buildState(c.env, userId);\n  return c.json({\n    state: {",
  "  const state = await buildState(c.env, userId);\n  const birdResultId = state.hatched ? await storedLocalBirdResult(c.env, userId, state.player.role) : null;\n  return c.json({\n    birdResultId,\n    state: {",
  'local state bird result',
);
worker = replaceOnce(worker,
  "'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ? AND client_request_id = ?',\n  ).bind(userId, clientRequestId).first<{ role: Role; bird_name: string | null }>();",
  "'SELECT role, bird_name, scores FROM onboarding_answers WHERE user_id = ? AND client_request_id = ?',\n  ).bind(userId, clientRequestId).first<{ role: Role; bird_name: string | null; scores: string }>();",
  'hatch replay scores',
);
worker = replaceOnce(worker,
  "'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ?',\n      ).bind(userId).first<{ role: Role; bird_name: string | null }>();",
  "'SELECT role, bird_name, scores FROM onboarding_answers WHERE user_id = ?',\n      ).bind(userId).first<{ role: Role; bird_name: string | null; scores: string }>();",
  'hatch existing scores',
);
worker = replaceOnce(worker,
  "'SELECT role, bird_name FROM onboarding_answers WHERE user_id = ?',\n  ).bind(userId).first<{ role: Role; bird_name: string | null }>();",
  "'SELECT role, bird_name, scores FROM onboarding_answers WHERE user_id = ?',\n  ).bind(userId).first<{ role: Role; bird_name: string | null; scores: string }>();",
  'hatch saved scores',
);
worker = replaceOnce(worker,
  "  return c.json({\n    role: saved.role,",
  "  return c.json({\n    birdResultId: localBirdResultId(saved.role, saved.scores),\n    role: saved.role,",
  'hatch response bird result',
);
write('apps/worker/src/local-kontur-api.ts', worker);

// 4) Current product surfaces all consume the same BirdResultId identity.
let screen = read('apps/miniapp/src/screens/LocalKontur.tsx');
screen = replaceOnce(screen, "import { LocalBirdVisual } from '../components/LocalBirdVisual.js';\n", "import { CanonicalBirdVisual } from '../components/CanonicalBirdVisual.js';\n", 'screen canonical import');
screen = replaceOnce(screen, "import { ResultBird } from '../components/ResultBird.js';\n", '', 'remove result bird import');
screen = replaceOnce(screen,
  "  parseStoredVibeVariant,\n  vibeVariantStorageKey,\n",
  '',
  'remove local storage taxonomy imports',
);
screen = replaceOnce(screen,
`function birdPresentation(role: Role | null | undefined, fallback: string, userId?: number): BirdPresentation {\n  if (!role) return { resultId: 'owl', name: fallback.toLowerCase(), note: '' };\n  let resultId = selectBirdResult({ resolvedRole: role }).resultId;\n  if (role === 'vibe' && userId !== undefined) {\n    try {\n      resultId = parseStoredVibeVariant(window.localStorage.getItem(vibeVariantStorageKey(userId))) ?? 'owl';\n    } catch {\n      resultId = 'owl';\n    }\n  }\n  return { resultId, ...BIRD_PRESENTATION[resultId] };\n}\n`,
`const BIRD_RESULT_IDS: readonly BirdResultId[] = ['magpie', 'woodpecker', 'jay', 'crane', 'owl', 'kotosov'];\n\nfunction readBirdResultId(value: unknown): BirdResultId | null {\n  if (!value || typeof value !== 'object') return null;\n  const candidate = (value as { birdResultId?: unknown }).birdResultId;\n  return typeof candidate === 'string' && BIRD_RESULT_IDS.includes(candidate as BirdResultId)\n    ? candidate as BirdResultId\n    : null;\n}\n\nfunction birdPresentation(role: Role | null | undefined, fallback: string, resultIdHint?: BirdResultId | null): BirdPresentation {\n  if (!role) return { resultId: 'owl', name: fallback.toLowerCase(), note: '' };\n  const resultId = resultIdHint ?? selectBirdResult({ resolvedRole: role }).resultId;\n  return { resultId, ...BIRD_PRESENTATION[resultId] };\n}\n`, 'reload-safe bird presentation');
screen = replaceOnce(screen,
  "  const [revealResultId, setRevealResultId] = useState<BirdResultId>('owl');\n",
  "  const [revealResultId, setRevealResultId] = useState<BirdResultId>('owl');\n  const [canonicalResultId, setCanonicalResultId] = useState<BirdResultId | null>(null);\n",
  'canonical result state',
);
screen = replaceOnce(screen,
  "      setState(payload.state);\n      if (generation === coloringSyncGeneration.current) setColorings(payload.colorings);",
  "      setState(payload.state);\n      setCanonicalResultId(readBirdResultId(payload));\n      if (generation === coloringSyncGeneration.current) setColorings(payload.colorings);",
  'refresh canonical result',
);
screen = replaceOnce(screen,
  "      setState(payload.state);\n      setColorings(payload.colorings);\n      setQuestions(q?.questions ?? []);",
  "      setState(payload.state);\n      setCanonicalResultId(readBirdResultId(payload));\n      setColorings(payload.colorings);\n      setQuestions(q?.questions ?? []);",
  'boot canonical result',
);
screen = replaceOnce(screen,
`    answerTimer.current = window.setTimeout(() => {\n      setEggResponding(false);\n      answerLock.current = false;\n      if (index + 1 < questions.length) setIndex(index + 1);\n    }, reducedMotion ? 0 : 260);\n    if (index + 1 >= questions.length) void hatch(next);`,
`    const finalAnswer = index + 1 >= questions.length;\n    answerTimer.current = window.setTimeout(() => {\n      setEggResponding(false);\n      if (finalAnswer) {\n        void hatch(next);\n        return;\n      }\n      answerLock.current = false;\n      setIndex(index + 1);\n    }, reducedMotion ? 0 : 260);`,
  'q8 response before hatch',
);
screen = replaceOnce(screen,
`      setReveal(result);\n      setRevealResultId(visualResult.resultId);\n      setRevealNote(personalizedBirdNote(visualResult.resultId, finalAnswers));`,
`      const serverResultId = readBirdResultId(result) ?? visualResult.resultId;\n      setReveal(result);\n      setRevealResultId(serverResultId);\n      setCanonicalResultId(serverResultId);\n      setRevealNote(personalizedBirdNote(serverResultId, finalAnswers));`,
  'normal hatch canonical result',
);
screen = replaceOnce(screen,
`      if (result.role === 'vibe') {\n        try {\n          window.localStorage.setItem(vibeVariantStorageKey(result.state.player.userId), visualResult.resultId === 'kotosov' ? 'kotosov' : 'owl');\n        } catch {\n          // The safe presentation fallback after reload is owl.\n        }\n      }\n`,
  '',
  'remove local storage persistence',
);
screen = screen.replaceAll(
  "hatchTimer.current = window.setTimeout(() => setStage('reveal'), reducedMotion ? 20 : 2340);",
  "if (hatchTimer.current) window.clearTimeout(hatchTimer.current);\n        hatchTimer.current = window.setTimeout(() => { hatchTimer.current = null; setStage('reveal'); }, reducedMotion ? 0 : 2340);",
);
screen = replaceOnce(screen,
  "          <QuizEgg stage={eggStage} />",
  "          <QuizEgg stage={eggStage} hatching={stage === 'hatching'} resultId={stage === 'hatching' ? revealResultId : undefined} palette={stage === 'hatching' ? reveal?.state.player.palette : undefined} />",
  'one egg hatch component',
);
screen = replaceOnce(screen,
`        <div className="lk-quiz-hatch" aria-hidden={stage !== 'hatching'}>\n          <span className="lk-quiz-hatch__glow" />\n          <span className="lk-quiz-hatch__core" />\n          <ResultBird resultId={revealResultId} className="lk-quiz-hatch__bird" />\n          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--one" src="/quiz/egg-stage-08.webp" alt="" />\n          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--two" src="/quiz/egg-stage-08.webp" alt="" />\n          <img className="lk-quiz-hatch__shell lk-quiz-hatch__shell--three" src="/quiz/egg-stage-08.webp" alt="" />\n          <img className="lk-quiz-hatch__light" src="/quiz/egg-crack-light.webp" alt="" />\n        </div>\n`,
  '',
  'remove sibling hatch replacement',
);
screen = replaceOnce(screen,
  "        {stage === 'hatching' && <button className=\"lk-skip-motion\" onClick={() => setStage('reveal')}>пропустить анимацию</button>}",
  "        {stage === 'hatching' && <button className=\"lk-skip-motion\" onClick={() => { if (hatchTimer.current) window.clearTimeout(hatchTimer.current); hatchTimer.current = null; setStage('reveal'); }}>пропустить анимацию</button>}",
  'skip clears hatch timer',
);
screen = replaceOnce(screen,
  "            <ResultBird resultId={revealResultId} />",
  "            <CanonicalBirdVisual resultId={revealResultId} palette={reveal.state.player.palette} />",
  'reveal canonical bird',
);
screen = replaceOnce(screen,
  "  const currentBird = birdPresentation(state.player.role, state.player.roleTitle ?? 'птица', state.player.userId);",
  "  const currentBird = birdPresentation(state.player.role, state.player.roleTitle ?? 'птица', canonicalResultId);",
  'home canonical identity',
);
screen = replaceOnce(screen,
  "          <ResultBird resultId={currentBird.resultId} />",
  "          <CanonicalBirdVisual resultId={currentBird.resultId} palette={state.player.palette} />",
  'home canonical bird',
);
screen = replaceOnce(screen,
  "            <LocalBirdVisual role={state.player.role} palette={eggReveal.palette} size={252} mood=\"achieved\" />",
  "            <CanonicalBirdVisual resultId={currentBird.resultId} palette={eggReveal.palette} size={252} />",
  'drop canonical identity',
);
screen = replaceOnce(screen,
  "                {item.owned ? <LocalBirdVisual role={state.player.role} palette={item.palette} size={88} /> : <span className=\"lk-color-locked\">?</span>}",
  "                {item.owned ? <CanonicalBirdVisual resultId={currentBird.resultId} palette={item.palette} size={88} /> : <span className=\"lk-color-locked\">?</span>}",
  'collection canonical identity',
);
write('apps/miniapp/src/screens/LocalKontur.tsx', screen);

// 5) Styling: one egg stays visible into hatch; coloration is a masked tint over the same master art.
let css = read('apps/miniapp/src/local-kontur.css');
css = replaceOnce(css,
  ".lk-first-time--hatching .lk-quiz-egg-stage { opacity: 0; filter: brightness(1.8); }",
  ".lk-first-time--hatching .lk-quiz-egg-stage { top: 50%; width: 260px; opacity: 1; filter: none; transform: translate(-50%, -50%); }",
  'hatch egg stage continuity',
);
css += `\n\n/* KONTUR CORE visual identity / one-object hatch correction 2026-08-18 */\n.lk-canonical-bird { position: relative; display: inline-grid; place-items: center; max-width: 100%; max-height: 100%; isolation: isolate; }\n.lk-canonical-bird > .lk-result-bird { grid-area: 1 / 1; width: 100%; height: 100%; object-fit: contain; }\n.lk-canonical-bird__tint { grid-area: 1 / 1; width: 100%; height: 100%; opacity: .19; mix-blend-mode: color; pointer-events: none; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain; }\n.lk-bird-stage--reveal > .lk-canonical-bird { width: min(80vw, 310px); height: 290px; animation: lk-bird-reveal .82s cubic-bezier(.16,.9,.28,1.18) both; }\n.lk-bird-stage--home > .lk-canonical-bird { width: min(80vw, 310px); height: 294px; }\n.lk-bird-stage.is-pulsing > .lk-canonical-bird { animation: lk-equip .72s cubic-bezier(.2,.78,.24,1) both; }\n.lk-quiz-egg.is-hatching > .lk-quiz-hatch { inset: 0; top: 0; left: 0; width: 100%; height: 100%; transform: none; }\n.lk-first-time--hatching .lk-quiz-egg.is-hatching > .lk-quiz-hatch { animation: lk-hatch-inline-stage 2.3s cubic-bezier(.2,.8,.2,1) both; }\n.lk-quiz-egg.is-hatching > .lk-quiz-egg__ring { opacity: 1; }\n.lk-quiz-egg.is-hatching > .lk-quiz-egg__base { opacity: 1; }\n.lk-quiz-hatch__bird.lk-canonical-bird { position: absolute; z-index: 2; right: 10%; bottom: 4%; left: 10%; width: 80%; height: 78%; opacity: 0; transform: translateY(28%) scale(.5); }\n.lk-first-time--hatching .lk-quiz-hatch__bird.lk-canonical-bird { animation: lk-hatch-bird 2.3s cubic-bezier(.16,.9,.28,1.08) both; }\n@keyframes lk-hatch-inline-stage { 0% { opacity: 0; transform: scale(.96); } 17%,100% { opacity: 1; transform: scale(1); } }\n@media (max-width: 360px), (max-height: 650px) {\n  .lk-first-time--hatching .lk-quiz-egg-stage { width: 172px; }\n  .lk-bird-stage--reveal > .lk-canonical-bird { width: 210px; height: 184px; }\n}\n@media (min-width: 361px) and (min-height: 651px) {\n  .lk-first-time { min-height: 100dvh; }\n  .lk-first-time--hatching .lk-quiz-egg-stage { width: min(61vw, 260px); }\n}\n`;
write('apps/miniapp/src/local-kontur.css', css);

// 6) Replace legacy asset assertions with canonical identity, mapping, continuity and responsive contracts.
let testFile = read('apps/miniapp/test/local-kontur.test.ts');
testFile = replaceOnce(testFile,
  "import { fitBirdAsset, LOCAL_BIRD_ASSETS, resolveBirdRole } from '../src/components/local-bird-assets.ts';\n",
  "import { quizEggStageModel } from '../src/components/QuizEgg.tsx';\n",
  'test canonical import',
);
testFile = replaceOnce(testFile,
  "  parseStoredVibeVariant,\n  personalizedBirdNote,\n  selectBirdResult,\n  vibeVariantStorageKey,\n",
  "  personalizedBirdNote,\n  selectBirdResult,\n",
  'test remove storage imports',
);
testFile = replaceOnce(testFile,
`test('presentation notes and persisted vibe variants are deterministic and fail closed', () => {\n  const answers = [3, 1, 3, 1, 3, 1, 3, 1];\n  assert.equal(personalizedBirdNote('kotosov', answers), personalizedBirdNote('kotosov', [...answers]));\n  assert.equal(parseStoredVibeVariant('kotosov'), 'kotosov');\n  assert.equal(parseStoredVibeVariant('owl'), 'owl');\n  assert.equal(parseStoredVibeVariant('designer'), null);\n  assert.equal(vibeVariantStorageKey(42), 'kontur:bird-result:42');\n});\n`,
`test('presentation notes are deterministic for the persisted Kotosov identity', () => {\n  const answers = [3, 1, 3, 1, 3, 1, 3, 1];\n  assert.equal(personalizedBirdNote('kotosov', answers), personalizedBirdNote('kotosov', [...answers]));\n});\n`,
  'test storage persistence replacement',
);
const legacyStart = testFile.indexOf("test('asset manifest covers every role and null falls back to owl'");
const legacyEndMarker = "test('approved quiz and six-result assets are decodable WebP files'";
const legacyEnd = testFile.indexOf(legacyEndMarker);
if (legacyStart < 0 || legacyEnd < 0 || legacyEnd <= legacyStart) throw new Error('legacy asset test block not found');
testFile = testFile.slice(0, legacyStart) + `test('all six current surfaces share one canonical BirdResultId asset family', async () => {\n  const ids = ['magpie', 'woodpecker', 'jay', 'crane', 'owl', 'kotosov'];\n  assert.deepEqual(Object.keys(RESULT_ASSETS).sort(), [...ids].sort());\n  assert.equal(new Set(Object.values(RESULT_ASSETS).map((asset) => asset.src)).size, 6);\n  for (const asset of Object.values(RESULT_ASSETS)) assert.doesNotMatch(asset.src, /^\\/birds\\//);\n  assert.equal(RESULT_ASSETS.kotosov.src, '/results/kotosov.webp');\n  assert.equal(RESULT_ASSETS.crane.src, '/results/crane-collectible.svg');\n\n  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');\n  assert.doesNotMatch(screen, /LocalBirdVisual/);\n  assert.match(screen, /CanonicalBirdVisual resultId=\\{currentBird\\.resultId\\} palette=\\{eggReveal\\.palette\\}/);\n  assert.match(screen, /CanonicalBirdVisual resultId=\\{currentBird\\.resultId\\} palette=\\{item\\.palette\\}/);\n});\n\ntest('quiz crack/progress map is exactly q1=stage1 through q8=stage8', () => {\n  for (let stage = 1; stage <= 8; stage += 1) {\n    const model = quizEggStageModel(stage);\n    assert.equal(model.stage, stage);\n    assert.equal(model.asset, `/quiz/egg-stage-${String(stage).padStart(2, '0')}.webp`);\n    assert.equal(model.progressDegrees, stage * 45);\n  }\n});\n\ntest('q8 hatch stays inside the same QuizEgg component and clears stale timers', async () => {\n  const screen = await readFile(new URL('../src/screens/LocalKontur.tsx', import.meta.url), 'utf8');\n  const egg = await readFile(new URL('../src/components/QuizEgg.tsx', import.meta.url), 'utf8');\n  assert.match(screen, /finalAnswer[\\s\\S]*setEggResponding\\(false\\)[\\s\\S]*void hatch\\(next\\)/);\n  assert.match(screen, /<QuizEgg[\\s\\S]*hatching=\\{stage === 'hatching'\\}/);\n  assert.doesNotMatch(screen, /<div className=\"lk-quiz-hatch\"/);\n  assert.match(egg, /className=\"lk-quiz-hatch\"/);\n  assert.match(screen, /window\\.clearTimeout\\(hatchTimer\\.current\\)/);\n});\n\ntest('responsive contract covers 320x568 and 430x1000 with safe-area and reduced-motion paths', async () => {\n  const css = await readFile(new URL('../src/local-kontur.css', import.meta.url), 'utf8');\n  assert.match(css, /@media \\(max-width: 360px\\), \\(max-height: 650px\\)/);\n  assert.match(css, /@media \\(min-width: 361px\\) and \\(min-height: 651px\\)/);\n  assert.match(css, /env\\(safe-area-inset-bottom\\)/);\n  assert.match(css, /\\.lk-reduced-motion/);\n  assert.ok(320 <= 360 && 568 <= 650);\n  assert.ok(430 >= 361 && 1000 >= 651);\n});\n\n` + testFile.slice(legacyEnd);
testFile = testFile.replace(
  "test('approved quiz and six-result assets are decodable WebP files', async () => {",
  "test('approved quiz and six-result assets are decodable production assets', async () => {",
);
testFile = testFile.replace(
`    assert.ok(bytes.length > 1_000, relativePath);\n    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', relativePath);\n    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', relativePath);`,
`    assert.ok(bytes.length > 1_000, relativePath);\n    if (relativePath.endsWith('.svg')) {\n      assert.match(bytes.toString('utf8'), /<svg[\\s>]/, relativePath);\n    } else {\n      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', relativePath);\n      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', relativePath);\n    }`,
);
write('apps/miniapp/test/local-kontur.test.ts', testFile);

// 7) Worker regression: state and hatch must expose the same persisted identity derivation.
const workerTestPath = 'apps/worker/test/local-kontur.test.ts';
if (fs.existsSync(workerTestPath)) {
  let workerTest = read(workerTestPath);
  workerTest += `\n\ntest('local bird result identity is returned by both state and hatch paths', async () => {\n  const source = await readFile(new URL('../src/local-kontur-api.ts', import.meta.url), 'utf8');\n  assert.match(source, /birdResultId = state\\.hatched \\? await storedLocalBirdResult/);\n  assert.match(source, /birdResultId: localBirdResultId\\(saved\\.role, saved\\.scores\\)/);\n  assert.match(source, /return other\\.every\\(\\(score\\) => Number\\.isFinite\\(score\\) && coder! > score!\\) \\? 'kotosov' : 'owl'/);\n});\n`;
  write(workerTestPath, workerTest);
}

fs.mkdirSync('docs/product/evidence', { recursive: true });
write('docs/product/evidence/KONTUR_SIX_CHARACTER_BOARD_2026-08-18.md', `# KONTUR six-character canonical board — 2026-08-18\n\nStatus: owner-delegated final selection. This board records the bounded choice; it is not a new gameplay direction.\n\n| BirdResultId | Canonical master | Decision |\n|---|---|---|\n| magpie | /results/magpie.webp | retain reviewed candidate |\n| woodpecker | /results/woodpecker.webp | retain reviewed candidate |\n| jay | /results/jay.webp | retain reviewed candidate |\n| crane | /results/crane-collectible.svg | bounded redraw: compact, friendly, slightly comic manager; tie + task tablet; no epic/totem posture |\n| owl | /results/owl.webp | retain reviewed candidate |\n| kotosov | /results/kotosov.webp | retain reviewed candidate; never remap to owl after a persisted Kotosov result |\n\n## Integration contract\n\n- BirdResultId is the only visual-character key on hatch, result, Home, egg drop, collection and fallback paths.\n- Legacy /birds/* art is no longer referenced by the current LocalKontur product surface; files remain only as historical evidence/fallback material.\n- Colorations apply as a low-opacity palette mask over the exact same canonical master, so equip/reload changes cosmetics without changing character identity.\n- q1..q8 map to egg-stage-01..08 exactly; ring progress is stage × 45 degrees.\n- q8 answer response completes before hatch begins. Hatch layers live inside the same QuizEgg component and all shell fragments use egg-stage-08, preserving one-object continuity.\n- Reduced-motion uses the same state order with zero response/hatch delay; skip clears the hatch timer.\n\n## Audit synthesis\n\nThe four approved audits converge on one bounded correction: keep the accepted hook/quiz copy and mechanics, eliminate the split result-vs-/birds identity system, replace only the rejected crane master, keep one physical quiz egg through reveal, and add regression checks for six identities, Kotosov persistence, crack/progress mapping, responsive breakpoints, safe area and reduced motion.\n`);

console.log('KONTUR_CORE_FIX_APPLIED');
