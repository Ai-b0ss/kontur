import type { LocalBirdAssetProps } from './LocalBirdAsset.js';
import { LocalBirdAsset } from './LocalBirdAsset.js';
import { LocalBird } from './LocalBird.js';

/**
 * The reviewed asset series is now the normal product path. The proven
 * geometric bird remains available only as an explicit emergency fallback.
 */
const ASSET_BIRDS_ENABLED = import.meta.env.VITE_LOCAL_BIRD_ASSETS !== '0';

export function LocalBirdVisual(props: LocalBirdAssetProps) {
  return ASSET_BIRDS_ENABLED ? <LocalBirdAsset {...props} /> : <LocalBird {...props} />;
}
