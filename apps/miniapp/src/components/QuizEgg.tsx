import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import type { BirdResultId } from '../result-taxonomy.js';
import { quizEggStageModel } from '../quiz-egg-model.js';
import { CanonicalBirdVisual } from './CanonicalBirdVisual.js';
import '../kontur-core-corrections.css';

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
      <div className="lk-quiz-egg__hatch-shells" aria-hidden="true">
        <img className="lk-quiz-egg__shell lk-quiz-egg__shell--left" src="/quiz/egg-stage-08.webp" alt="" />
        <img className="lk-quiz-egg__shell lk-quiz-egg__shell--right" src="/quiz/egg-stage-08.webp" alt="" />
        <img className="lk-quiz-egg__hatch-light" src="/quiz/egg-crack-light.webp" alt="" />
      </div>
      {hatching && resultId && (
        <div className="lk-quiz-hatch" aria-hidden="true">
          <span className="lk-quiz-hatch__glow" />
          <span className="lk-quiz-hatch__core" />
          <CanonicalBirdVisual resultId={resultId} palette={palette} className="lk-quiz-hatch__bird" />
        </div>
      )}
    </div>
  );
}
