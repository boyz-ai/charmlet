import { describe, expect, it } from 'vitest';
import { Game, TRAY_SLOTS } from '../src/core/game';
import { angleOf } from '../src/core/geometry';
import { LAYOUTS, LEVELS, type LevelSpec } from '../src/levels/levels';

const mk = (spec: LevelSpec): Game => new Game(spec, LAYOUTS[spec.layout]);
const row3 = (gaps: number[], pins: [number, number][] = [], moves = 10): LevelSpec =>
  ({ layout: 'row3', colors: ['r', 'r', 'r'], gaps, pins, role: 'test', minMoves: 0, moves });
/** Point ring i's gap at an angle (radians). */
const aim = (g: Game, i: number, a: number): void => { g.rings[i].g = a; };
const linkAngle = (g: Game, i: number, j: number, k = 0): number => {
  const L = g.links.find(l => (l.a === i && l.b === j) || (l.a === j && l.b === i))!;
  return angleOf(g.rings[i], L.p[k]);
};

describe('geometry & links', () => {
  it('row3 has two links (0-1, 1-2)', () => {
    const g = mk(row3([90, 270, 90]));
    expect(g.links.map(l => [l.a, l.b])).toEqual([[0, 1], [1, 2]]);
  });
  it('a ring is free only when all its present links are open', () => {
    const g = mk(row3([90, 270, 90]));
    expect(g.isFree(0)).toBe(false);
    aim(g, 0, linkAngle(g, 0, 1));
    expect(g.isFree(0)).toBe(true);
    expect(g.isFree(1)).toBe(false); // still linked to ring 2
  });
  it("a neighbour's gap also opens the link", () => {
    const g = mk(row3([90, 270, 90]));
    aim(g, 1, linkAngle(g, 1, 0));
    expect(g.isFree(0)).toBe(true);
  });
});

describe('pins', () => {
  it('a pinned ring needs its own gap on the pin', () => {
    const g = mk(row3([90, 270, 90], [[0, 180]]));
    aim(g, 1, linkAngle(g, 1, 0)); // link opened by neighbour
    expect(g.isFree(0)).toBe(false);
    aim(g, 0, Math.PI); // gap on the pin
    expect(g.isFree(0)).toBe(true);
  });
});

describe('moves', () => {
  it('only a drag over the threshold costs a move', () => {
    const g = mk(row3([90, 270, 90], [], 3));
    g.endDrag(0.05);
    expect(g.moves).toBe(3);
    g.endDrag(0.5);
    expect(g.moves).toBe(2);
  });
  it('loses when out of moves and nothing is free', () => {
    const g = mk(row3([90, 270, 90], [], 1));
    let reason = '';
    g.on(e => { if (e.type === 'lose') reason = e.reason; });
    g.endDrag(0.5);
    expect(g.state).toBe('lost');
    expect(reason).toBe('moves');
  });
  it('+moves continues a lost-by-moves level', () => {
    const g = mk(row3([90, 270, 90], [], 1));
    g.endDrag(0.5);
    g.addMoves(3);
    expect(g.state).toBe('play');
    expect(g.moves).toBe(3);
  });
});

describe('tray & win', () => {
  it('releasing all three red rings merges them and wins', () => {
    const g = mk(row3([90, 270, 90]));
    const events: string[] = [];
    g.on(e => events.push(e.type));
    aim(g, 0, linkAngle(g, 0, 1));
    expect(g.tap(0)).toBe('released');
    g.charmLanded('r');
    aim(g, 1, linkAngle(g, 1, 2));
    g.tap(1); g.charmLanded('r');
    g.tap(2); g.charmLanded('r');
    expect(events).toContain('merge');
    expect(g.tray).toEqual([]);
    expect(g.state).toBe('won');
  });
  it('tapping a locked ring does not release it', () => {
    const g = mk(row3([90, 270, 90]));
    expect(g.tap(1)).toBe('locked');
    expect(g.rings[1].gone).toBe(false);
  });
  it('a full tray without a merge loses', () => {
    const spec: LevelSpec = { layout: 'g23', colors: ['r', 'b', 'r', 'b', 'r', 'b'], gaps: [0, 0, 0, 0, 0, 0], pins: [], role: 't', minMoves: 0, moves: 9 };
    const g = mk(spec);
    ['r', 'b', 'r', 'b'].forEach(c => g.charmLanded(c as 'r' | 'b'));
    expect(g.state).toBe('play');
    g.tray = ['r', 'b', 'r', 'b'];
    g.charmLanded('b'); // third blue merges → still playing
    expect(g.tray.length).toBe(2);
    g.tray = ['r', 'b', 'g', 'g', 'b'].slice(0, TRAY_SLOTS - 1) as never;
    g.charmLanded('r'); // r,b,g,g,r: no triple, 5 slots full → lose
    expect(g.state).toBe('lost');
  });
});

describe('shipped levels', () => {
  it('every level loads, has 3 charms per color and a sane move limit', () => {
    for (const spec of LEVELS) {
      const g = mk(spec);
      const counts: Record<string, number> = {};
      g.rings.forEach(r => (counts[r.c] = (counts[r.c] ?? 0) + 1));
      Object.values(counts).forEach(n => expect(n % 3).toBe(0));
      expect(spec.moves).toBeGreaterThanOrEqual(spec.minMoves);
      expect(g.links.length).toBeGreaterThan(0);
    }
  });
});
