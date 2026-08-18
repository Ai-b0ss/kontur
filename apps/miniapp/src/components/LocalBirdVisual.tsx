import type { Role } from '@kontur/core';
import type { LocalBirdAssetProps } from './LocalBirdAsset.js';
import type { BirdResultId } from '../result-taxonomy.js';
import { getInitData } from '../telegram.js';
import { CanonicalBirdVisual } from './CanonicalBirdVisual.js';

const DIRECT_RESULT: Readonly<Record<Exclude<Role, 'vibe'>, BirdResultId>> = Object.freeze({
  designer: 'magpie',
  coder: 'woodpecker',
  creative: 'jay',
  manager: 'crane',
});

function telegramUserId(): number | null {
  try {
    const raw = new URLSearchParams(getInitData()).get('user');
    if (!raw) return null;
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === 'number' && Number.isSafeInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function resultForRole(role: Role | null): BirdResultId {
  if (!role) return 'owl';
  if (role !== 'vibe') return DIRECT_RESULT[role];
  const userId = telegramUserId();
  if (userId !== null) {
    try {
      const stored = window.localStorage.getItem(`kontur:bird-result:${userId}`);
      if (stored === 'kotosov' || stored === 'owl') return stored;
    } catch {
      // Generic vibe is the only safe fallback when persisted presentation is unavailable.
    }
  }
  return 'owl';
}

/**
 * Current-product collection/drop renderer. Character identity comes from the
 * same six-result taxonomy as hatch/result/Home; palette only changes cosmetics.
 */
export function LocalBirdVisual({ role, palette, size = 240 }: LocalBirdAssetProps) {
  return <CanonicalBirdVisual resultId={resultForRole(role)} palette={palette} size={size} />;
}
