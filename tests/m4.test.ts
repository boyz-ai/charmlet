import { describe, expect, it } from 'vitest';
import { Game, ICE_ROTATIONS } from '../src/core/game';
import { angDelta, angleOf } from '../src/core/geometry';
import { LAYOUTS, LEVELS, type LevelSpec } from '../src/levels/levels';

const row3 = (extra: Partial<LevelSpec> = {}): LevelSpec =>
  ({ layout: 'row3', colors: ['r', 'r', 'r'], gaps: [90, 270, 90], pins: [], role: 'normal', minMoves: 0, moves: 10, ...extra });
const mk = (s: LevelSpec): Game => new Game(s, LAYOUTS[s.layout]);
const linkAngle = (g: Game, i: number, j: number, k = 0): number => {
  const L = g.links.find(l => (l.a === i && l.b === j) || (l.a === j && l.b === i))!;
  return angleOf(g.rings[i], L.p[k]);
};

describe('fixed ring', () => {
  it('cannot be rotated but can be freed by neighbours', () => {
    const g = mk(row3({ fixed: [0] }));
    const before = g.rings[0].g;
    g.rotate(0, 1);
    expect(g.rings[0].g).toBe(before);
    expect(g.canRotate(0)).toBe(false);
    g.rotate(1, angDelta(g.rings[1].g, linkAngle(g, 1, 0)));
    expect(g.isFree(0)).toBe(true);
  });
});

describe('twin ring', () => {
  it('has a second gap opposite the first', () => {
    const g = mk(row3({ twin: [1] }));
    const r = g.rings[1];
    expect(g.inGap(1, r.g + Math.PI)).toBe(true);
    expect(g.inGap(1, r.g + Math.PI / 2)).toBe(false);
    expect(g.charmAngle(1)).toBeCloseTo(r.g + Math.PI / 2);
  });
});

describe('lock ring', () => {
  it('stays locked until the first merge', () => {
    const g = mk({ ...row3({ lock: [0] }) });
    g.rings[0].g = linkAngle(g, 0, 1);
    expect(g.isFree(0)).toBe(false);
    g.merges = 1;
    expect(g.isFree(0)).toBe(true);
  });
  it('counts merges in the tray', () => {
    const g = mk(row3());
    ['r', 'r', 'r'].forEach(c => g.charmLanded(c as 'r'));
    expect(g.merges).toBe(1);
  });
});

describe('ice ring', () => {
  it(`turns only ${ICE_ROTATIONS} times`, () => {
    const g = mk(row3({ ice: [1] }));
    expect(g.rings[1].ice).toBe(ICE_ROTATIONS);
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    expect(g.rings[1].ice).toBe(0);
    expect(g.canRotate(1)).toBe(false);
    const before = g.rings[1].g; g.rotate(1, 0.5);
    expect(g.rings[1].g).toBe(before);
  });
  it('a tiny drag does not use an ice charge', () => {
    const g = mk(row3({ ice: [1] }));
    g.endDrag(0.05, 1);
    expect(g.rings[1].ice).toBe(ICE_ROTATIONS);
  });
});

describe('stuck detection', () => {
  it('loses when nothing is free and nothing can turn', () => {
    const g = mk(row3({ fixed: [0, 1, 2] }));
    g.checkEnd();
    expect(g.state).toBe('lost');
  });
});

describe('100 shipped levels', () => {
  it('there are 100 levels', () => expect(LEVELS.length).toBe(100));
  it.each(LEVELS.map((_, i) => i))('level %i is won by replaying its verified solution in the real game rules', n => {
    const spec = LEVELS[n];
    const g = mk(spec);
    for (const [i, deg] of spec.sol ?? []) {
      if (deg === null) {
        const c = g.rings[i].c;
        expect(g.tap(i)).toBe('released');
        g.charmLanded(c);
      } else {
        expect(g.canRotate(i)).toBe(true);
        g.rotate(i, angDelta(g.rings[i].g, (deg * Math.PI) / 180));
        g.endDrag(1, i);
      }
    }
    expect(g.state).toBe('won');
    expect(g.moves).toBeGreaterThanOrEqual(0);
    expect(spec.moves - g.moves).toBe(spec.minMoves);
  });
});
