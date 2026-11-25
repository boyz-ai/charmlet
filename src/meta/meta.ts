// Meta layer (GDD "Meta" + boosters): coins, win-streak bonus, flexible daily reward, booster inventory.
// Pure functions on SaveData so everything here is unit-tested without the DOM.
import type { SaveData } from '../services/save';

export type Booster = 'hint' | 'undo' | 'slot' | 'magnet';
export const BOOSTERS: Booster[] = ['hint', 'undo', 'slot', 'magnet'];

/** Every booster starts with 2 free uses (the hint with 3). */
export const FREE_BOOSTERS = 2;
export const FREE_HINTS = 3;
/** Coin price of one booster use once the free ones are gone. */
export const BOOSTER_PRICE: Record<Booster, number> = { hint: 40, undo: 60, slot: 90, magnet: 120 };
/** Coin price of +3 moves on the out-of-moves screen (a rewarded ad replaces this in M7). */
export const CONTINUE_PRICE = 60;
export const CONTINUE_MOVES = 3;

/** Win streak: at 3+ consecutive first-try wins the next level starts with +2 moves. */
export const STREAK_BONUS_AT = 3;
export const STREAK_BONUS_MOVES = 2;
export const streakBonus = (streak: number): number => (streak >= STREAK_BONUS_AT ? STREAK_BONUS_MOVES : 0);

/**
 * The ghost hand appears by itself only where a rule is being taught: the tutorial levels and the level
 * that introduces a new ring type. Everywhere else the player asks for it with the Hint booster.
 */
export const autoHint = (levelIndex: number, role: string): boolean => levelIndex < 3 || role.startsWith('new_');
/** After this many losses on the same level the Hint button glows (it never solves by itself). */
export const HINT_NUDGE_FAILS = 2;

/** Coins for winning a level (harder roles pay more). */
export function winCoins(role: string): number {
  if (role === 'super') return 25;
  if (role === 'hard') return 15;
  return 10;
}

export type Reward = { coins: number; boosters?: Partial<Record<Booster, number>> };
/**
 * Flexible daily reward: a 7-step track, one step per calendar day the player opens the game.
 * Missed days never reset the track ("log in any 3 of 7 days" still gets you far).
 * Step 7 is worth more than steps 1–6 together (GDD).
 */
export const DAILY: Reward[] = [
  { coins: 20 }, { coins: 25 }, { coins: 30, boosters: { undo: 1 } }, { coins: 35 }, { coins: 40, boosters: { magnet: 1 } }, { coins: 50 },
  { coins: 250, boosters: { undo: 1, slot: 1, magnet: 1 } },
];

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Index (0–6) of the reward that can be claimed today, or null if today's is already claimed. */
export function dailyAvailable(s: SaveData, today: string): number | null {
  if (s.dailyLast === today) return null;
  return s.dailyStep % DAILY.length;
}

/** Claim today's reward. Returns the reward, or null if it was already claimed today. */
export function claimDaily(s: SaveData, today: string): Reward | null {
  const step = dailyAvailable(s, today);
  if (step === null) return null;
  const r = DAILY[step];
  s.coins += r.coins;
  for (const [b, n] of Object.entries(r.boosters ?? {}) as [Booster, number][]) s.boosters[b] += n;
  s.dailyStep = (step + 1) % DAILY.length;
  s.dailyLast = today;
  return r;
}

/**
 * Pay for one booster use: a free/owned use first, otherwise coins.
 * Returns how it was paid, or null if the player can't afford it (nothing changes then).
 */
export function spendBooster(s: SaveData, b: Booster): 'owned' | 'coins' | null {
  if (s.boosters[b] > 0) { s.boosters[b]--; return 'owned'; }
  if (s.coins >= BOOSTER_PRICE[b]) { s.coins -= BOOSTER_PRICE[b]; return 'coins'; }
  return null;
}
/** Give a booster use back (used when a paid booster turned out to do nothing). */
export function refundBooster(s: SaveData, b: Booster, how: 'owned' | 'coins'): void {
  if (how === 'owned') s.boosters[b]++; else s.coins += BOOSTER_PRICE[b];
}

/** Pay for +3 moves with coins. */
export function buyContinue(s: SaveData): boolean {
  if (s.coins < CONTINUE_PRICE) return false;
  s.coins -= CONTINUE_PRICE;
  return true;
}
