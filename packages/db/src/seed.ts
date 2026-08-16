import type { Db } from './driver.js';
import { seedConfig } from './config.js';

/**
 * Посев: конфиг и каталог окрасов. Идемпотентен.
 *
 * Окрасы перекрашивают одну и ту же птицу — по арту нужно пять птиц
 * и палитры, а не сорок разных. Роль при этом не меняется никогда.
 */

interface ColoringSeed {
  code: string;
  title: string;
  rarity: 'common' | 'rare' | 'legendary';
  weight: number;
  palette: {
    body: string;
    belly: string;
    wing: string;
    tail: string;
    crest: string;
    beak: string;
  };
}

const COLORINGS: ColoringSeed[] = [
  // обычные — суммарный вес 68
  { code: 'plain',   title: 'Обычный',      rarity: 'common', weight: 20,
    palette: { body: '#edd9b6', belly: '#faeed6', wing: '#d3ae74', tail: '#c09a68', crest: '#c8a26c', beak: '#ef8a52' } },
  { code: 'soot',    title: 'Копчёный',     rarity: 'common', weight: 16,
    palette: { body: '#8d8794', belly: '#c4bfc9', wing: '#6f6a77', tail: '#5d5865', crest: '#6f6a77', beak: '#e0a05a' } },
  { code: 'clay',    title: 'Глиняный',     rarity: 'common', weight: 16,
    palette: { body: '#c98f6a', belly: '#e8c3a4', wing: '#a9704f', tail: '#95613f', crest: '#a9704f', beak: '#e8b04a' } },
  { code: 'moss',    title: 'Мшистый',      rarity: 'common', weight: 16,
    palette: { body: '#9aae86', belly: '#cfdcbd', wing: '#778a63', tail: '#657653', crest: '#778a63', beak: '#e6a24f' } },

  // редкие — суммарный вес 27
  { code: 'ember',   title: 'Уголёк',       rarity: 'rare', weight: 9,
    palette: { body: '#e07a4f', belly: '#ffc79a', wing: '#bd5a35', tail: '#9d4526', crest: '#ff9d5c', beak: '#ffd07a' } },
  { code: 'frost',   title: 'Иней',         rarity: 'rare', weight: 9,
    palette: { body: '#b9d7e8', belly: '#eaf6ff', wing: '#8fb8d0', tail: '#7aa3bd', crest: '#d6ecfa', beak: '#f0a05a' } },
  { code: 'plum',    title: 'Сливовый',     rarity: 'rare', weight: 9,
    palette: { body: '#9a7bb8', belly: '#d9c6ea', wing: '#7c5d9b', tail: '#654a80', crest: '#b193cd', beak: '#f0a05a' } },

  // легендарные — суммарный вес 5
  { code: 'aurora',  title: 'Полярный',     rarity: 'legendary', weight: 2,
    palette: { body: '#7fe3c0', belly: '#d6fff2', wing: '#4fb8f5', tail: '#7a6bf0', crest: '#a8f0d8', beak: '#ffd07a' } },
  { code: 'gilded',  title: 'Золочёный',    rarity: 'legendary', weight: 2,
    palette: { body: '#e8c65a', belly: '#fff2c0', wing: '#c99f2e', tail: '#a8811d', crest: '#ffe08a', beak: '#fff0b0' } },
  { code: 'void',    title: 'Беззвёздный',  rarity: 'legendary', weight: 1,
    palette: { body: '#2b2740', belly: '#453f63', wing: '#1d1a2e', tail: '#15121f', crest: '#6a5fa0', beak: '#c5b8ff' } },
];

export async function seed(db: Db): Promise<void> {
  await seedConfig(db);

  for (const c of COLORINGS) {
    await db.query(
      `insert into colorings (code, title, rarity, weight, palette)
       values ($1, $2, $3, $4, $5)
       on conflict (code) do update
         set title = excluded.title,
             rarity = excluded.rarity,
             weight = excluded.weight,
             palette = excluded.palette`,
      [c.code, c.title, c.rarity, c.weight, JSON.stringify(c.palette)],
    );
  }
}
