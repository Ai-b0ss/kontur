import type { Palette } from '@kontur/contracts';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { BirdResultId } from '../result-taxonomy.js';
import { resolveResultAsset } from './result-bird-assets.js';

export function CanonicalBirdVisual({
  resultId,
  palette,
  size,
  className = '',
  onReady,
}: {
  resultId: BirdResultId;
  palette?: Palette | null;
  size?: number;
  className?: string;
  onReady?: () => void;
}) {
  const asset = resolveResultAsset(resultId, palette);
  const [loadedAsset, setLoadedAsset] = useState<string | null>(null);
  const readyCallback = useRef(onReady);
  const imageReady = loadedAsset === asset.src;
  const frameStyle = size ? ({ width: size, height: size } satisfies CSSProperties) : undefined;

  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (imageReady) readyCallback.current?.();
  }, [imageReady]);

  const markImageReady = (image: HTMLImageElement) => {
    const afterPaint = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (image.isConnected) setLoadedAsset(asset.src);
    }));
    void image.decode().then(afterPaint, afterPaint);
  };

  return (
    <span
      className={`lk-canonical-bird ${className}`.trim()}
      style={frameStyle}
      data-bird-result={resultId}
      data-plumage-asset={asset.src}
      data-image-ready={imageReady ? 'true' : 'false'}
    >
      <img
        className="lk-result-bird"
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={asset.label}
        decoding="async"
        loading="eager"
        draggable={false}
        onLoad={(event) => markImageReady(event.currentTarget)}
      />
    </span>
  );
}
