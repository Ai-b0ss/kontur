import type { Palette } from '@kontur/contracts';
import type { BirdResultId } from '../result-taxonomy.js';

export type BirdAsset = Readonly<{ src: string; width: number; height: number; label: string }>;

export const RESULT_ASSETS: Readonly<Record<BirdResultId, BirdAsset>> = Object.freeze({
  magpie: { src: '/results/magpie.webp', width: 1067, height: 1271, label: 'Сорока' },
  woodpecker: { src: '/results/woodpecker.webp', width: 952, height: 1463, label: 'Дятел' },
  jay: { src: '/results/jay.webp', width: 1073, height: 1364, label: 'Сойка' },
  crane: { src: '/results/crane.webp', width: 750, height: 1495, label: 'Журавль' },
  owl: { src: '/results/owl.webp', width: 171, height: 212, label: 'Сова' },
  kotosov: { src: '/results/kotosov.webp', width: 799, height: 1381, label: 'Котосов' },
});

const MAGPIE_PLUMAGE_ASSETS: Readonly<Record<'amber' | 'northern', BirdAsset>> = Object.freeze({
  amber: { src: '/results/magpie-amber.webp', width: 1067, height: 1271, label: 'Сорока, янтарный окрас' },
  northern: { src: '/results/magpie-northern.webp', width: 1067, height: 1271, label: 'Сорока, северный окрас' },
});

/**
 * Окрасы сороки — отдельные рисунки оперения. Здесь нет общей цветной маски:
 * «Уголёк»/«Золочёный» и «Иней»/«Полярный» выбирают самостоятельный арт.
 */
export function resolveResultAsset(resultId: BirdResultId, palette?: Palette | null): BirdAsset {
  if (resultId !== 'magpie' || !palette) return RESULT_ASSETS[resultId];
  const wing = palette.wing.toLowerCase();
  if (wing === '#bd5a35' || wing === '#c99f2e') return MAGPIE_PLUMAGE_ASSETS.amber;
  if (wing === '#8fb8d0' || wing === '#4fb8f5') return MAGPIE_PLUMAGE_ASSETS.northern;
  return RESULT_ASSETS.magpie;
}
