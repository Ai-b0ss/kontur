export type HatchPhase = 'idle' | 'pulse' | 'cracks' | 'flash' | 'reveal' | 'settled';

export type HatchTimings = {
  pulse: number;
  cracks: number;
  flash: number;
  flashOut: number;
  reveal: number;
};

const NORMAL_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 500,
  cracks: 500,
  flash: 140,
  flashOut: 300,
  reveal: 400,
});

const REDUCED_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 80,
  cracks: 80,
  flash: 80,
  flashOut: 180,
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
