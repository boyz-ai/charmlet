import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { angleOf } from '../src/core/geometry';
import { LAYOUTS, type LevelSpec } from '../src/levels/levels';

const row3 = (extra: Partial<LevelSpec> = {}): LevelSpec =>
  ({ layout: 'row3', colors: ['r', 'r', 'r'], gaps: [90, 270, 90], pins: [], role: 'normal', minMoves: 0, moves: 10, ...extra });
const mk = (s: LevelSpec): Game => new Game(s, LAYOUTS[s.layout]);
const linkAngle = (g: Game, i: number, j: number): number => {
  const L = g.links.find(l => (l.a === i && l.b === j) || (l.a === j && l.b === i))!;
  return angleOf(g.rings[i], L.p[0]);
};

describe('heavy ring', () => {
  it('turning it costs 2 moves and undo gives both back', () => {
    const g = mk(row3({ heavy: [1] }));
    expect(g.cost(1)).toBe(2);
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    expect(g.moves).toBe(8);
    g.undo();
    expect(g.moves).toBe(10);
    expect(g.spent).toBe(0);
  });
  it('cannot be turned with only 1 move left', () => {
    const g = mk(row3({ heavy: [1], moves: 1 }));
    expect(g.canRotate(1)).toBe(false);
    expect(g.canRotate(0)).toBe(true);
  });
});

describe('bomb ring', () => {
  it('explodes when its countdown is spent while it is still on the board', () => {
    const g = mk(row3({ bomb: [[1, 2]] }));
    expect(g.bombLeft(1)).toBe(2);
    g.rotate(0, 0.5); g.endDrag(0.5, 0);
    expect(g.bombLeft(1)).toBe(1);
    expect(g.state).toBe('play');
    g.rotate(2, 0.5); g.endDrag(0.5, 2);
    expect(g.state).toBe('lost');
    expect(g.loseReason).toBe('bomb');
  });
  it('is safe once it is off the board', () => {
    const g = mk(row3({ bomb: [[0, 1]] }));
    g.rings[0].gone = true; g.charmLanded('r');
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    expect(g.state).toBe('play');
  });
  it('a heavy turn counts double on the bomb', () => {
    const g = mk(row3({ bomb: [[0, 2]], heavy: [1] }));
    g.rotate(1, 0.5); g.endDrag(0.5, 1);
    expect(g.loseReason).toBe('bomb');
  });
});

describe('color lock', () => {
  it('opens only after a triple of its color merged', () => {
    const g = mk({ ...row3({ clock: [[0, 'b']] }), layout: 'g23', colors: ['r', 'b', 'r', 'b', 'r', 'b'], gaps: [0, 0, 0, 0, 0, 0] });
    // open ring 0's links by pointing neighbours' gaps at the crossings
    g.rings[1].g = linkAngle(g, 1, 0); g.rings[3].g = linkAngle(g, 3, 0);
    expect(g.isFree(0)).toBe(false);
    (['r', 'r', 'r'] as const).forEach(c => g.charmLanded(c));
    expect(g.isFree(0)).toBe(false);
    (['b', 'b', 'b'] as const).forEach(c => g.charmLanded(c));
    expect(g.mergesBy.b).toBe(1);
    expect(g.isFree(0)).toBe(true);
  });
});
