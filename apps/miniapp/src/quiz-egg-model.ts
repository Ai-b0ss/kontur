export interface QuizEggStageModel {
  stage: number;
  asset: string;
  progressDegrees: number;
}

export function quizEggStageModel(stage: number): Readonly<QuizEggStageModel> {
  const safeStage = Math.max(1, Math.min(8, Math.trunc(stage)));
  const number = String(safeStage).padStart(2, '0');
  return Object.freeze({
    stage: safeStage,
    asset: `/quiz/egg-stage-${number}.webp`,
    progressDegrees: safeStage * 45,
  });
}
