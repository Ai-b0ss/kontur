# KONTUR — FINAL HOOK / QUIZ / MOTION ALIGNMENT SPEC

## STATUS

This is the current owner-approved product brief after:
- original 02–09 Aug sources,
- owner v84 smoke,
- 13 Aug Igor ↔ zezokuk call,
- written 6-point confirmation after the call,
- latest hand/bird/memness clarifications.

**Baseline: v84**
Version ID: `ab3cce08-12a0-4fa7-879b-9f6bbe838076`

This is NOT a full product rewrite.

---

## 0. PRODUCT INTENT

Mini App default entry must work as a standalone hook even for someone who does not know the specific chat.

Default experience:

`HOOK → 8Q QUIZ → BIRD RESULT → /worm/SOCIAL CONNECTION → HOME`

Community onboarding is a separate contextual branch.

The desired first thought is:
`интересно, какая я птица?`

not:
`сейчас мне объяснят историю чужого чата`.

---

## 1. DEFAULT ROUTING

Remove current 3 community screens from **mandatory default first-time entry**.

DO NOT delete them from source.
Preserve them for a future/contextual community-onboarding branch.

Do not add a literal `я новенький / я старенький` selector in this pass.
Do not build a new segmentation backend.

---

## 2. P0 HOOK SCREEN

The current pre-quiz screen must become the strongest visual screen of the first-time experience.

zezokuk's explicit headline:

# `Какая ты птица в IT?`

Hero:
# large beautiful egg

Target feeling:
- hooky;
- visually rich;
- ad/poster-like;
- instantly understandable;
- not overloaded.

Suggested information hierarchy:
1. `Какая ты птица в IT?`
2. large hero egg
3. short promise such as `8 коротких вопросов — и узнаешь`
4. CTA `начать`

Do not explain:
- chat history;
- `/worm`;
- worms/economy;
- color collection;
on this screen.

Make 2–3 natural short copy variants only if necessary, then pick one for the mock.
Do not wander into copy research.

---

## 3. HOOK → QUIZ CONTINUITY

On `начать`, the hero egg must not disappear.

Prototype one continuous transition:

`large hero egg → shrink/move → quiz egg position`

The user should clearly feel it is the same object.

Requirements:
- short;
- smooth;
- visible;
- no loading feeling;
- reduced-motion fallback.

Prefer normal DOM/CSS motion unless another already-existing project technique is clearly better.

---

## 4. QUIZ CONTENT — KEEP

Keep current v84 8-question presentation copy.

Do not change:
- question count;
- option semantics/indexes;
- weights;
- `resolveRole`;
- backend scoring.

Current approved language includes:
- `тебе кинули идею. что первым делом?`
- `что бесит сильнее?`
- `в чате уже полчаса спорят. ты где?`
- `завтра дедлайн. готова половина`

Do not regress to repeated corporate/AI answer copy.

---

## 5. P0 QUIZ EGG — PROGRESSIVE PHYSICAL CRACKING

v84 already has egg progress but it is too subtle.
The owner explicitly noticed that the egg does not really crack during the quiz.

New requirement:
**the egg itself must visibly approach opening over the 8 answers.**

Example progression, not mandatory exact geometry:

1/8 — intact/calm  
2/8 — slight inner light/tension  
3/8 — first tiny hairline  
4/8 — crack becomes readable  
5/8 — extra branch  
6/8 — clear growth  
7/8 — near-open tension  
8/8 — maximum pre-reveal state

After an answer, optional short micro-response:
- tiny shake;
- pulse;
- crack flash;
- glow response.

Do not use:
- confetti;
- casino FX;
- cartoon bouncing;
- random explosion noise.

The progress must be readable from the egg itself, not only its ring.

### Semantic boundary
Quiz egg = visual progress object.
Real reward egg = reward after 5 worms.

Do not write copy implying quiz answers earn the real worm egg.

---

## 6. VISUAL RETENTION

zezokuk's criterion:
the process itself should be sticky/fun to watch.

Review as one motion system:
- hook entrance;
- CTA response;
- egg transfer;
- stage/question entrance;
- option selection;
- progress line;
- egg response/crack;
- q-to-q transition;
- pre-result tension.

Do not animate everything independently.
One coherent motion language.

---

## 7. WHITE GLOVE HAND — DEFERRED

Historical concept:
- white-gloved offscreen hand puts down the egg;
- brings question plaques;
- finally hits/throws the egg.

After the latest discussion zezokuk explicitly said it is too difficult/mutorno without a motion designer and does not call for it now.

**DO NOT IMPLEMENT THE HAND IN THIS PASS.**

Keep it as a future motion-designer concept only.

---

## 8. BIRD REVEAL

Keep:
- large bird;
- bird name;
- existing deterministic personalized short description based on the 8 answers;
- no internal English role label.

Strengthen only as needed so it pays off the headline `Какая ты птица в IT?`.

The reveal should first say emotionally:
`вот твоя птица`

Do not immediately bury the bird under tutorial copy.

---

## 9. /WORM + CHAT CONNECTION

After the bird result, preserve the compact loop:

`/worm → +1 worm → 5 → egg → new coloration`

Human copy:
if someone's message genuinely helped, reply to that message with `/worm`.

No `reply-спасибо` technical jargon.

The chat is downstream/social connection, not mandatory lore before the quiz.

Do not build a new major share/community system in this pass.
Any real sharing mechanic requiring new backend/API is a separate hypothesis.

---

## 10. BIRD CHARACTER / MEMNESS — SEPARATE VISUAL SUB-GATE

Latest zezokuk feedback:
the birds are already cool but too serious.
He wants more memness/character.

New rule:
**bird = readable IT archetype, not just a beautiful species illustration.**

Current taxonomy stays:
- designer → magpie
- coder → woodpecker
- creative → jay
- manager → crane
- vibe → owl

Do not replace all five in this implementation pass.

First produce `BIRD_CHARACTER_DIRECTION.md`:
for each role:
- what kind of IT person it represents;
- 2–3 visual personality traits;
- how much memness is appropriate;
- what is already strong in the current asset;
- what feels too serious/generic.

Then make at most 1–2 REAL UI visual concepts.

### Meowl / Котосов
Owner suggested Meowl; zezokuk immediately labeled it `вайбкодер` and approved the direction.

Status:
`Meowl/Kotosov → vibe/вайбкодер = approved art/personality candidate`.

The found internet image is REFERENCE ONLY unless usage rights are proven.
If moving toward production, make an original inspired character/asset, not a direct copy.

### Money Birds / ugly birds / Angry Birds
Mood references only:
character, exaggeration, memetic readability.
Do not copy their art style or assets.

---

## 11. REAL REWARD EGG / HATCH

Preserve current real 5-worm reward flow:

`listen → crack → open/light → coloration → collection → equip`

Do not redesign this from scratch.
It can share the new crack/motion language with the quiz egg.

---

## 12. CURRENT VISUAL LANGUAGE — KEEP

Keep the current base:
- graphite/black;
- editorial;
- cyan contour/interface;
- violet egg;
- lime `/worm`;
- large typography;
- restrained palette;
- one hero per screen;
- minimal SaaS-card feel.

The call explicitly liked the current general design / CU-like feel.

This is an alignment pass:
add hook, motion, character.
Not a wholesale art redesign.

---

## 13. MOBILE FIRST

Required:
- 430×1000
- 320×568

Especially check:
- `Какая ты птица в IT?`
- hero egg
- egg shrink transition
- q1/q4/q8
- long question wrapping
- bird reveal

No:
- collisions
- clipped headlines
- horizontal overflow
- unreadable helper text

---

## 14. TECHNICAL BOUNDARY

DO NOT CHANGE:
- backend;
- D1 schema/data;
- Telegram config;
- scoring;
- role taxonomy;
- `/worm` semantics/anti-abuse;
- real egg cost;
- guaranteed-new coloration;
- equip persistence.

DO NOT:
- reset D1 again;
- repeat backend recovery;
- repeat Wrangler root-cause;
- repeat `spo.zip` forensic;
- use old dirty repo as baseline.

---

## 15. EXECUTION ORDER — MANDATORY VISUAL GATES

### STEP A — HOOK CONCEPT ONLY
Create a real UI mock in the current app language:
`Какая ты птица в IT?` + large hero egg.

No production implementation beyond what is needed for the real mock.

**STOP FOR OWNER VISUAL APPROVAL.**

### STEP B — MOTION PROTOTYPE
After approval:
hero egg → shrink/move → q1 egg.

Produce WebM.

### STEP C — PROGRESSIVE CRACKS
Implement/prototype 8 deterministic egg states.
Show q1 / q4 / q8 and WebM.

### STEP D — FULL FIRST-TIME FLOW
Hook → 8Q → personalized bird reveal → `/worm` explanation → Home.

### STEP E — BIRD CHARACTER CONCEPT
Separate from hook/motion code.
1–2 visual concepts maximum before owner approval.

### STEP F — PREVIEW
Only after owner visual approval and normal tests.
One safe undeployed Worker Version.
No traffic switch.

---

## 16. REQUIRED REVIEW ARTIFACTS

Screens:
- `01-hook.png`
- `02-hook-start-before.png`
- `03-quiz-q1.png`
- `04-quiz-q4.png`
- `05-quiz-q8.png`
- `06-bird-reveal.png`
- `07-worm-loop.png`
- `08-home.png`

WebM 1:
hook → start → egg shrink → q1

WebM 2:
q1 → q4 → q8, with visible progressive egg cracking

WebM 3:
q8 → bird reveal

Plus:
`BIRD_CHARACTER_DIRECTION.md`

---

## 17. TESTS

After implementation:
- targeted LocalKontur tests
- relevant full suite
- typecheck
- build with current bird-assets config
- 430×1000 smoke
- 320×568 smoke
- reduced motion
- broken images = 0
- collisions = 0

Regression assertions:
- fresh default user no longer gets mandatory community 01–03 before hook;
- community screens still exist as non-default branch/source;
- 8 questions still exact;
- scoring unchanged;
- personalized reveal deterministic;
- internal role labels absent;
- `/worm` mechanics unchanged.

---

## 18. RELEASE CONTRACT

Only after owner approval.

Use existing proven safe preview workflow.

Expected:
- module set `{index.js}`
- backend SHA:
  `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`
- D1 unchanged
- Telegram unchanged
- live deployment unchanged

One `wrangler versions upload`.
No deploy.
No traffic switch.

---

## 19. EXPECTED CHECKPOINT

`HOOK_QUIZ_MOTION_PREVIEW_READY`

Do NOT call it beta-ready automatically.

STOP after preview and owner review.

---

## 20. EXPERIENCE TARGET IN ONE PARAGRAPH

A person receives a link with no context. They see a large beautiful egg and `Какая ты птица в IT?`. They want to know. They press start; the same egg shrinks into the quiz. Eight fast conversational questions follow. After each answer the egg visibly changes and cracks further, creating anticipation. At the end they receive a characteristic, slightly memetic bird that feels connected to their answers. Only then the product explains the social continuation through `/worm`, eggs and colorations inside the community.
