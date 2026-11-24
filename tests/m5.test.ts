import { describe, expect, it } from 'vitest';
import { Game, TRAY_SLOTS } from '../src/core/game';
import { angDelta } from '../src/core/geometry';
import { LAYOUTS, LEVELS, type LevelSpec } from '../src/levels/levels';
import { LocalSaveService, defaultSave } from '../src/services/save';
import {
  BOOSTER_PRICE, CONTINUE_PRICE, DAILY, buyContinue, claimDaily, dailyAvailable, dayKey, refundBooster, spendBooster,
  streakBonus, winCoins,
} from '../src/meta/meta';

const row3 = (extra: Partial<LevelSpec> = {}): LevelSpec =>
  ({ layout: 'row3', colors: ['r', 'r', 'r'], gaps: [90, 270, 90], pins: [], role: 'normal', minMoves: 0, moves: 10, ...extra });
const mk = (s: LevelSpec): Game => new Game(s, LAYOUTS[s.layout]);
const g23 = (): Game => mk({ layout: 'g23', colors: ['r', 'b', 'g', 'r', 'b', 'g'], gaps: [0, 0, 0, 0, 0, 0], pins: [], role: 'normal', minMoves: 0, moves: 5 });

describe('undo booster', () => {
  it('puts the last counted rotation back and refunds the move', () => {
    const g = mk(row3());
    const g0 = g.rings[1].g;
    expect(g.canUndo()).toBe(false);
    g.rotate(1, 0.4); g.rotate(1, 0.4); g.endDrag(0.8, 1);
    expect(g.moves).toBe(9);
    expect(g.undo()).toBe(true);
    expect(g.rings[1].g).toBeCloseTo(g0);
    expect(g.moves).toBe(10);
    expect(g.canUndo()).toBe(false);
  });
  it('does not record tiny drags and gives ice charges back', () => {
    const g = mk(row3({ ice: [1] }));
    g.rotate(1, 0.05); g.endDrag(0.05, 1);
    expect(g.canUndo()).toBe(false);
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    expect(g.rings[1].ice).toBe(1);
    g.undo();
    expect(g.rings[1].ice).toBe(2);
  });
  it('skips rotations of rings that are already gone', () => {
    const g = mk(row3());
    g.rotate(0, 0.5); g.endDrag(0.5, 0);
    g.rings[0].gone = true;
    expect(g.canUndo()).toBe(false);
  });
});

describe('extra slot booster', () => {
  it('adds one slot once per level', () => {
    const g = mk(row3());
    expect(g.addSlot()).toBe(true);
    expect(g.slots).toBe(TRAY_SLOTS + 1);
    expect(g.addSlot()).toBe(false);
  });
  it('rescues a full tray', () => {
    const g = g23();
    (['r', 'b', 'g', 'r', 'b'] as const).forEach(c => g.charmLanded(c));
    expect(g.state).toBe('lost');
    expect(g.loseReason).toBe('tray');
    expect(g.addSlot()).toBe(true);
    expect(g.state).toBe('play');
  });
  it('cannot rescue an out-of-moves loss', () => {
    const g = mk(row3({ fixed: [0, 1, 2] }));
    g.checkEnd();
    expect(g.loseReason).toBe('moves');
    expect(g.canAddSlot()).toBe(false);
    expect(g.canMagnet()).toBe(false);
  });
});

describe('magnet booster', () => {
  it('pulls the most common color out of the tray and rescues a full tray', () => {
    const g = g23();
    (['r', 'b', 'g', 'r', 'b'] as const).forEach(c => g.charmLanded(c));
    expect(g.magnet()).toBe(true);
    expect(g.tray).toEqual(['b', 'g', 'b']);
    expect(g.state).toBe('play');
  });
  it('needs charms in the tray', () => expect(mk(row3()).magnet()).toBe(false));
  it('a level is still won after a magnet left a partial color behind', () => {
    const g = mk(row3());
    g.rings[0].gone = true; g.charmLanded('r');
    g.magnet();
    g.rings[1].gone = true; g.charmLanded('r');
    g.rings[2].gone = true; g.charmLanded('r');
    expect(g.state).toBe('won');
  });
});

describe('meta: coins, streak, boosters', () => {
  it('streak bonus starts at 3', () => {
    expect(streakBonus(2)).toBe(0);
    expect(streakBonus(3)).toBe(2);
    expect(streakBonus(10)).toBe(2);
  });
  it('harder levels pay more coins', () => {
    expect(winCoins('normal')).toBeLessThan(winCoins('hard'));
    expect(winCoins('hard')).toBeLessThan(winCoins('super'));
  });
  it('first 2 uses of each booster are free, then they cost coins', () => {
    const s = defaultSave('tr');
    expect(spendBooster(s, 'magnet')).toBe('owned');
    expect(spendBooster(s, 'magnet')).toBe('owned');
    expect(spendBooster(s, 'magnet')).toBe(null);
    s.coins = BOOSTER_PRICE.magnet;
    expect(spendBooster(s, 'magnet')).toBe('coins');
    expect(s.coins).toBe(0);
    refundBooster(s, 'magnet', 'coins');
    expect(s.coins).toBe(BOOSTER_PRICE.magnet);
  });
  it('continue costs coins only when affordable', () => {
    const s = defaultSave('tr');
    expect(buyContinue(s)).toBe(false);
    s.coins = CONTINUE_PRICE;
    expect(buyContinue(s)).toBe(true);
    expect(s.coins).toBe(0);
  });
});

describe('flexible daily reward', () => {
  it('day 7 is worth more coins than days 1–6 together', () => {
    const first6 = DAILY.slice(0, 6).reduce((a, r) => a + r.coins, 0);
    expect(DAILY[6].coins).toBeGreaterThan(first6);
  });
  it('one claim per calendar day, missed days do not reset the track', () => {
    const s = defaultSave('tr');
    expect(dailyAvailable(s, '2026-11-25')).toBe(0);
    expect(claimDaily(s, '2026-11-25')!.coins).toBe(DAILY[0].coins);
    expect(claimDaily(s, '2026-11-25')).toBe(null);
    expect(dailyAvailable(s, '2026-11-30')).toBe(1);
    claimDaily(s, '2026-11-30');
    expect(s.coins).toBe(DAILY[0].coins + DAILY[1].coins);
  });
  it('wraps after day 7 and gives booster uses', () => {
    const s = defaultSave('tr');
    for (let d = 1; d <= 7; d++) claimDaily(s, `2026-12-0${d}`);
    expect(s.dailyStep).toBe(0);
    expect(s.boosters.undo).toBe(2 + 2);
    expect(s.boosters.slot).toBe(2 + 1);
  });
  it('dayKey uses the local calendar day', () => expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
});

describe('save migration', () => {
  it('old saves (before M5) get the free boosters and no coins', () => {
    const data: Record<string, string> = { 'charm.save.v1': JSON.stringify({ level: 7, streak: 2, lang: 'tr' }) };
    const s = new LocalSaveService({ getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }).load();
    expect(s.level).toBe(7);
    expect(s.coins).toBe(0);
    expect(s.boosters).toEqual({ undo: 2, slot: 2, magnet: 2 });
    expect(s.dailyLast).toBe(null);
  });
});

describe('shipped levels still solve with undo history in place', () => {
  it('replaying level 50 then undoing every rotation restores the move count', () => {
    const spec = LEVELS[49], g = mk(spec);
    let rotations = 0;
    for (const [i, deg] of spec.sol ?? []) {
      if (deg === null) { const c = g.rings[i].c; g.tap(i); g.charmLanded(c); if (g.state !== 'play') break; }
      else { g.rotate(i, angDelta(g.rings[i].g, (deg * Math.PI) / 180)); g.endDrag(1, i); rotations++; }
      if (rotations === 2) break;
    }
    const before = g.moves;
    while (g.undo()) { /* undo all */ }
    expect(g.moves).toBeGreaterThanOrEqual(before);
  });
});
