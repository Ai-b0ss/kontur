export function shouldEnterQ8Hatching(
  stage: string,
  gesturePending: boolean,
  resultReady: boolean,
): boolean {
  return stage === 'questions' && !gesturePending && resultReady;
}

export function shouldBlockQuizAnswer(
  gestureLocked: boolean,
  actionLocked: boolean,
  busy: boolean,
): boolean {
  return gestureLocked || actionLocked || busy;
}
