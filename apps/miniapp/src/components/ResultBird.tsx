import type { BirdResultId } from '../result-taxonomy.js';
import { RESULT_ASSETS } from './result-bird-assets.js';

export function ResultBird({ resultId, className = '' }: { resultId: BirdResultId; className?: string }) {
  const asset = RESULT_ASSETS[resultId];
  return (
    <img
      className={`lk-result-bird ${className}`.trim()}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={asset.label}
      decoding="async"
    />
  );
}
