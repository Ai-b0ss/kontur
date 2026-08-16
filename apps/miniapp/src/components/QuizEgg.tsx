export function QuizEgg({ stage }: { stage: number }) {
  const safeStage = Math.max(1, Math.min(8, stage));
  const number = String(safeStage).padStart(2, '0');
  return (
    <div className="lk-quiz-egg" data-stage={safeStage} aria-label={`Яйцо: этап ${safeStage} из 8`}>
      <span className="lk-quiz-egg__ring" style={{ '--lk-egg-progress': `${safeStage * 45}deg` } as CSSProperties} aria-hidden="true" />
      <span className="lk-quiz-egg__glow" aria-hidden="true" />
      <img src={`/quiz/egg-stage-${number}.webp`} alt="" width="1101" height="1429" draggable={false} />
    </div>
  );
}
import type { CSSProperties } from 'react';
