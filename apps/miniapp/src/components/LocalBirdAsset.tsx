import { useState } from 'react';
import type { Role } from '@kontur/core';
import type { Palette } from '@kontur/contracts';
import { LocalBird } from './LocalBird.js';
import { fitBirdAsset, LOCAL_BIRD_ASSETS, resolveBirdRole } from './local-bird-assets.js';

export interface LocalBirdAssetProps {
  role: Role | null;
  palette: Palette;
  size?: number;
  mood?: 'calm' | 'ready' | 'active' | 'achieved';
}

/**
 * Candidate raster bird with one controlled coloration zone.
 * Any load failure returns the proven geometry bird instead of a broken image.
 */
export function LocalBirdAsset({ role, palette, size = 240, mood = 'calm' }: LocalBirdAssetProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const actualRole = resolveBirdRole(role);
  const asset = LOCAL_BIRD_ASSETS[actualRole];
  const fit = fitBirdAsset(actualRole, size);

  if (failedSource === asset.src) {
    return <LocalBird role={role} palette={palette} size={size} mood={mood} />;
  }

  return (
    <span
      className={`local-bird-asset local-bird-asset--${mood} local-bird-asset--${actualRole}`}
      style={{ width: fit.boxWidth, height: fit.boxHeight }}
      role="img"
      aria-label={asset.label}
    >
      <span
        className="local-bird-asset__art"
        style={{ width: fit.renderWidth, height: fit.renderHeight }}
      >
        <img
          src={asset.src}
          width={asset.width}
          height={asset.height}
          alt=""
          decoding="async"
          loading={size <= 100 ? 'lazy' : 'eager'}
          draggable="false"
          onError={() => setFailedSource(asset.src)}
        />
        <svg
          className="local-bird-asset__accent"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={asset.accentPath} fill={palette.wing} />
        </svg>
      </span>
    </span>
  );
}
