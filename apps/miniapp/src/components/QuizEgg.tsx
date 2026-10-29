import type { Palette } from '@kontur/contracts';
import { useEffect, type AnimationEvent, type CSSProperties } from 'react';
import { hatchTimings, type HatchPhase, type HatchTimings } from '../q8-hatch-timeline.js';
import type { BirdResultId } from '../result-taxonomy.js';
import { quizEggStageModel } from '../quiz-egg-model.js';
import { CanonicalBirdVisual } from './CanonicalBirdVisual.js';
import { preloadResultBirdAssets } from './result-bird-assets.js';
import '../kontur-core-corrections.css';

export function QuizEgg({
  stage,
  hatchPhase = 'idle',
  resultId,
  palette,
  timings = hatchTimings(false),
  onBirdReady,
  onFlashCovered,
}: {
  stage: number;
  hatchPhase?: HatchPhase;
  resultId?: BirdResultId;
  palette?: Palette | null;
  timings?: Readonly<HatchTimings>;
  onBirdReady?: () => void;
  onFlashCovered?: () => void;
}) {
  const model = quizEggStageModel(stage);
  const hatching = hatchPhase !== 'idle';
  const hatchStyle = {
    '--lk-hatch-pulse': `${timings.pulse}ms`,
    '--lk-hatch-cracks': `${timings.cracks}ms`,
    '--lk-hatch-flash': `${timings.flash}ms`,
    '--lk-hatch-flash-out': `${timings.flashOut}ms`,
    '--lk-hatch-reveal': `${timings.reveal}ms`,
  } as CSSProperties;

  useEffect(() => {
    if (stage >= 6) preloadResultBirdAssets();
  }, [stage]);

  const handleFlashAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== 'lk-hatch-flash-in') return;
    onFlashCovered?.();
  };

  return (
    <div
      className={`lk-quiz-egg${hatching ? ' is-hatching' : ''}`}
      data-stage={model.stage}
      data-hatch-phase={hatchPhase}
      style={hatchStyle}
      aria-label={`Яйцо: этап ${model.stage} из 8`}
    >
      <span
        className="lk-quiz-egg__ring"
        style={{ '--lk-egg-progress': `${model.progressDegrees}deg` } as CSSProperties}
        aria-hidden="true"
      />
      <span className="lk-quiz-egg__glow" aria-hidden="true" />

      <span className="lk-quiz-egg__inner" aria-hidden="true">
        <span className="lk-quiz-egg__light-burst" />

        <img
          className="lk-quiz-egg__base"
          src={model.asset}
          alt=""
          width="1101"
          height="1429"
          draggable={false}
        />
        <img
          className="lk-quiz-egg__cracks"
          src="/quiz/egg-crack-light.webp"
          alt=""
          draggable={false}
        />

        <span className="lk-hatch-halves">
          <span className="lk-hatch-half lk-hatch-half--left">
            <img
              className="lk-hatch-half__image"
              src="/quiz/egg-stage-08.webp"
              alt=""
              draggable={false}
            />
          </span>
          <span className="lk-hatch-half lk-hatch-half--right">
            <img
              className="lk-hatch-half__image"
              src="/quiz/egg-stage-08.webp"
              alt=""
              draggable={false}
            />
          </span>
        </span>

        {hatching && resultId && (
          <span className="lk-quiz-hatch__frame">
            <CanonicalBirdVisual
              resultId={resultId}
              palette={palette}
              className="lk-quiz-hatch__bird"
              onReady={onBirdReady}
            />
          </span>
        )}
      </span>

      {hatching && resultId && (
        <span className="lk-quiz-hatch" aria-hidden="true">
          <span className="lk-quiz-hatch__halo" />
          <span className="lk-quiz-hatch__flash" onAnimationEnd={handleFlashAnimationEnd} />
        </span>
      )}
    </div>
  );
}
