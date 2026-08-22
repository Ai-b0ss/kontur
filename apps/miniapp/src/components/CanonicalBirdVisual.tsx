import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import { useState } from 'react';
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
  const [loadedAsset, setLoadedAsset] = useState<string | null>(null);
  const imageReady = loadedAsset === asset.src;
  const frameStyle = size ? ({ width: size, height: size } satisfies CSSProperties) : undefined;
  const tintStyle = palette ? ({
    background: [
      `radial-gradient(circle at 47% 27%, ${palette.crest} 0 10%, transparent 25%)`,
      `radial-gradient(ellipse at 44% 53%, ${palette.belly} 0 18%, transparent 39%)`,
      `linear-gradient(145deg, ${palette.body} 0 27%, ${palette.wing} 38% 66%, ${palette.tail} 76% 91%, ${palette.beak} 100%)`,
    ].join(', '),
    WebkitMaskImage: `url(${asset.src})`,
    maskImage: `url(${asset.src})`,
  } satisfies CSSProperties) : undefined;
  const markImageReady = (image: HTMLImageElement) => {
    const afterPaint = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (image.isConnected) setLoadedAsset(asset.src);
    }));
    void image.decode().then(afterPaint, afterPaint);
  };

  return (
    <span
      className={`lk-canonical-bird${palette ? ' has-coloring' : ''} ${className}`.trim()}
      style={frameStyle}
      data-bird-result={resultId}
      data-image-ready={imageReady ? 'true' : 'false'}
    >
      <img
        className="lk-result-bird"
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={asset.label}
        decoding="async"
        draggable={false}
        onLoad={(event) => markImageReady(event.currentTarget)}
      />
      {palette && imageReady && <span className="lk-canonical-bird__tint" style={tintStyle} aria-hidden="true" />}
    </span>
  );
}
