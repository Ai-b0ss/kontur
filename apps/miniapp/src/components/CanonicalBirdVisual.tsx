import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import type { BirdResultId } from '../result-taxonomy.js';
import { RESULT_ASSETS } from './result-bird-assets.js';

export function CanonicalBirdVisual({
  resultId,
  palette,
  size,
  className = '',
}: {
  resultId: BirdResultId;
  palette?: Palette | null;
  size?: number;
  className?: string;
}) {
  const asset = RESULT_ASSETS[resultId];
  const frameStyle = size ? ({ width: size, height: size } satisfies CSSProperties) : undefined;
  const tintStyle = palette ? ({
    background: `linear-gradient(145deg, ${palette.crest} 0 18%, ${palette.body} 28% 51%, ${palette.wing} 57% 76%, ${palette.tail} 82% 100%)`,
    WebkitMaskImage: `url(${asset.src})`,
    maskImage: `url(${asset.src})`,
  } satisfies CSSProperties) : undefined;

  return (
    <span className={`lk-canonical-bird ${className}`.trim()} style={frameStyle} data-bird-result={resultId}>
      <img
        className="lk-result-bird"
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={asset.label}
        decoding="async"
        draggable={false}
      />
      {palette && <span className="lk-canonical-bird__tint" style={tintStyle} aria-hidden="true" />}
    </span>
  );
}
