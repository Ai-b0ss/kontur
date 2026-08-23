export type HatchPhase = 'idle' | 'pulse' | 'cracks' | 'flash' | 'reveal' | 'settled';

export type HatchTimings = {
  pulse: number;
  cracks: number;
  flash: number;
  flashOut: number;
  reveal: number;
};

// Normal path: 0.0–0.6 tension, 0.6–0.8 radial flash,
// 0.8–1.4 spring reveal. If the result image is not decoded by 0.6s,
// the tension phase safely extends instead of flashing to an empty frame.
const NORMAL_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 300,
  cracks: 300,
  flash: 200,
  flashOut: 120,
  reveal: 600,
});

const REDUCED_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 60,
  cracks: 60,
  flash: 80,
  flashOut: 80,
  reveal: 220,
});

export function hatchTimings(reducedMotion: boolean): Readonly<HatchTimings> {
  return reducedMotion ? REDUCED_HATCH_TIMINGS : NORMAL_HATCH_TIMINGS;
}

export function shouldEnterQ8Hatching(
  stage: string,
  gesturePending: boolean,
  quizComplete: boolean,
): boolean {
  return stage === 'questions' && !gesturePending && quizComplete;
}

export function canBeginHatchFlash(
  phase: HatchPhase,
  minimumTimelineElapsed: boolean,
  resultReady: boolean,
  birdAssetReady: boolean,
): boolean {
  return phase === 'cracks' && minimumTimelineElapsed && resultReady && birdAssetReady;
}

export function shouldBlockQuizAnswer(
  gestureLocked: boolean,
  actionLocked: boolean,
  busy: boolean,
): boolean {
  return gestureLocked || actionLocked || busy;
}
