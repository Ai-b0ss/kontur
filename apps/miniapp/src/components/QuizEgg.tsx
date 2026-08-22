import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import type { HatchPhase } from '../q8-hatch-timeline.js';
import type { BirdResultId } from '../result-taxonomy.js';
import { quizEggStageModel } from '../quiz-egg-model.js';
import { CanonicalBirdVisual } from './CanonicalBirdVisual.js';
import '../kontur-core-corrections.css';

export function QuizEgg({
  stage,
  hatchPhase = 'idle',
  resultId,
  palette,
  onBirdReady,
}: {
  stage: number;
  hatchPhase?: HatchPhase;
  resultId?: BirdResultId;
  palette?: Palette | null;
  onBirdReady?: () => void;
}) {
  const model = quizEggStageModel(stage);
  const hatching = hatchPhase !== 'idle';
  return (
    <div
      className={`lk-quiz-egg${hatching ? ' is-hatching' : ''}`}
      data-stage={model.stage}
      data-hatch-phase={hatchPhase}
      aria-label={`Яйцо: этап ${model.stage} из 8`}
    >
      <span className="lk-quiz-egg__ring" style={{ '--lk-egg-progress': `${model.progressDegrees}deg` } as CSSProperties} aria-hidden="true" />
      <span className="lk-quiz-egg__glow" aria-hidden="true" />
      <img className="lk-quiz-egg__base" src={model.asset} alt="" width="1101" height="1429" draggable={false} />
      <img className="lk-quiz-egg__cracks" src="/quiz/egg-crack-light.webp" alt="" aria-hidden="true" draggable={false} />
      {hatching && resultId && (
        <div className="lk-quiz-hatch" aria-hidden="true">
          <span className="lk-quiz-hatch__halo" />
          <span className="lk-quiz-hatch__flash" />
          <span className="lk-quiz-hatch__frame">
            <CanonicalBirdVisual
              resultId={resultId}
              palette={palette}
              className="lk-quiz-hatch__bird"
              onReady={onBirdReady}
            />
          </span>
        </div>
      )}
    </div>
  );
}
