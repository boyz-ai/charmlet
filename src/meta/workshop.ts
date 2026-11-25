// Bracelet Workshop: what coins are for besides boosters.
// Cosmetic ring finishes, charm sets and board themes bought with coins, plus one collectible charm
// for every finished chapter of 50 levels. Cosmetics never change the rules or the colors that carry them.
import type { SaveData } from '../services/save';

export type CosKind = 'ring' | 'charm' | 'board';
export interface Cosmetic { id: string; kind: CosKind; price: number }

export const COSMETICS: Cosmetic[] = [
  { id: 'ring.classic', kind: 'ring', price: 0 },
  { id: 'ring.gold', kind: 'ring', price: 500 },
  { id: 'ring.rose', kind: 'ring', price: 800 },
  { id: 'ring.onyx', kind: 'ring', price: 1200 },
  { id: 'ring.crystal', kind: 'ring', price: 2000 },
  { id: 'charm.classic', kind: 'charm', price: 0 },
  { id: 'charm.sky', kind: 'charm', price: 700 },
  { id: 'charm.garden', kind: 'charm', price: 1000 },
  { id: 'board.velvet', kind: 'board', price: 0 },
  { id: 'board.night', kind: 'board', price: 300 },
  { id: 'board.emerald', kind: 'board', price: 600 },
  { id: 'board.ocean', kind: 'board', price: 900 },
  { id: 'board.rose', kind: 'board', price: 1200 },
];
export const DEFAULT_LOOK: Record<CosKind, string> = { ring: 'ring.classic', charm: 'charm.classic', board: 'board.velvet' };

export const ownsCos = (s: SaveData, id: string): boolean => COSMETICS.find(c => c.id === id)?.price === 0 || s.cos.owned.includes(id);

/** Buy (if needed) and wear a cosmetic. Returns false when the player can't afford it. */
export function buyOrWear(s: SaveData, id: string): 'worn' | 'bought' | 'poor' | 'unknown' {
  const c = COSMETICS.find(x => x.id === id);
  if (!c) return 'unknown';
  let res: 'worn' | 'bought' = 'worn';
  if (!ownsCos(s, id)) {
    if (s.coins < c.price) return 'poor';
    s.coins -= c.price; s.cos.owned.push(id); res = 'bought';
  }
  s.cos[c.kind] = id;
  return res;
}

/** Chapter collection: one charm per finished chapter of 50 levels. */
export const CHAPTER_SIZE = 50;
export const COLLECTION = ['🌙', '⭐', '🍀', '🌸', '💎', '🦋', '🔔', '🍒', '🐚', '🌈', '🔑', '👑', '❄️', '🔥', '🍓', '🎀', '🕊️', '🌻', '⚓', '🪐'];
export const CHAPTER_REWARD = 150;
export const collected = (best: number): number => Math.min(COLLECTION.length, Math.floor(best / CHAPTER_SIZE));
