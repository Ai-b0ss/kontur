export type HatchPhase = 'idle' | 'pulse' | 'cracks' | 'flash' | 'reveal' | 'settled';

export type HatchTimings = {
  pulse: number;
  cracks: number;
  flash: number;
  flashOut: number;
  reveal: number;
};

const NORMAL_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 400,
  cracks: 400,
  flash: 250,
  flashOut: 250,
  reveal: 500,
});

const REDUCED_HATCH_TIMINGS: Readonly<HatchTimings> = Object.freeze({
  pulse: 80,
  cracks: 80,
  flash: 80,
  flashOut: 160,
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
