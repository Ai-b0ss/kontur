import type { BirdResultId, ColoringDto } from '@kontur/contracts';

export function wormWord(value: number) {
  const n = Math.abs(value) % 100;
  const last = n % 10;
  if (n >= 11 && n <= 14) return 'червяков';
  if (last === 1) return 'червяк';
  if (last >= 2 && last <= 4) return 'червяка';
  return 'червяков';
}

export function replayRequested(search = '') {
  return new URLSearchParams(search).get('replay') === '1';
}

export function needsLocalQuestions(
  state: { hatched: boolean } | null | undefined,
  search = '',
) {
  return Boolean(state && (!state.hatched || replayRequested(search)));
}

export type InitialLocalStage = 'hook' | 'community' | 'home';

type PersistedBirdState = {
  hatched: boolean;
  player?: {
    userId: number;
    role: string | null;
    birdResultId?: BirdResultId | null;
  };
};

/**
 * Сервер — источник визуальной идентичности после вылупления. Локальное
 * хранилище остаётся только совместимым кэшем для старых компонентов и
 * заполняется заново при каждом открытии Mini App, в том числе на новом
 * WebView/устройстве.
 */
export function hydrateBirdResultIdentity(state: PersistedBirdState): void {
  const player = state.player;
  if (!state.hatched || !player || player.role !== 'vibe') return;
  if (player.birdResultId !== 'owl' && player.birdResultId !== 'kotosov') return;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`kontur:bird-result:${player.userId}`, player.birdResultId);
  } catch {
    // Серверное состояние остаётся каноном; localStorage — только ускоряющий кэш.
  }
}

export function initialLocalStage(
  state: PersistedBirdState,
  search = '',
): InitialLocalStage {
  hydrateBirdResultIdentity(state);
  const params = new URLSearchParams(search);
  if (state.hatched) return params.get('replay') === '1' ? 'hook' : 'home';
  return params.get('community') === '1' ? 'community' : 'hook';
}

export function shouldReduceMotion(search: string, systemPreference: boolean): boolean {
  return systemPreference || new URLSearchParams(search).get('motion') === 'reduced';
}

export function reconcileColoring(
  colorings: ColoringDto[],
  next: Omit<ColoringDto, 'owned'>,
) {
  let found = false;
  const reconciled = colorings.map((item) => {
    if (item.code === next.code) {
      found = true;
      return { ...item, ...next, owned: true };
    }
    return next.equipped && item.equipped ? { ...item, equipped: false } : item;
  });
  if (!found) reconciled.push({ ...next, owned: true });
  return reconciled;
}
