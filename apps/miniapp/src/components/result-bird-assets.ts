import type { BirdResultId } from '../result-taxonomy.js';

export const RESULT_ASSETS: Readonly<Record<BirdResultId, { src: string; width: number; height: number; label: string }>> = Object.freeze({
  magpie: { src: '/results/magpie.webp', width: 1067, height: 1271, label: 'Сорока' },
  woodpecker: { src: '/results/woodpecker.webp', width: 952, height: 1463, label: 'Дятел' },
  jay: { src: '/results/jay.webp', width: 1073, height: 1364, label: 'Сойка' },
  crane: { src: '/results/crane.webp', width: 750, height: 1495, label: 'Журавль' },
  owl: { src: '/results/owl.webp', width: 171, height: 212, label: 'Сова' },
  kotosov: { src: '/results/kotosov.webp', width: 799, height: 1381, label: 'Котосов' },
});
