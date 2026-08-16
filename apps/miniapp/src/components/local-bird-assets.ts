import type { Role } from '@kontur/core';

export type BirdAssetDefinition = {
  src: string;
  width: number;
  height: number;
  label: string;
  /** Broad wing zone in normalised image coordinates. */
  accentPath: string;
};

export const LOCAL_BIRD_ASSETS: Record<Role, BirdAssetDefinition> = {
  designer: {
    src: '/birds/magpie.webp',
    width: 640,
    height: 559,
    label: 'сорока',
    accentPath: 'M32 41C38 44 49 46 57 48L62 61C61 63 58 63 54 61L40 54C35 50 32 45 32 41Z',
  },
  coder: {
    src: '/birds/woodpecker.webp',
    width: 640,
    height: 607,
    label: 'дятел',
    accentPath: 'M52 56C58 54 64 52 68 54C73 61 76 68 76 72C73 74 68 71 63 67C58 63 54 60 52 56Z',
  },
  creative: {
    src: '/birds/jay.webp',
    width: 640,
    height: 554,
    label: 'сойка',
    accentPath: 'M30 40C35 45 42 48 46 49L48 58C44 58 37 54 33 51C30 48 29 44 30 40Z',
  },
  manager: {
    src: '/birds/crane.webp',
    width: 640,
    height: 452,
    label: 'журавль',
    accentPath: 'M48 31C58 32 68 32 73 32C76 35 77 39 75 41C67 42 58 40 52 36C50 34 49 32 48 31Z',
  },
  vibe: {
    src: '/birds/owl.webp',
    width: 523,
    height: 640,
    label: 'сова',
    accentPath: 'M47 52C56 59 68 62 75 68C79 72 82 77 83 79C79 80 72 76 66 73C58 68 51 61 47 52Z',
  },
};

export function resolveBirdRole(role: Role | null): Role {
  return role ?? 'vibe';
}

export function fitBirdAsset(role: Role | null, size: number) {
  const asset = LOCAL_BIRD_ASSETS[resolveBirdRole(role)];
  const boxWidth = size;
  const boxHeight = Math.round(size * 0.78);
  const scale = Math.min(boxWidth / asset.width, boxHeight / asset.height);

  return {
    boxWidth,
    boxHeight,
    renderWidth: Math.round(asset.width * scale),
    renderHeight: Math.round(asset.height * scale),
  };
}
