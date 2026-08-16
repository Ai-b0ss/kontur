import type { FeatureState } from '@kontur/contracts';

export type Tab = 'profile' | 'community' | 'eggs';

export const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Птица' },
  { key: 'community', label: 'Стая' },
  { key: 'eggs', label: 'Яйца' },
];

export function availableTabs(features: FeatureState): typeof TABS {
  return TABS.filter(
    (item) =>
      (item.key !== 'eggs' || features.eggs) &&
      (item.key !== 'community' || features.community),
  );
}
